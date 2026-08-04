import {
  FILE_RESTORE_PENDING_CODE,
  FILE_RESTORE_STATUSES,
  FILE_STORAGE_TIERS,
  type FileRestoreStatus,
  type FileStorageTier,
} from '@ayetis/shared';
import { env } from '../config/env';
import type { ICase, ICaseDelivery, ICaseFile } from '../models/Case';
import { AppError } from '../utils/AppError';
import {
  coldStorageEnabled,
  getObjectRestoreState,
  requestObjectRestore,
  storedFileExists,
  transitionLocalToHot,
  transitionToCold,
  deleteStoredFile,
} from './storage.service';

export type StorageLifecycleFields = {
  storageTier: FileStorageTier;
  restoreStatus: FileRestoreStatus;
  hotUntil?: Date;
  coldSince?: Date;
  lastAccessedAt?: Date;
  restoreRequestedAt?: Date;
  restoreError?: string;
};

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export function computeHotUntil(from: Date = new Date()): Date {
  return addDays(from, env.fileHotDays);
}

export function initialHotFields(from: Date = new Date()): StorageLifecycleFields {
  return {
    storageTier: FILE_STORAGE_TIERS.HOT,
    restoreStatus: FILE_RESTORE_STATUSES.NONE,
    hotUntil: computeHotUntil(from),
  };
}

export function normalizeLifecycleFields(
  fields: Partial<StorageLifecycleFields> | null | undefined,
  createdAt?: Date,
): StorageLifecycleFields {
  const created = createdAt ?? new Date();
  const tier = fields?.storageTier ?? FILE_STORAGE_TIERS.HOT;
  return {
    storageTier: tier,
    restoreStatus: fields?.restoreStatus ?? FILE_RESTORE_STATUSES.NONE,
    hotUntil: fields?.hotUntil ?? (tier === FILE_STORAGE_TIERS.HOT ? computeHotUntil(created) : undefined),
    coldSince: fields?.coldSince,
    lastAccessedAt: fields?.lastAccessedAt,
    restoreRequestedAt: fields?.restoreRequestedAt,
    restoreError: fields?.restoreError,
  };
}

export function toLifecycleDto(fields: Partial<StorageLifecycleFields> | null | undefined, createdAt?: Date) {
  const n = normalizeLifecycleFields(fields, createdAt);
  return {
    storageTier: n.storageTier,
    restoreStatus: n.restoreStatus,
    hotUntil: n.hotUntil ? n.hotUntil.toISOString() : null,
    coldSince: n.coldSince ? n.coldSince.toISOString() : null,
    restoreRequestedAt: n.restoreRequestedAt ? n.restoreRequestedAt.toISOString() : null,
    restoreError: n.restoreError ?? null,
  };
}

function applyFields(target: StorageLifecycleFields, patch: Partial<StorageLifecycleFields>) {
  Object.assign(target, patch);
}

/**
 * Ensure object is readable for download/signed URL.
 * Cost rule: never CopyObject Glacier → STANDARD. Temporary restore only on S3.
 * Local: free rename cold → hot.
 */
