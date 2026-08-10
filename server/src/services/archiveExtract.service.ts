import {
  getFilenameExtension,
  isAllowedUploadFilename,
  isArchiveFilename,
} from '@ayetis/shared';
import AdmZip from 'adm-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createExtractorFromFile } from 'node-unrar-js';
import Seven from 'node-7z';
import sevenBin from '7zip-bin';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

export interface ExtractedMember {
  originalName: string;
  relativePath: string;
  tempPath: string;
  sizeBytes: number;
  mimeType: string;
}

const SKIP_NAME_RE = /(^|\/)(\.|__MACOSX|Thumbs\.db|desktop\.ini)/i;
const MAX_EXTRACTED_FILES = Number(process.env.MAX_ARCHIVE_MEMBERS ?? 200);
const MAX_TOTAL_EXTRACT_BYTES = Number(
  process.env.MAX_ARCHIVE_EXTRACT_BYTES ?? env.maxUploadBytes * 4,
);

function guessMime(filename: string): string {
  const ext = getFilenameExtension(filename);
  const map: Record<string, string> = {
    '.stl': 'model/stl',
    '.obj': 'model/obj',
    '.ply': 'model/ply',
    '.dcm': 'application/dicom',
    '.dicom': 'application/dicom',
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.bmp': 'image/bmp',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.wmv': 'video/x-ms-wmv',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
  };
  return map[ext] || 'application/octet-stream';
}

function sanitizeMemberName(entryPath: string): string {
  const normalized = entryPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const base = path.posix.basename(normalized);
  return base.replace(/[^a-zA-Z0-9._\-\s()+]/g, '_').trim() || 'extracted.bin';
}

function shouldSkipEntry(entryPath: string): boolean {
  const normalized = entryPath.replace(/\\/g, '/');
  if (!normalized || normalized.endsWith('/')) return true;
  if (SKIP_NAME_RE.test(normalized)) return true;
  if (normalized.includes('..')) return true;
  if (isArchiveFilename(normalized)) return true; // no nested archives
  return false;
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ayetis-extract-'));
  try {
    return await fn(dir);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function extractZip(archivePath: string, outDir: string): Promise<string[]> {
  const zip = new AdmZip(archivePath);
  const written: string[] = [];
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || shouldSkipEntry(entry.entryName)) continue;
    const name = sanitizeMemberName(entry.entryName);
    if (!isAllowedUploadFilename(name)) continue;
    const target = path.join(outDir, `${written.length}-${name}`);
    fs.writeFileSync(target, entry.getData());
    written.push(target);
  }
  return written;
}

async function extractRar(archivePath: string, outDir: string): Promise<string[]> {
  const extractor = await createExtractorFromFile({
    filepath: archivePath,
    targetPath: outDir,
  });
  const extracted = extractor.extract();
  const files: string[] = [];
  // node-unrar-js returns file headers; walk output dir
  void extracted;
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_NAME_RE.test(entry.name)) continue;
        await walk(full);
        continue;
      }
      if (shouldSkipEntry(entry.name) || isArchiveFilename(entry.name)) continue;
      if (!isAllowedUploadFilename(entry.name)) continue;
      files.push(full);
    }
  };
  await walk(outDir);
  return files;
}

function extract7z(archivePath: string, outDir: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const stream = Seven.extractFull(archivePath, outDir, {
      $bin: sevenBin.path7za,
      recursive: true,
    });
    stream.on('end', async () => {
      try {
        const files: string[] = [];
        const walk = async (dir: string): Promise<void> => {
          for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              if (SKIP_NAME_RE.test(entry.name)) continue;
              await walk(full);
              continue;
            }
            if (shouldSkipEntry(entry.name) || isArchiveFilename(entry.name)) continue;
            if (!isAllowedUploadFilename(entry.name)) continue;
            files.push(full);
          }
        };
        await walk(outDir);
        resolve(files);
      } catch (error) {
        reject(error);
      }
    });
    stream.on('error', reject);
  });
}

/**
 * Extract ZIP/RAR/7Z into temp files. Caller must persist then cleanup is automatic.
 * Returns members copied into a fresh temp dir owned by this call until GC via withTempDir —
 * we keep temp files until caller finishes by returning paths under a long-lived staging dir.
 */
export async function extractArchiveMembers(input: {
  archivePath: string;
  originalName: string;
}): Promise<{ members: ExtractedMember[]; cleanup: () => Promise<void> }> {
  if (!isArchiveFilename(input.originalName)) {
    throw new AppError('Not an archive file', 400);
  }

  const staging = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ayetis-archive-'));
  const cleanup = async () => {
    await fs.promises.rm(staging, { recursive: true, force: true }).catch(() => undefined);
  };

  try {
    const ext = getFilenameExtension(input.originalName);
    let paths: string[] = [];
    if (ext === '.zip') {
      paths = await extractZip(input.archivePath, staging);
    } else if (ext === '.rar') {
      const rarOut = path.join(staging, 'rar');
      await fs.promises.mkdir(rarOut, { recursive: true });
      paths = await extractRar(input.archivePath, rarOut);
    } else if (ext === '.7z') {
      const sevenOut = path.join(staging, '7z');
      await fs.promises.mkdir(sevenOut, { recursive: true });
      paths = await extract7z(input.archivePath, sevenOut);
    } else {
      throw new AppError(`Unsupported archive type: ${ext}`, 400);
    }

    if (!paths.length) {
      throw new AppError(
        `Archive ${input.originalName} contained no supported files after extraction`,
        400,
      );
    }

    if (paths.length > MAX_EXTRACTED_FILES) {
      throw new AppError(
        `Archive has too many files (max ${MAX_EXTRACTED_FILES})`,
        400,
      );
    }

    let total = 0;
    const members: ExtractedMember[] = [];
    for (const tempPath of paths) {
      const stat = await fs.promises.stat(tempPath);
      total += stat.size;
      if (total > MAX_TOTAL_EXTRACT_BYTES) {
        throw new AppError('Extracted archive exceeds maximum allowed size', 400);
      }
      const originalName = path.basename(tempPath).replace(/^\d+-/, '');
      members.push({
        originalName,
        relativePath: originalName,
        tempPath,
        sizeBytes: stat.size,
        mimeType: guessMime(originalName),
      });
    }

    return { members, cleanup };
  } catch (error) {
    await cleanup();
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Unable to extract archive ${input.originalName}: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
      400,
    );
  }
}

/** @internal testing helper */
export const __archiveInternals = { shouldSkipEntry, sanitizeMemberName, withTempDir };
