export const FILE_STORAGE_TIERS = {
  HOT: 'hot',
  COLD: 'cold',
  RESTORING: 'restoring',
  PURGED: 'purged',
} as const;

export type FileStorageTier = (typeof FILE_STORAGE_TIERS)[keyof typeof FILE_STORAGE_TIERS];

export const ALL_FILE_STORAGE_TIERS: FileStorageTier[] = Object.values(FILE_STORAGE_TIERS);

export const FILE_STORAGE_TIER_LABELS: Record<FileStorageTier, string> = {
  [FILE_STORAGE_TIERS.HOT]: 'Hot',
  [FILE_STORAGE_TIERS.COLD]: 'Cold storage',
  [FILE_STORAGE_TIERS.RESTORING]: 'Restoring…',
  [FILE_STORAGE_TIERS.PURGED]: 'Removed',
};

export const FILE_RESTORE_STATUSES = {
  NONE: 'none',
  PENDING: 'pending',
  AVAILABLE: 'available',
  FAILED: 'failed',
} as const;

export type FileRestoreStatus =
  (typeof FILE_RESTORE_STATUSES)[keyof typeof FILE_RESTORE_STATUSES];

export const ALL_FILE_RESTORE_STATUSES: FileRestoreStatus[] =
  Object.values(FILE_RESTORE_STATUSES);

/** API error code when a cold Glacier object needs restore before download. */
export const FILE_RESTORE_PENDING_CODE = 'FILE_RESTORE_PENDING';

export interface FileStorageStateDto {
  storageTier: FileStorageTier;
  restoreStatus: FileRestoreStatus;
  hotUntil: string | null;
  coldSince: string | null;
  restoreRequestedAt: string | null;
  restoreError: string | null;
}

export function defaultFileStorageState(
  createdAt: Date | string = new Date(),
  hotDays = 30,
): {
  storageTier: FileStorageTier;
  restoreStatus: FileRestoreStatus;
  hotUntil: Date;
} {
  const base = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const hotUntil = new Date(base.getTime() + Math.max(0, hotDays) * 24 * 60 * 60 * 1000);
  return {
    storageTier: FILE_STORAGE_TIERS.HOT,
    restoreStatus: FILE_RESTORE_STATUSES.NONE,
    hotUntil,
  };
}
