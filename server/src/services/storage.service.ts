import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const uploadsRoot = path.resolve(
  process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads'),
);

export function getUploadsRoot(): string {
  return uploadsRoot;
}

export async function ensureUploadsRoot(): Promise<void> {
  await fs.mkdir(uploadsRoot, { recursive: true });
}

export async function saveCaseFile(input: {
  caseId: string;
  originalName: string;
  buffer: Buffer;
}): Promise<{ storageKey: string; absolutePath: string }> {
  await ensureUploadsRoot();

  const safeName = input.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageKey = path.posix.join('cases', input.caseId, `${randomUUID()}-${safeName}`);
  const absolutePath = path.join(uploadsRoot, storageKey);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, input.buffer);

  return { storageKey, absolutePath };
}

export function resolveStoragePath(storageKey: string): string {
  const absolutePath = path.join(uploadsRoot, storageKey);
  const normalizedRoot = path.normalize(uploadsRoot + path.sep);
  const normalizedPath = path.normalize(absolutePath);

  if (!normalizedPath.startsWith(normalizedRoot) && normalizedPath !== path.normalize(uploadsRoot)) {
    throw new Error('Invalid storage key');
  }

  return absolutePath;
}

export async function deleteStoredFile(storageKey: string): Promise<void> {
  try {
    await fs.unlink(resolveStoragePath(storageKey));
  } catch {
    // Best-effort cleanup
  }
}
