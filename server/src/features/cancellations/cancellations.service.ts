import {
  AUDIT_ACTIONS,
  ALL_REFUND_STATUSES,
  REFUND_STATUSES,
  isRefundStatus,
  type RefundStatus,
} from '@ayetis/shared';
import { CancellationAudit, type ICancellationAudit } from '../../models/CancellationAudit';
import { AppError } from '../../utils/AppError';
import {
  recordActivity,
  type RequestAuditContext,
} from '../audit/audit.service';

export interface CancellationReportQuery {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  caseId?: string;
  doctorId?: string;
  caseCategory?: string;
  refundStatus?: string;
  q?: string;
}

function toDto(doc: ICancellationAudit) {
  return {
    id: doc.id,
    caseId: doc.caseId,
    patientName: doc.patientName,
    doctorName: doc.doctorName,
    doctorDisplayId: doc.doctorDisplayId ?? null,
    companyName: doc.companyName ?? null,
    accountType: doc.accountType ?? null,
    caseCategory: doc.caseCategory ?? null,
    caseType: doc.caseType ?? null,
    treatmentPlanName: doc.treatmentPlanName ?? null,
    caseValue: doc.caseValue ?? null,
    invoiceNumber: doc.invoiceNumber ?? null,
    paymentStatus: doc.paymentStatus ?? null,
    refundAmount: doc.refundAmount,
    refundStatus: doc.refundStatus,
    cancellationReason: doc.cancellationReason,
    cancellationRemarks: doc.cancellationRemarks ?? null,
    statusAtCancellation: doc.statusAtCancellation,
    submittedAt: doc.submittedAt ? doc.submittedAt.toISOString() : null,
    cancelledAt: doc.cancelledAt.toISOString(),
    remainingWindowSeconds: doc.remainingWindowSeconds,
    cancelledByName: doc.cancelledByName,
    cancelledByEmail: doc.cancelledByEmail ?? null,
    paymentTransactionReference: doc.paymentTransactionReference ?? null,
    refundTransactionReference: doc.refundTransactionReference ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function listCancellationAudits(query: CancellationReportQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));
  const filter: Record<string, unknown> = {};

  if (query.from || query.to) {
    const cancelledAt: Record<string, Date> = {};
    if (query.from) cancelledAt.$gte = new Date(query.from);
    if (query.to) cancelledAt.$lte = new Date(query.to);
    filter.cancelledAt = cancelledAt;
  }
  if (query.caseId) filter.caseId = query.caseId;
  if (query.doctorId) filter.doctorUserId = query.doctorId;
  if (query.caseCategory) filter.caseCategory = query.caseCategory;
  if (query.refundStatus && isRefundStatus(query.refundStatus)) {
    filter.refundStatus = query.refundStatus;
  }
  if (query.q?.trim()) {
    const term = query.q.trim();
    filter.$or = [
      { caseId: { $regex: term, $options: 'i' } },
      { patientName: { $regex: term, $options: 'i' } },
      { doctorName: { $regex: term, $options: 'i' } },
      { doctorDisplayId: { $regex: term, $options: 'i' } },
      { cancellationReason: { $regex: term, $options: 'i' } },
      { invoiceNumber: { $regex: term, $options: 'i' } },
    ];
  }

  const [items, total, aggregates] = await Promise.all([
    CancellationAudit.find(filter)
      .sort({ cancelledAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    CancellationAudit.countDocuments(filter),
    CancellationAudit.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalCancelled: { $sum: 1 },
          totalRefundAmount: { $sum: '$refundAmount' },
          refundsPending: {
            $sum: {
              $cond: [{ $eq: ['$refundStatus', REFUND_STATUSES.PENDING] }, 1, 0],
            },
          },
          refundsProcessed: {
            $sum: {
              $cond: [{ $eq: ['$refundStatus', REFUND_STATUSES.PROCESSED] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  const summary = aggregates[0] ?? {
    totalCancelled: 0,
    totalRefundAmount: 0,
    refundsPending: 0,
    refundsProcessed: 0,
  };

  return {
    items: items.map(toDto),
    total,
    page,
    pageSize,
    summary: {
      totalCancelled: summary.totalCancelled,
      totalRefundAmount: summary.totalRefundAmount,
      refundsPending: summary.refundsPending,
      refundsProcessed: summary.refundsProcessed,
      refundStatuses: ALL_REFUND_STATUSES,
    },
  };
}

export async function updateCancellationRefund(
  id: string,
  input: { refundStatus: RefundStatus; refundTransactionReference?: string },
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
) {
  const doc = await CancellationAudit.findById(id);
  if (!doc) throw new AppError('Cancellation audit not found', 404);

  doc.refundStatus = input.refundStatus;
  if (input.refundTransactionReference !== undefined) {
    doc.refundTransactionReference = input.refundTransactionReference;
  }
  await doc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CANCELLATION_REFUND_UPDATE,
    summary: `${actor.email} set refund status ${input.refundStatus} for ${doc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'case',
    targetId: doc.caseId,
    metadata: { refundStatus: input.refundStatus },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return toDto(doc);
}

export async function exportCancellationCsv(query: CancellationReportQuery): Promise<string> {
  const data = await listCancellationAudits({ ...query, page: 1, pageSize: 5000 });
  const headers = [
    'Case ID',
    'Patient',
    'Doctor',
    'Doctor ID',
    'Category',
    'Type',
    'Case Value',
    'Refund Amount',
    'Refund Status',
    'Reason',
    'Status at Cancel',
    'Submitted At',
    'Cancelled At',
    'Remaining Window (s)',
    'Cancelled By',
    'Invoice',
  ];
  const rows = data.items.map((item) =>
    [
      item.caseId,
      item.patientName,
      item.doctorName,
      item.doctorDisplayId ?? '',
      item.caseCategory ?? '',
      item.caseType ?? '',
      item.caseValue ?? '',
      item.refundAmount,
      item.refundStatus,
      item.cancellationReason,
      item.statusAtCancellation,
      item.submittedAt ?? '',
      item.cancelledAt,
      item.remainingWindowSeconds,
      item.cancelledByName,
      item.invoiceNumber ?? '',
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}
