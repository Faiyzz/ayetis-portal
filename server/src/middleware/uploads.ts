import type { Request } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { isAllowedUploadFilename } from '@ayetis/shared';
import { env } from '../config/env';
import { getUploadsRoot } from '../services/storage.service';

const tempRoot = path.join(getUploadsRoot(), '.incoming');

function ensureTempRoot() {
  fs.mkdirSync(tempRoot, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    try {
      ensureTempRoot();
      cb(null, tempRoot);
    } catch (error) {
      cb(error as Error, tempRoot);
    }
  },
  filename(_req, file, cb) {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`);
  },
});

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  const mime = (file.mimetype || '').toLowerCase();
  const allowedMime =
    mime.startsWith('image/') ||
    mime.startsWith('video/') ||
    mime === 'application/pdf' ||
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    mime === 'application/x-rar-compressed' ||
    mime === 'application/vnd.rar' ||
    mime === 'application/x-7z-compressed' ||
    mime === 'application/octet-stream' ||
    mime === 'model/stl' ||
    mime === 'model/obj' ||
    mime.includes('stl') ||
    mime.includes('dicom') ||
    mime === 'text/html' ||
    mime === 'text/csv' ||
    mime === 'text/plain';

  if (isAllowedUploadFilename(file.originalname) || allowedMime) {
    cb(null, true);
    return;
  }
  cb(new Error(`Unsupported file type: ${file.originalname}`));
}

/** Disk-backed uploads — streams large STL/OBJ/PDF/video without holding them in RAM. */
export const caseFileUpload = multer({
  storage: diskStorage,
  limits: {
    /** Absolute ceiling; effective limit enforced in assertUploadWithinLimit. */
    fileSize: Math.max(env.maxUploadBytes, 2 * 1024 * 1024 * 1024),
    files: 20,
  },
  fileFilter,
});

export const deliveryVideoUpload = multer({
  storage: diskStorage,
  limits: {
    fileSize: Math.max(env.maxUploadBytes, 2 * 1024 * 1024 * 1024),
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    if (mime.startsWith('video/') || isAllowedUploadFilename(file.originalname)) {
      cb(null, true);
      return;
    }
    cb(new Error('Delivery upload must be a video file'));
  },
});

export async function assertUploadWithinLimit(files: Express.Multer.File | Express.Multer.File[] | undefined) {
  const { resolveMaxUploadBytes } = await import('../features/settings/settings.service');
  const max = await resolveMaxUploadBytes();
  const list = !files ? [] : Array.isArray(files) ? files : [files];
  for (const file of list) {
    if (file.size > max) {
      throw new Error(
        `File ${file.originalname} exceeds configured maximum of ${Math.round(max / (1024 * 1024))} MB`,
      );
    }
  }
}