export async function ensureReadableForDownload(
  fields: StorageLifecycleFields,
  storageKey: string,
): Promise<'allow' | 'pending'> {
  if (!coldStorageEnabled()) {
    fields.lastAccessedAt = new Date();
    return 'allow';
  }

  if (fields.storageTier === FILE_STORAGE_TIERS.PURGED) {
    throw new AppError('File has been removed from cold storage', 410, undefined, 'FILE_PURGED');
  }

  const now = new Date();

  // Still within hot/temporary-restore window
  if (
    fields.storageTier === FILE_STORAGE_TIERS.HOT &&
    (!fields.hotUntil || fields.hotUntil.getTime() > now.getTime())
  ) {
    // Debounce hotUntil refresh (~1h) to avoid write spam / needless DB churn
    const nextHot = computeHotUntil(now);
    if (!fields.hotUntil || fields.hotUntil.getTime() < now.getTime() + 60 * 60 * 1000) {
      fields.hotUntil = nextHot;
    }
    fields.lastAccessedAt = now;
    fields.restoreStatus = FILE_RESTORE_STATUSES.NONE;
    fields.restoreError = undefined;
    return 'allow';
  }

  // Hot window expired in Mongo but not yet archived — still allow while STANDARD/local hot
  if (fields.storageTier === FILE_STORAGE_TIERS.HOT) {
    fields.lastAccessedAt = now;
    fields.hotUntil = computeHotUntil(now);
    return 'allow';
  }

  if (fields.storageTier === FILE_STORAGE_TIERS.RESTORING) {
    const state = await getObjectRestoreState(storageKey);
    if (state === 'available') {
      applyFields(fields, {
        storageTier: FILE_STORAGE_TIERS.HOT,
        restoreStatus: FILE_RESTORE_STATUSES.NONE,
        hotUntil: addDays(now, env.fileRestoreDays),
        lastAccessedAt: now,
        restoreError: undefined,
        coldSince: undefined,
      });
      return 'allow';
    }
    throw new AppError(
      'File restore is still in progress. Try again when status is Hot.',
      409,
      {
        storageTier: fields.storageTier,
        restoreStatus: fields.restoreStatus,
        restoreRequestedAt: fields.restoreRequestedAt?.toISOString() ?? null,
      },
      FILE_RESTORE_PENDING_CODE,
    );
  }

  // COLD
  if (env.storageProvider === 'local') {
    await transitionLocalToHot(storageKey);
    applyFields(fields, {
      storageTier: FILE_STORAGE_TIERS.HOT,
      restoreStatus: FILE_RESTORE_STATUSES.NONE,
      hotUntil: computeHotUntil(now),
      lastAccessedAt: now,
      coldSince: undefined,
      restoreError: undefined,
    });
    return 'allow';
  }

  // S3: request temporary restore (Bulk tier by default — cheapest)
  try {
    await requestObjectRestore(storageKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Restore request failed';
    // Idempotent: restore already in progress is fine
    if (!/RestoreAlreadyInProgress|ongoing restore/i.test(message)) {
      applyFields(fields, {
        restoreStatus: FILE_RESTORE_STATUSES.FAILED,
        restoreError: message,
      });
      throw new AppError(`Unable to start file restore: ${message}`, 502);
    }
  }

  applyFields(fields, {
    storageTier: FILE_STORAGE_TIERS.RESTORING,
    restoreStatus: FILE_RESTORE_STATUSES.PENDING,
    restoreRequestedAt: now,
    restoreError: undefined,
  });

  throw new AppError(
    'File is in cold storage. Restore started — download will be available after Glacier restore completes.',
    409,
    {
      storageTier: FILE_STORAGE_TIERS.RESTORING,
      restoreStatus: FILE_RESTORE_STATUSES.PENDING,
      restoreRequestedAt: now.toISOString(),
    },
    FILE_RESTORE_PENDING_CODE,
  );
}

export async function startRestore(
  fields: StorageLifecycleFields,
  storageKey: string,
): Promise<StorageLifecycleFields> {
  if (fields.storageTier === FILE_STORAGE_TIERS.PURGED) {
    throw new AppError('File has been removed from cold storage', 410, undefined, 'FILE_PURGED');
  }
  if (
    fields.storageTier === FILE_STORAGE_TIERS.HOT &&
    (!fields.hotUntil || fields.hotUntil.getTime() > Date.now())
  ) {
    return fields;
  }
  if (fields.storageTier === FILE_STORAGE_TIERS.RESTORING) {
    return fields;
  }

  const now = new Date();
  if (env.storageProvider === 'local') {
    await transitionLocalToHot(storageKey);
    applyFields(fields, {
      storageTier: FILE_STORAGE_TIERS.HOT,
      restoreStatus: FILE_RESTORE_STATUSES.NONE,
      hotUntil: computeHotUntil(now),
      lastAccessedAt: now,
      coldSince: undefined,
      restoreError: undefined,
    });
    return fields;
  }

  if (!coldStorageEnabled()) {
    applyFields(fields, {
      storageTier: FILE_STORAGE_TIERS.HOT,
      restoreStatus: FILE_RESTORE_STATUSES.NONE,
      hotUntil: computeHotUntil(now),
    });
    return fields;
  }

  try {
    await requestObjectRestore(storageKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Restore request failed';
    if (!/RestoreAlreadyInProgress|ongoing restore/i.test(message)) {
      applyFields(fields, {
        restoreStatus: FILE_RESTORE_STATUSES.FAILED,
        restoreError: message,
      });
      throw new AppError(`Unable to start file restore: ${message}`, 502);
    }
  }

  applyFields(fields, {
    storageTier: FILE_STORAGE_TIERS.RESTORING,
    restoreStatus: FILE_RESTORE_STATUSES.PENDING,
    restoreRequestedAt: now,
    restoreError: undefined,
  });
  return fields;
}

export async function syncRestoreStatus(
  fields: StorageLifecycleFields,
  storageKey: string,
): Promise<StorageLifecycleFields> {
  if (fields.storageTier !== FILE_STORAGE_TIERS.RESTORING) {
    return fields;
  }
  const state = await getObjectRestoreState(storageKey);
  const now = new Date();
  if (state === 'available') {
    applyFields(fields, {
      storageTier: FILE_STORAGE_TIERS.HOT,
      restoreStatus: FILE_RESTORE_STATUSES.NONE,
      hotUntil: addDays(now, env.fileRestoreDays),
      lastAccessedAt: now,
      coldSince: undefined,
      restoreError: undefined,
    });
  } else if (state === 'pending') {
    fields.restoreStatus = FILE_RESTORE_STATUSES.PENDING;
  }
  return fields;
}

export async function archiveIfDue(
  fields: StorageLifecycleFields,
  storageKey: string,
): Promise<boolean> {
  if (!coldStorageEnabled()) return false;
  if (fields.storageTier !== FILE_STORAGE_TIERS.HOT) return false;
  if (!fields.hotUntil || fields.hotUntil.getTime() > Date.now()) return false;
  if (!(await storedFileExists(storageKey))) return false;

  try {
    await transitionToCold(storageKey);
  } catch (err) {
    // Non-AWS / unsupported class: leave hot and skip (no retries loop cost)
    console.warn(
      `[cold-storage] archive skipped for ${storageKey}:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }

  applyFields(fields, {
    storageTier: FILE_STORAGE_TIERS.COLD,
    restoreStatus: FILE_RESTORE_STATUSES.NONE,
    coldSince: new Date(),
    hotUntil: undefined,
    restoreError: undefined,
  });
  return true;
}

export async function purgeIfDue(
  fields: StorageLifecycleFields,
  storageKey: string,
): Promise<boolean> {
  if (!coldStorageEnabled() || env.fileColdDeleteAfterDays <= 0) return false;
  if (fields.storageTier !== FILE_STORAGE_TIERS.COLD || !fields.coldSince) return false;
  const deadline = addDays(fields.coldSince, env.fileColdDeleteAfterDays);
  if (deadline.getTime() > Date.now()) return false;

  await deleteStoredFile(storageKey);
  applyFields(fields, {
    storageTier: FILE_STORAGE_TIERS.PURGED,
    restoreStatus: FILE_RESTORE_STATUSES.NONE,
    restoreError: undefined,
  });
  return true;
}

export function copyLifecycleToFile(file: ICaseFile, fields: StorageLifecycleFields) {
  file.storageTier = fields.storageTier;
  file.restoreStatus = fields.restoreStatus;
  file.hotUntil = fields.hotUntil;
  file.coldSince = fields.coldSince;
  file.lastAccessedAt = fields.lastAccessedAt;
  file.restoreRequestedAt = fields.restoreRequestedAt;
  file.restoreError = fields.restoreError;
}

export function copyLifecycleToDelivery(delivery: ICaseDelivery, fields: StorageLifecycleFields) {
  delivery.storageTier = fields.storageTier;
  delivery.restoreStatus = fields.restoreStatus;
  delivery.hotUntil = fields.hotUntil;
  delivery.coldSince = fields.coldSince;
  delivery.lastAccessedAt = fields.lastAccessedAt;
  delivery.restoreRequestedAt = fields.restoreRequestedAt;
  delivery.restoreError = fields.restoreError;
}

export function lifecycleFromFile(file: ICaseFile): StorageLifecycleFields {
  return normalizeLifecycleFields(file, file.createdAt);
}

export function lifecycleFromDelivery(delivery: ICaseDelivery): StorageLifecycleFields {
  return normalizeLifecycleFields(delivery, delivery.uploadedAt);
}

export function markCaseModified(caseDoc: ICase) {
  caseDoc.markModified('files');
  caseDoc.markModified('delivery');
}
