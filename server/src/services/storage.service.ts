import { createReadStream, createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  RestoreObjectCommand,
  S3Client,
  type StorageClass,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { env } from '../config/env';

export type StorageProvider = 'local' | 's3';

export type ObjectRestoreState = 'not_restoring' | 'pending' | 'available' | 'unknown';

const uploadsRoot = path.resolve(
  process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads'),
);

let s3Client: S3Client | null = null;

function getProvider(): StorageProvider {
  return env.storageProvider;
}

function getS3(): S3Client {
  if (!s3Client) {
    if (!env.s3Bucket || !env.s3AccessKeyId || !env.s3SecretAccessKey) {
      throw new Error(
        'S3 storage is enabled but S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY are missing',
      );
    }
    s3Client = new S3Client({
      region: env.s3Region,
      endpoint: env.s3Endpoint || undefined,
      forcePathStyle: env.s3ForcePathStyle,
      credentials: {
        accessKeyId: env.s3AccessKeyId,
        secretAccessKey: env.s3SecretAccessKey,
      },
    });
  }
  return s3Client;
}

export function getUploadsRoot(): string {
  return uploadsRoot;
}

export function coldStorageEnabled(): boolean {
  return env.fileColdStorageEnabled;
}

export async function ensureUploadsRoot(): Promise<void> {
  if (getProvider() === 'local') {
    await fs.mkdir(uploadsRoot, { recursive: true });
    await fs.mkdir(path.join(uploadsRoot, 'hot'), { recursive: true });
    await fs.mkdir(path.join(uploadsRoot, 'cold'), { recursive: true });
  }
}

function sanitizeName(originalName: string) {
  return originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function buildStorageKey(caseId: string, originalName: string) {
  return path.posix.join('cases', caseId, `${randomUUID()}-${sanitizeName(originalName)}`);
}

function assertSafeKey(storageKey: string) {
  if (
    !storageKey ||
    storageKey.includes('..') ||
    path.isAbsolute(storageKey) ||
    storageKey.startsWith('/') ||
    storageKey.startsWith('\\')
  ) {
    throw new Error('Invalid storage key');
  }
}

/** Logical key stays `cases/...`; local disk uses uploads/hot|cold|legacy. */
function localHotPath(storageKey: string) {
  return path.join(uploadsRoot, 'hot', storageKey);
}

function localColdPath(storageKey: string) {
  return path.join(uploadsRoot, 'cold', storageKey);
}

function localLegacyPath(storageKey: string) {
  return path.join(uploadsRoot, storageKey);
}

async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/** Prefer hot, then legacy (pre-migration), then cold. */
export async function resolveLocalAbsolutePath(
  storageKey: string,
  prefer: 'hot' | 'cold' | 'any' = 'any',
): Promise<string> {
  assertSafeKey(storageKey);
  const hot = localHotPath(storageKey);
  const cold = localColdPath(storageKey);
  const legacy = localLegacyPath(storageKey);

  if (prefer === 'hot') {
    if (await pathExists(hot)) return hot;
    if (await pathExists(legacy)) return legacy;
    throw new Error('Local hot object not found');
  }
  if (prefer === 'cold') {
    if (await pathExists(cold)) return cold;
    throw new Error('Local cold object not found');
  }

  if (await pathExists(hot)) return hot;
  if (await pathExists(legacy)) return legacy;
  if (await pathExists(cold)) return cold;
  throw new Error('Local object not found');
}

export async function saveCaseFile(input: {
  caseId: string;
  originalName: string;
  buffer?: Buffer;
  filePath?: string;
  mimeType?: string;
}): Promise<{ storageKey: string; absolutePath?: string }> {
  if (!input.buffer && !input.filePath) {
    throw new Error('Either buffer or filePath is required');
  }

  const storageKey = buildStorageKey(input.caseId, input.originalName);
  const contentType = input.mimeType || 'application/octet-stream';

  if (getProvider() === 's3') {
    const client = getS3();
    if (input.filePath) {
      const upload = new Upload({
        client,
        params: {
          Bucket: env.s3Bucket,
          Key: storageKey,
          Body: createReadStream(input.filePath),
          ContentType: contentType,
          StorageClass: 'STANDARD',
          ACL: undefined,
        },
      });
      await upload.done();
    } else {
      await client.send(
        new PutObjectCommand({
          Bucket: env.s3Bucket,
          Key: storageKey,
          Body: input.buffer,
          ContentType: contentType,
          StorageClass: 'STANDARD',
        }),
      );
    }
    return { storageKey };
  }

  await ensureUploadsRoot();
  const absolutePath = localHotPath(storageKey);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  if (input.filePath) {
    await fs.copyFile(input.filePath, absolutePath);
  } else if (input.buffer) {
    await fs.writeFile(absolutePath, input.buffer);
  }
  return { storageKey, absolutePath };
}

export function resolveStoragePath(storageKey: string): string {
  if (getProvider() === 's3') {
    throw new Error('resolveStoragePath is only available for local storage');
  }
  assertSafeKey(storageKey);
  return localHotPath(storageKey);
}

export async function openStoredReadStream(storageKey: string): Promise<{
  stream: Readable;
  contentLength?: number;
}> {
  if (getProvider() === 's3') {
    const result = await getS3().send(
      new GetObjectCommand({
        Bucket: env.s3Bucket,
        Key: storageKey,
      }),
    );
    if (!result.Body) throw new Error('Empty S3 object body');
    const body = result.Body as Readable;
    return {
      stream: body,
      contentLength:
        typeof result.ContentLength === 'number' ? result.ContentLength : undefined,
    };
  }

  const absolutePath = await resolveLocalAbsolutePath(storageKey, 'any');
  // Serving from cold path is allowed only when caller already rehydrated (local restore = move).
  const stat = await fs.stat(absolutePath);
  return {
    stream: createReadStream(absolutePath),
    contentLength: stat.size,
  };
}

/** HeadObject / fs.access — avoid Range GET (which can bill Glacier retrieval). */
export async function storedFileExists(storageKey: string): Promise<boolean> {
  try {
    if (getProvider() === 's3') {
      await getS3().send(
        new HeadObjectCommand({
          Bucket: env.s3Bucket,
          Key: storageKey,
        }),
      );
      return true;
    }
    await resolveLocalAbsolutePath(storageKey, 'any');
    return true;
  } catch {
    return false;
  }
}

export async function deleteStoredFile(storageKey: string): Promise<void> {
  try {
    if (getProvider() === 's3') {
      await getS3().send(
        new DeleteObjectCommand({
          Bucket: env.s3Bucket,
          Key: storageKey,
        }),
      );
      return;
    }
    for (const candidate of [
      localHotPath(storageKey),
      localColdPath(storageKey),
      localLegacyPath(storageKey),
    ]) {
      await fs.unlink(candidate).catch(() => undefined);
    }
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Archive to cheap cold storage.
 * S3: change storage class to GLACIER/DEEP_ARCHIVE (one-time). No Instant Retrieval.
 * Local: rename hot/legacy → cold (free).
 */
export async function transitionToCold(storageKey: string): Promise<void> {
  assertSafeKey(storageKey);
  if (!coldStorageEnabled()) return;

  if (getProvider() === 's3') {
    const storageClass = env.fileColdStorageClass as StorageClass;
    await getS3().send(
      new CopyObjectCommand({
        Bucket: env.s3Bucket,
        CopySource: `${env.s3Bucket}/${storageKey}`,
        Key: storageKey,
        StorageClass: storageClass,
        MetadataDirective: 'COPY',
      }),
    );
    return;
  }

  await ensureUploadsRoot();
  let source: string | null = null;
  if (await pathExists(localHotPath(storageKey))) source = localHotPath(storageKey);
  else if (await pathExists(localLegacyPath(storageKey))) source = localLegacyPath(storageKey);
  else if (await pathExists(localColdPath(storageKey))) return;
  else throw new Error('Local object not found for cold transition');

  const dest = localColdPath(storageKey);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.rename(source, dest);
}

/**
 * Local-only: move cold → hot immediately (free).
 * S3 does NOT promote with CopyObject to STANDARD — that would add rewrite cost.
 * S3 uses temporary RestoreObject instead (see requestObjectRestore).
 */
export async function transitionLocalToHot(storageKey: string): Promise<void> {
  assertSafeKey(storageKey);
  if (getProvider() !== 'local') {
    throw new Error('transitionLocalToHot is only for local storage');
  }
  await ensureUploadsRoot();
  if (await pathExists(localHotPath(storageKey))) return;
  if (await pathExists(localLegacyPath(storageKey))) {
    const dest = localHotPath(storageKey);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.rename(localLegacyPath(storageKey), dest);
    return;
  }
  if (!(await pathExists(localColdPath(storageKey)))) {
    throw new Error('Local cold object not found');
  }
  const dest = localHotPath(storageKey);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.rename(localColdPath(storageKey), dest);
}

/**
 * Start a temporary Glacier restore. Object stays in Glacier class —
 * temporary copy is readable for FILE_RESTORE_DAYS without Standard promotion.
 */
export async function requestObjectRestore(storageKey: string): Promise<void> {
  assertSafeKey(storageKey);
  if (getProvider() !== 's3') {
    await transitionLocalToHot(storageKey);
    return;
  }

  const tier = env.fileRestoreTier;
  await getS3().send(
    new RestoreObjectCommand({
      Bucket: env.s3Bucket,
      Key: storageKey,
      RestoreRequest: {
        Days: env.fileRestoreDays,
        GlacierJobParameters: {
          Tier: tier,
        },
      },
    }),
  );
}

export async function getObjectStorageClass(storageKey: string): Promise<string | null> {
  if (getProvider() !== 's3') return null;
  const head = await getS3().send(
    new HeadObjectCommand({
      Bucket: env.s3Bucket,
      Key: storageKey,
    }),
  );
  return head.StorageClass ?? 'STANDARD';
}

export async function getObjectRestoreState(storageKey: string): Promise<ObjectRestoreState> {
  if (getProvider() !== 's3') {
    if (await pathExists(localHotPath(storageKey)) || await pathExists(localLegacyPath(storageKey))) {
      return 'available';
    }
    if (await pathExists(localColdPath(storageKey))) return 'not_restoring';
    return 'unknown';
  }

  try {
    const head = await getS3().send(
      new HeadObjectCommand({
        Bucket: env.s3Bucket,
        Key: storageKey,
      }),
    );
    const restore = head.Restore;
    if (!restore) {
      const cls = head.StorageClass ?? 'STANDARD';
      if (cls === 'STANDARD' || cls === 'STANDARD_IA' || cls === 'ONEZONE_IA' || cls === 'INTELLIGENT_TIERING') {
        return 'available';
      }
      return 'not_restoring';
    }
    if (/ongoing-request\s*=\s*"true"/i.test(restore)) return 'pending';
    if (/ongoing-request\s*=\s*"false"/i.test(restore)) return 'available';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Write a multer temp file into durable storage, then remove the temp file. */
export async function persistUploadedFile(input: {
  caseId: string;
  originalName: string;
  mimeType?: string;
  buffer?: Buffer;
  tempPath?: string;
}): Promise<{ storageKey: string }> {
  try {
    return await saveCaseFile({
      caseId: input.caseId,
      originalName: input.originalName,
      buffer: input.buffer,
      filePath: input.tempPath,
      mimeType: input.mimeType,
    });
  } finally {
    if (input.tempPath) {
      await fs.unlink(input.tempPath).catch(() => undefined);
    }
  }
}

export async function materializeToTempFile(storageKey: string): Promise<string> {
  const tempDir = path.join(uploadsRoot, '.tmp');
  await fs.mkdir(tempDir, { recursive: true });
  const tempPath = path.join(tempDir, `${randomUUID()}.bin`);
  const { stream } = await openStoredReadStream(storageKey);
  await pipeline(stream, createWriteStream(tempPath));
  return tempPath;
}

export interface SignedFileAccess {
  url: string;
  expiresAt: string;
  provider: StorageProvider;
}

function signPayload(payload: string): string {
  return createHmac('sha256', env.jwtSecret).update(payload).digest('base64url');
}

/**
 * Issue a time-limited download URL after permission checks.
 * Caller must ensure the object is readable (hot or temporarily restored).
 */
export async function createSignedFileAccess(input: {
  storageKey: string;
  originalName: string;
  mimeType?: string;
  ttlSeconds?: number;
}): Promise<SignedFileAccess> {
  const ttl = Math.max(30, Math.min(input.ttlSeconds ?? env.signedUrlTtlSeconds, 3600));
  const expiresAtMs = Date.now() + ttl * 1000;
  const expiresAt = new Date(expiresAtMs).toISOString();

  if (getProvider() === 's3') {
    const command = new GetObjectCommand({
      Bucket: env.s3Bucket,
      Key: input.storageKey,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(input.originalName)}"`,
      ResponseContentType: input.mimeType || 'application/octet-stream',
    });
    const url = await getSignedUrl(getS3(), command, { expiresIn: ttl });
    return { url, expiresAt, provider: 's3' };
  }

  const payload = [
    input.storageKey,
    String(expiresAtMs),
    input.originalName,
    input.mimeType || 'application/octet-stream',
  ].join('|');
  const signature = signPayload(payload);
  const token = Buffer.from(`${payload}|${signature}`).toString('base64url');
  const apiBase = (process.env.API_PUBLIC_URL || process.env.SERVER_URL || '').replace(/\/$/, '');
  const url = apiBase
    ? `${apiBase}/api/files/signed?token=${token}`
    : `/api/files/signed?token=${token}`;

  return {
    url,
    expiresAt,
    provider: 'local',
  };
}

export function verifyLocalSignedToken(token: string): {
  storageKey: string;
  originalName: string;
  mimeType: string;
  expiresAtMs: number;
} {
  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    throw new Error('Invalid signed token');
  }

  const parts = decoded.split('|');
  if (parts.length !== 5) throw new Error('Invalid signed token');
  const [storageKey, expiresRaw, originalName, mimeType, signature] = parts;
  const payload = [storageKey, expiresRaw, originalName, mimeType].join('|');
  const expected = signPayload(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Invalid signed token signature');
  }

  const expiresAtMs = Number(expiresRaw);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
    throw new Error('Signed token has expired');
  }

  return { storageKey, originalName, mimeType, expiresAtMs };
}
