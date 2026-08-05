import {
  CASE_CATEGORIES,
  CASE_STATUSES,
  CASE_TYPES,
  DEFAULT_SLA_BUSINESS_HOURS,
  LEGACY_STATUS_TO_URD,
} from '@ayetis/shared';
import { Case } from './Case';
import { computeSlaDeadline } from '../utils/businessHours';
import { User } from './User';
import { TreatmentPlan } from './TreatmentPlan';

/**
 * Migrate legacy case statuses → URD statuses, backfill taxonomy / SLA fields.
 * Idempotent — safe on every startup.
 */
export async function migrateCaseManagement(): Promise<void> {
  for (const [legacy, urd] of Object.entries(LEGACY_STATUS_TO_URD)) {
    if (legacy === urd) continue;
    await Case.updateMany({ status: legacy }, { $set: { status: urd } });
  }

  await Case.updateMany(
    { caseCategory: { $exists: false } },
    {
      $set: {
        caseCategory: CASE_CATEGORIES.DIGITAL_ALIGNER,
        caseType: CASE_TYPES.NEW,
      },
    },
  );

  await Case.updateMany(
    {
      status: { $in: [CASE_STATUSES.NEW_CASE, CASE_STATUSES.IN_PROCESS] },
      submittedAt: { $exists: false },
    },
    [{ $set: { submittedAt: '$createdAt' } }],
  );

  const openWithoutSla = await Case.find({
    status: {
      $in: [
        CASE_STATUSES.NEW_CASE,
        CASE_STATUSES.IN_PROCESS,
        CASE_STATUSES.WAITING_FOR_APPROVAL,
      ],
    },
    $or: [{ slaDeadlineAt: { $exists: false } }, { slaDeadlineAt: null }],
  }).limit(500);

  for (const caseDoc of openWithoutSla) {
    const doctor = await User.findById(caseDoc.doctorId).select('slaBusinessHours');
    const hours = doctor?.slaBusinessHours ?? DEFAULT_SLA_BUSINESS_HOURS;
    const start = caseDoc.submittedAt ?? caseDoc.createdAt;
    caseDoc.slaHours = hours;
    caseDoc.slaDeadlineAt = computeSlaDeadline(start, hours);
    if (!caseDoc.submittedAt) caseDoc.submittedAt = start;
    await caseDoc.save();
  }

  const planCount = await TreatmentPlan.countDocuments();
  if (planCount === 0) {
    await TreatmentPlan.create([
      {
        name: 'Setup Review + 3D Printer Ready Files',
        caseCategory: CASE_CATEGORIES.DIGITAL_ALIGNER,
        description: 'Full setup review with printer-ready files',
        price: 250,
        currency: 'USD',
        estimatedDeliveryHours: 48,
        isActive: true,
      },
      {
        name: 'Setup Review Only',
        caseCategory: CASE_CATEGORIES.DIGITAL_ALIGNER,
        description: 'Setup review without printer files',
        price: 150,
        currency: 'USD',
        estimatedDeliveryHours: 48,
        isActive: true,
      },
    ]);
  }
}
