import {
  AUDIT_ACTIONS,
  CASE_CANCEL_WINDOW_MINUTES,
  CASE_FIELD_LABELS,
  CASE_STATUSES,
} from '@ayetis/shared';
import { Types } from 'mongoose';
import { recordActivity } from '../features/audit/audit.service';
import { Case } from '../models/Case';

const INTERVAL_MS = 60_000;
let timer: NodeJS.Timeout | null = null;

export async function runCaseLifecycleSweep(): Promise<number> {
  const cutoff = new Date(Date.now() - CASE_CANCEL_WINDOW_MINUTES * 60 * 1000);
  const due = await Case.find({
    status: CASE_STATUSES.NEW_CASE,
    isDeleted: { $ne: true },
    submittedAt: { $lte: cutoff },
  }).limit(100);

  let moved = 0;
  for (const caseDoc of due) {
    const from = caseDoc.status;
    caseDoc.status = CASE_STATUSES.IN_PROCESS;
    caseDoc.history.push({
      _id: new Types.ObjectId(),
      action: 'auto_in_process',
      summary: `Automatically moved from New Case to In Process after ${CASE_CANCEL_WINDOW_MINUTES} minutes`,
      actorName: 'System',
      metadata: {
        changes: [
          {
            field: 'status',
            label: CASE_FIELD_LABELS.status,
            from,
            to: CASE_STATUSES.IN_PROCESS,
          },
        ],
      },
      createdAt: new Date(),
    } as (typeof caseDoc.history)[number]);

    await caseDoc.save();
    moved += 1;

    await recordActivity({
      action: AUDIT_ACTIONS.CASE_AUTO_IN_PROCESS,
      summary: `Case ${caseDoc.caseId} auto-transitioned to In Process`,
      targetType: 'case',
      targetId: caseDoc.caseId,
      metadata: { previousStatus: from },
    });
  }

  return moved;
}

export function startCaseLifecycleJobs(): void {
  if (timer) return;
  void runCaseLifecycleSweep().catch((err) =>
    console.error('[case-lifecycle] initial sweep failed', err),
  );
  timer = setInterval(() => {
    void runCaseLifecycleSweep().catch((err) =>
      console.error('[case-lifecycle] sweep failed', err),
    );
  }, INTERVAL_MS);
  timer.unref?.();
}
