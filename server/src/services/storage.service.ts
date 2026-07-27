import { createReadStream, createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { env } from '../config/env';

export type StorageProvider = 'local' | 's3';

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

export async function ensureUploadsRoot(): Promise<void> {
  if (getProvider() === 'local') {
    await fs.mkdir(uploadsRoot, { recursive: true });
  }
}

function sanitizeName(originalName: string) {
  return originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function buildStorageKey(caseId: string, originalName: string) {
  return path.posix.join('cases', caseId, `${randomUUID()}-${sanitizeName(originalName)}`);
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
          // Private by default — downloads only via authenticated API.
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
        }),
      );
    }
    return { storageKey };
  }

  await ensureUploadsRoot();
  const absolutePath = path.join(uploadsRoot, storageKey);
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
  const absolutePath = path.join(uploadsRoot, storageKey);
  const normalizedRoot = path.normalize(uploadsRoot + path.sep);
  const normalizedPath = path.normalize(absolutePath);

  if (!normalizedPath.startsWith(normalizedRoot) && normalizedPath !== path.normalize(uploadsRoot)) {
    throw new Error('Invalid storage key');
  }

  return absolutePath;
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

  const absolutePath = resolveStoragePath(storageKey);
  const stat = await fs.stat(absolutePath);
  return {
    stream: createReadStream(absolutePath),
    contentLength: stat.size,
  };
}

export async function storedFileExists(storageKey: string): Promise<boolean> {
  try {
    if (getProvider() === 's3') {
      await getS3().send(
        new GetObjectCommand({
          Bucket: env.s3Bucket,
          Key: storageKey,
          Range: 'bytes=0-0',
        }),
      );
      return true;
    }
    await fs.access(resolveStoragePath(storageKey));
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
    await fs.unlink(resolveStoragePath(storageKey));
  } catch {
    // Best-effort cleanup
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
