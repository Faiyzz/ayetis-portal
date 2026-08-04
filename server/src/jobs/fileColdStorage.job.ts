import { Case } from '../models/Case';
import { env } from '../config/env';
import {
  archiveIfDue,
  copyLifecycleToDelivery,
  copyLifecycleToFile,
  lifecycleFromDelivery,
  lifecycleFromFile,
  markCaseModified,
  purgeIfDue,
  syncRestoreStatus,
} from '../services/fileLifecycle.service';

const BATCH = 40;

export async function runFileColdStorageSweep(): Promise<void> {
  if (!env.fileColdStorageEnabled) return;

  const restoring = await Case.find({
    $or: [
      { 'files.storageTier': 'restoring' },
      { 'delivery.storageTier': 'restoring' },
    ],
  })
    .limit(BATCH)
    .exec();

  for (const caseDoc of restoring) {
    let dirty = false;
    for (const file of caseDoc.files) {
      if (file.storageTier !== 'restoring' || !file.storageKey) continue;
      const fields = lifecycleFromFile(file);
      await syncRestoreStatus(fields, file.storageKey);
      if (fields.storageTier !== file.storageTier || fields.restoreStatus !== file.restoreStatus) {
        copyLifecycleToFile(file, fields);
        dirty = true;
      }
    }
    if (caseDoc.delivery?.videoStorageKey && caseDoc.delivery.storageTier === 'restoring') {
      const fields = lifecycleFromDelivery(caseDoc.delivery);
      await syncRestoreStatus(fields, caseDoc.delivery.videoStorageKey);
      if (
        fields.storageTier !== caseDoc.delivery.storageTier ||
        fields.restoreStatus !== caseDoc.delivery.restoreStatus
      ) {
        copyLifecycleToDelivery(caseDoc.delivery, fields);
        dirty = true;
      }
    }
    if (dirty) {
      markCaseModified(caseDoc);
      await caseDoc.save();
    }
  }

  const archiveCutoff = new Date();
  const hotDue = await Case.find({
    $or: [
      {
        files: {
          $elemMatch: {
            storageTier: 'hot',
            hotUntil: { $lte: archiveCutoff },
          },
        },
      },
      {
        'delivery.storageTier': 'hot',
        'delivery.hotUntil': { $lte: archiveCutoff },
        'delivery.videoStorageKey': { $exists: true, $ne: null },
      },
      {
        files: {
          $elemMatch: {
            $or: [{ storageTier: { $exists: false } }, { storageTier: 'hot' }],
            hotUntil: { $exists: false },
            createdAt: {
              $lte: new Date(Date.now() - env.fileHotDays * 24 * 60 * 60 * 1000),
            },
          },
        },
      },
    ],
  })
    .limit(BATCH)
    .exec();

  for (const caseDoc of hotDue) {
    let dirty = false;
    for (const file of caseDoc.files) {
      if (!file.storageKey) continue;
      const fields = lifecycleFromFile(file);
      if (!fields.hotUntil && file.createdAt) {
        fields.hotUntil = new Date(
          file.createdAt.getTime() + env.fileHotDays * 24 * 60 * 60 * 1000,
        );
      }
      const archived = await archiveIfDue(fields, file.storageKey);
      if (archived) {
        copyLifecycleToFile(file, fields);
        dirty = true;
      }
    }
    if (caseDoc.delivery?.videoStorageKey) {
      const fields = lifecycleFromDelivery(caseDoc.delivery);
      if (!fields.hotUntil && caseDoc.delivery.uploadedAt) {
        fields.hotUntil = new Date(
          caseDoc.delivery.uploadedAt.getTime() + env.fileHotDays * 24 * 60 * 60 * 1000,
        );
      }
      const archived = await archiveIfDue(fields, caseDoc.delivery.videoStorageKey);
      if (archived) {
        copyLifecycleToDelivery(caseDoc.delivery, fields);
        dirty = true;
      }
    }
    if (dirty) {
      markCaseModified(caseDoc);
      await caseDoc.save();
    }
  }

  if (env.fileColdDeleteAfterDays > 0) {
    const deleteCutoff = new Date(
      Date.now() - env.fileColdDeleteAfterDays * 24 * 60 * 60 * 1000,
    );
    const coldDue = await Case.find({
      $or: [
        {
          files: {
            $elemMatch: {
              storageTier: 'cold',
              coldSince: { $lte: deleteCutoff },
            },
          },
        },
        {
          'delivery.storageTier': 'cold',
          'delivery.coldSince': { $lte: deleteCutoff },
        },
      ],
    })
      .limit(BATCH)
      .exec();

    for (const caseDoc of coldDue) {
      let dirty = false;
      for (const file of caseDoc.files) {
        if (file.storageTier !== 'cold' || !file.storageKey) continue;
        const fields = lifecycleFromFile(file);
        const purged = await purgeIfDue(fields, file.storageKey);
        if (purged) {
          copyLifecycleToFile(file, fields);
          dirty = true;
        }
      }
      if (caseDoc.delivery?.videoStorageKey && caseDoc.delivery.storageTier === 'cold') {
        const fields = lifecycleFromDelivery(caseDoc.delivery);
        const purged = await purgeIfDue(fields, caseDoc.delivery.videoStorageKey);
        if (purged) {
          copyLifecycleToDelivery(caseDoc.delivery, fields);
          dirty = true;
        }
      }
      if (dirty) {
        markCaseModified(caseDoc);
        await caseDoc.save();
      }
    }
  }
}

let cronTimer: ReturnType<typeof setInterval> | null = null;

/** Lightweight hourly scheduler — no extra npm dependency. */
export function startFileColdStorageJobs(): void {
  if (!env.fileColdStorageEnabled) {
    console.log('[cold-storage] disabled');
    return;
  }

  const run = () => {
    void runFileColdStorageSweep().catch((err) => {
      console.error('[cold-storage] sweep failed', err);
    });
  };

  setTimeout(run, 15_000);
  if (cronTimer) clearInterval(cronTimer);
  cronTimer = setInterval(run, 60 * 60 * 1000);
  console.log(
    `[cold-storage] job started (hotDays=${env.fileHotDays}, class=${env.fileColdStorageClass}, restoreTier=${env.fileRestoreTier}, deleteAfter=${env.fileColdDeleteAfterDays})`,
  );
}
