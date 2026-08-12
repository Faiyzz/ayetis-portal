/**
 * SLA Warning / Breach monitor — polls open cases and notifies once per threshold.
 */

import {
  CASE_STATUSES,
  EMAIL_TEMPLATE_KEYS,
  NOTIFICATION_TYPES,
} from '@ayetis/shared';
import { env } from '../config/env';
import { Case } from '../models/Case';
import { User } from '../models/User';
import { createNotificationsForUsers } from '../features/notifications/notifications.service';
import { getSlaConfig } from '../features/settings/settings.service';
import { caseEventTemplate, sendCmsOrFallback } from '../services/email';
import { slaUtilizationPercent } from '../utils/businessHours';

const INTERVAL_MS = 60_000;
let timer: NodeJS.Timeout | null = null;

function recipientIds(caseDoc: {
  doctorId?: { toString(): string } | string;
  assignedDesignerId?: { toString(): string } | string | null;
  assignedConsultantId?: { toString(): string } | string | null;
  assignedCutOperatorId?: { toString(): string } | string | null;
}): string[] {
  const ids: string[] = [];
  if (caseDoc.doctorId) ids.push(String(caseDoc.doctorId));
  if (caseDoc.assignedDesignerId) ids.push(String(caseDoc.assignedDesignerId));
  if (caseDoc.assignedConsultantId) ids.push(String(caseDoc.assignedConsultantId));
  if (caseDoc.assignedCutOperatorId) ids.push(String(caseDoc.assignedCutOperatorId));
  return ids;
}

async function emailSla(
  userIds: string[],
  templateKey: string,
  caseId: string,
  headline: string,
  message: string,
) {
  const users = await User.find({ _id: { $in: userIds }, isActive: { $ne: false } }).select(
    'email firstName lastName',
  );
  const portalUrl = `${env.clientUrl}/app/cases/${caseId}`;
  await Promise.all(
    users.map((user) => {
      const recipientName = `${user.firstName} ${user.lastName}`.trim() || user.email;
      return sendCmsOrFallback(
        user.email,
        templateKey,
        { recipientName, caseId, portalUrl },
        caseEventTemplate({
          recipientName,
          subject: `${headline} — Case ${caseId}`,
          headline,
          message,
          caseId,
          portalUrl,
        }),
      ).catch(() => undefined);
    }),
  );
}

export async function runSlaMonitorSweep(): Promise<{ warnings: number; breaches: number }> {
  const cfg = await getSlaConfig();
  const warningPercent = cfg.warningPercent;

  const openCases = await Case.find({
    isDeleted: { $ne: true },
    status: {
      $in: [
        CASE_STATUSES.NEW_CASE,
        CASE_STATUSES.IN_PROCESS,
        CASE_STATUSES.WAITING_FOR_APPROVAL,
      ],
    },
    submittedAt: { $exists: true, $ne: null },
    slaDeadlineAt: { $exists: true, $ne: null },
    $or: [{ slaWarningNotifiedAt: { $exists: false } }, { slaBreachNotifiedAt: { $exists: false } }],
  }).limit(200);

  let warnings = 0;
  let breaches = 0;

  for (const caseDoc of openCases) {
    if (!caseDoc.submittedAt || !caseDoc.slaDeadlineAt) continue;
    const utilization = slaUtilizationPercent(caseDoc.submittedAt, caseDoc.slaDeadlineAt);
    const users = recipientIds(caseDoc);
    if (users.length === 0) continue;

    if (utilization >= 100 && !caseDoc.slaBreachNotifiedAt) {
      caseDoc.slaBreachNotifiedAt = new Date();
      if (!caseDoc.slaWarningNotifiedAt) {
        caseDoc.slaWarningNotifiedAt = caseDoc.slaBreachNotifiedAt;
      }
      await caseDoc.save();
      await createNotificationsForUsers(users, {
        type: NOTIFICATION_TYPES.SLA_BREACH,
        title: 'SLA Breach',
        body: `Case ${caseDoc.caseId} has breached its SLA (${Math.round(utilization)}% utilized).`,
        link: `/app/cases/${caseDoc.caseId}`,
        caseId: caseDoc.caseId,
      });
      await emailSla(
        users,
        EMAIL_TEMPLATE_KEYS.SLA_BREACH,
        caseDoc.caseId,
        'SLA breached',
        `Case ${caseDoc.caseId} has exceeded its SLA.`,
      );
      breaches += 1;
      continue;
    }

    if (
      utilization >= warningPercent &&
      utilization < 100 &&
      !caseDoc.slaWarningNotifiedAt
    ) {
      caseDoc.slaWarningNotifiedAt = new Date();
      await caseDoc.save();
      await createNotificationsForUsers(users, {
        type: NOTIFICATION_TYPES.SLA_WARNING,
        title: 'SLA Warning',
        body: `Case ${caseDoc.caseId} is approaching SLA breach (${Math.round(utilization)}% utilized).`,
        link: `/app/cases/${caseDoc.caseId}`,
        caseId: caseDoc.caseId,
      });
      await emailSla(
        users,
        EMAIL_TEMPLATE_KEYS.SLA_WARNING,
        caseDoc.caseId,
        'SLA warning',
        `Case ${caseDoc.caseId} is approaching its SLA deadline.`,
      );
      warnings += 1;
    }
  }

  return { warnings, breaches };
}

export function startSlaMonitorJobs(): void {
  if (timer) return;
  void runSlaMonitorSweep().catch((err) =>
    console.error('[sla-monitor] initial sweep failed', err),
  );
  timer = setInterval(() => {
    void runSlaMonitorSweep().catch((err) =>
      console.error('[sla-monitor] sweep failed', err),
    );
  }, INTERVAL_MS);
  timer.unref?.();
}
