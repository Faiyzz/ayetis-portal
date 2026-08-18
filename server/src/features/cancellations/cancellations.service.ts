import {
  AUDIT_ACTIONS,
  CANCELLATION_TREND_GRANULARITIES,
  REFUND_STATUSES,
  isCancellationTrendGranularity,
  isPaymentStatus,
  isRefundStatus,
  formatDoctorDisplay,
  type CancellationAuditDto,
  type CancellationReportResult,
  type CancellationReportSummary,
  type CancellationTrendGranularity,
  type CancellationTrendPoint,
  type RefundStatus,
} from '@ayetis/shared';
import { CancellationAudit, type ICancellationAudit } from '../../models/CancellationAudit';
import { Case } from '../../models/Case';
import { PaymentSession } from '../../models/Commercial';
import { AppError } from '../../utils/AppError';
import { refundStripePayment } from '../commercial/paymentProviders';
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
  coordinatorId?: string;
  companyName?: string;
  treatmentPlanName?: string;
  cancellationReason?: string;
  caseCategory?: string;
  refundStatus?: string;
  paymentStatus?: string;
  trend?: string;
  q?: string;
}

type DoctorViewer = { id: string; role: string };

function escapeCsv(cell: unknown): string {
  return `"${String(cell ?? '').replace(/"/g, '""')}"`;
}

function refundedPortion(doc: {
  refundAmount: number;
  refundStatus: RefundStatus;
}): number {
  if (
    doc.refundStatus === REFUND_STATUSES.PROCESSED ||
    doc.refundStatus === REFUND_STATUSES.APPROVED
  ) {
    return doc.refundAmount;
  }
  return 0;
}

function pendingPortion(doc: {
  refundAmount: number;
  refundStatus: RefundStatus;
}): number {
  if (doc.refundStatus === REFUND_STATUSES.PENDING) return doc.refundAmount;
  return 0;
}

export function toDto(doc: ICancellationAudit, viewer?: DoctorViewer): CancellationAuditDto {
  const refundedAmount = refundedPortion(doc);
  const pendingRefundAmount = pendingPortion(doc);
  const doctorName = viewer
    ? formatDoctorDisplay(viewer.role as never, viewer.id, {
        doctorUserId: String(doc.doctorUserId),
        doctorName: doc.doctorName,
        doctorId: doc.doctorDisplayId,
      })
    : doc.doctorDisplayId || 'Doctor';
  return {
    id: doc.id,
    caseId: doc.caseId,
    patientId: doc.patientId ?? null,
    patientName: doc.patientName,
    doctorUserId: String(doc.doctorUserId),
    doctorName,
    doctorDisplayId: doc.doctorDisplayId ?? null,
    coordinatorId: doc.coordinatorId ? String(doc.coordinatorId) : null,
    coordinatorName: doc.coordinatorName ?? null,
    organizationId: doc.organizationId ? String(doc.organizationId) : null,
    companyName: doc.companyName ?? null,
    facilityId: doc.facilityId ? String(doc.facilityId) : null,
    accountType: doc.accountType ?? null,
    caseCategory: doc.caseCategory ?? null,
    caseType: doc.caseType ?? null,
    treatmentPlanName: doc.treatmentPlanName ?? null,
    caseValue: doc.caseValue ?? null,
    currency: doc.currency || 'USD',
    invoiceNumber: doc.invoiceNumber ?? null,
    paymentStatus: doc.paymentStatus ?? null,
    refundAmount: doc.refundAmount,
    refundedAmount,
    pendingRefundAmount,
    refundStatus: doc.refundStatus,
    cancellationReason: doc.cancellationReason,
    cancellationRemarks: doc.cancellationRemarks ?? null,
    statusAtCancellation: doc.statusAtCancellation,
    submittedAt: doc.submittedAt ? doc.submittedAt.toISOString() : null,
    cancelledAt: doc.cancelledAt.toISOString(),
    remainingWindowSeconds: doc.remainingWindowSeconds,
    cancelledById: String(doc.cancelledById),
    cancelledByName: doc.cancelledByName,
    cancelledByEmail: doc.cancelledByEmail ?? null,
    cancelledByRole: doc.cancelledByRole ?? null,
    ipAddress: doc.ipAddress ?? null,
    userAgent: doc.userAgent ?? null,
    deviceSummary: doc.deviceSummary ?? null,
    paymentTransactionReference: doc.paymentTransactionReference ?? null,
    refundTransactionReference: doc.refundTransactionReference ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function buildCancellationFilter(query: CancellationReportQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (query.from || query.to) {
    const cancelledAt: Record<string, Date> = {};
    if (query.from) {
      const from = new Date(query.from);
      if (!Number.isNaN(from.getTime())) cancelledAt.$gte = from;
    }
    if (query.to) {
      const to = new Date(query.to);
      if (!Number.isNaN(to.getTime())) {
        // Inclusive end-of-day when date-only
        if (/^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
          to.setHours(23, 59, 59, 999);
        }
        cancelledAt.$lte = to;
      }
    }
    if (Object.keys(cancelledAt).length) filter.cancelledAt = cancelledAt;
  }
  if (query.caseId) filter.caseId = query.caseId.trim();
  if (query.doctorId) filter.doctorUserId = query.doctorId;
  if (query.coordinatorId) filter.coordinatorId = query.coordinatorId;
  if (query.companyName?.trim()) {
    filter.companyName = { $regex: query.companyName.trim(), $options: 'i' };
  }
  if (query.treatmentPlanName?.trim()) {
    filter.treatmentPlanName = { $regex: query.treatmentPlanName.trim(), $options: 'i' };
  }
  if (query.cancellationReason?.trim()) {
    filter.cancellationReason = { $regex: query.cancellationReason.trim(), $options: 'i' };
  }
  if (query.caseCategory) filter.caseCategory = query.caseCategory;
  if (query.refundStatus && isRefundStatus(query.refundStatus)) {
    filter.refundStatus = query.refundStatus;
  }
  if (query.paymentStatus && isPaymentStatus(query.paymentStatus)) {
    filter.paymentStatus = query.paymentStatus;
  }
  if (query.q?.trim()) {
    const term = query.q.trim();
    filter.$or = [
      { caseId: { $regex: term, $options: 'i' } },
      { patientName: { $regex: term, $options: 'i' } },
      { patientId: { $regex: term, $options: 'i' } },
      { doctorName: { $regex: term, $options: 'i' } },
      { doctorDisplayId: { $regex: term, $options: 'i' } },
      { coordinatorName: { $regex: term, $options: 'i' } },
      { companyName: { $regex: term, $options: 'i' } },
      { treatmentPlanName: { $regex: term, $options: 'i' } },
      { cancellationReason: { $regex: term, $options: 'i' } },
      { invoiceNumber: { $regex: term, $options: 'i' } },
      { paymentTransactionReference: { $regex: term, $options: 'i' } },
      { refundTransactionReference: { $regex: term, $options: 'i' } },
      { ipAddress: { $regex: term, $options: 'i' } },
    ];
  }

  return filter;
}

function dateFormatExpression(granularity: CancellationTrendGranularity) {
  switch (granularity) {
    case CANCELLATION_TREND_GRANULARITIES.DAY:
      return { $dateToString: { format: '%Y-%m-%d', date: '$cancelledAt' } };
    case CANCELLATION_TREND_GRANULARITIES.WEEK:
      return { $dateToString: { format: '%G-W%V', date: '$cancelledAt' } };
    case CANCELLATION_TREND_GRANULARITIES.MONTH:
      return { $dateToString: { format: '%Y-%m', date: '$cancelledAt' } };
    case CANCELLATION_TREND_GRANULARITIES.QUARTER:
      return {
        $concat: [
          { $toString: { $year: '$cancelledAt' } },
          '-Q',
          {
            $toString: {
              $ceil: { $divide: [{ $month: '$cancelledAt' }, 3] },
            },
          },
        ],
      };
    case CANCELLATION_TREND_GRANULARITIES.YEAR:
      return { $dateToString: { format: '%Y', date: '$cancelledAt' } };
    default:
      return { $dateToString: { format: '%Y-%m', date: '$cancelledAt' } };
  }
}

async function buildSummary(
  filter: Record<string, unknown>,
  query: CancellationReportQuery,
): Promise<CancellationReportSummary> {
  const [aggregates] = await CancellationAudit.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalCancelled: { $sum: 1 },
        totalCaseValue: { $sum: { $ifNull: ['$caseValue', 0] } },
        totalRefundAmount: { $sum: '$refundAmount' },
        refundedAmount: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$refundStatus',
                  [REFUND_STATUSES.PROCESSED, REFUND_STATUSES.APPROVED],
                ],
              },
              '$refundAmount',
              0,
            ],
          },
        },
        pendingRefundAmount: {
          $sum: {
            $cond: [{ $eq: ['$refundStatus', REFUND_STATUSES.PENDING] }, '$refundAmount', 0],
          },
        },
        refundsPending: {
          $sum: { $cond: [{ $eq: ['$refundStatus', REFUND_STATUSES.PENDING] }, 1, 0] },
        },
        refundsProcessed: {
          $sum: { $cond: [{ $eq: ['$refundStatus', REFUND_STATUSES.PROCESSED] }, 1, 0] },
        },
        refundsApproved: {
          $sum: { $cond: [{ $eq: ['$refundStatus', REFUND_STATUSES.APPROVED] }, 1, 0] },
        },
        refundsRejected: {
          $sum: { $cond: [{ $eq: ['$refundStatus', REFUND_STATUSES.REJECTED] }, 1, 0] },
        },
      },
    },
  ]);

  const caseFilter: Record<string, unknown> = {};
  if (filter.cancelledAt) {
    caseFilter.submittedAt = filter.cancelledAt;
  }
  if (query.doctorId) caseFilter.doctorId = query.doctorId;
  if (query.caseCategory) caseFilter.caseCategory = query.caseCategory;
  if (query.companyName?.trim()) {
    caseFilter.$or = [
      { practiceName: { $regex: query.companyName.trim(), $options: 'i' } },
      { clinicName: { $regex: query.companyName.trim(), $options: 'i' } },
    ];
  }

  const totalCasesInPeriod = await Case.countDocuments({
    ...caseFilter,
    isDeleted: { $ne: true },
    submittedAt: caseFilter.submittedAt ?? { $exists: true },
  });

  const totalCancelled = aggregates?.totalCancelled ?? 0;
  const cancellationPercent =
    totalCasesInPeriod > 0
      ? Number(((totalCancelled / totalCasesInPeriod) * 100).toFixed(2))
      : totalCancelled > 0
        ? 100
        : 0;

  return {
    totalCancelled,
    totalCasesInPeriod,
    cancellationPercent,
    totalCaseValue: aggregates?.totalCaseValue ?? 0,
    totalRefundAmount: aggregates?.totalRefundAmount ?? 0,
    refundedAmount: aggregates?.refundedAmount ?? 0,
    pendingRefundAmount: aggregates?.pendingRefundAmount ?? 0,
    refundsPending: aggregates?.refundsPending ?? 0,
    refundsProcessed: aggregates?.refundsProcessed ?? 0,
    refundsApproved: aggregates?.refundsApproved ?? 0,
    refundsRejected: aggregates?.refundsRejected ?? 0,
  };
}

async function buildTrends(
  filter: Record<string, unknown>,
  granularity: CancellationTrendGranularity,
): Promise<CancellationTrendPoint[]> {
  const rows = await CancellationAudit.aggregate([
    { $match: filter },
    {
      $group: {
        _id: dateFormatExpression(granularity),
        cancelled: { $sum: 1 },
        refundAmount: { $sum: '$refundAmount' },
        refundedAmount: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$refundStatus',
                  [REFUND_STATUSES.PROCESSED, REFUND_STATUSES.APPROVED],
                ],
              },
              '$refundAmount',
              0,
            ],
          },
        },
        pendingRefundAmount: {
          $sum: {
            $cond: [{ $eq: ['$refundStatus', REFUND_STATUSES.PENDING] }, '$refundAmount', 0],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((row) => ({
    period: String(row._id),
    label: String(row._id),
    cancelled: row.cancelled,
    refundAmount: row.refundAmount,
    refundedAmount: row.refundedAmount,
    pendingRefundAmount: row.pendingRefundAmount,
  }));
}

export async function listCancellationAudits(
  query: CancellationReportQuery,
  viewer?: DoctorViewer,
): Promise<CancellationReportResult> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));
  const filter = buildCancellationFilter(query);
  const trendGranularity: CancellationTrendGranularity =
    query.trend && isCancellationTrendGranularity(query.trend)
      ? query.trend
      : CANCELLATION_TREND_GRANULARITIES.MONTH;

  const [items, total, summary, trends] = await Promise.all([
    CancellationAudit.find(filter)
      .sort({ cancelledAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    CancellationAudit.countDocuments(filter),
    buildSummary(filter, query),
    buildTrends(filter, trendGranularity),
  ]);

  return {
    items: items.map((doc) => toDto(doc, viewer)),
    total,
    page,
    pageSize,
    summary,
    trends,
    trendGranularity,
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

  const next = input.refundStatus;
  const providedRef = input.refundTransactionReference?.trim();

  if (next === REFUND_STATUSES.PROCESSED) {
    const alreadyRefunded = Boolean(doc.refundTransactionReference);
    if (!alreadyRefunded) {
      let stripeRefund: { refundId: string } | null = null;
      const caseDoc = await Case.findById(doc.caseMongoId);
      if (caseDoc?.paymentSessionId) {
        const session = await PaymentSession.findById(caseDoc.paymentSessionId);
        if (session?.stripeSessionId || session?.stripePaymentIntentId) {
          stripeRefund = await refundStripePayment({
            stripeSessionId: session.stripeSessionId,
            stripePaymentIntentId: session.stripePaymentIntentId,
            amount: doc.refundAmount,
          });
        }
      }
      if (stripeRefund) {
        doc.refundTransactionReference = stripeRefund.refundId;
      } else if (providedRef) {
        doc.refundTransactionReference = providedRef;
      } else {
        throw new AppError(
          'Enter a refund transaction reference before marking processed (required when Stripe cannot refund automatically).',
          400,
        );
      }
    } else if (providedRef) {
      doc.refundTransactionReference = providedRef;
    }
  } else if (providedRef) {
    doc.refundTransactionReference = providedRef;
  } else if (input.refundTransactionReference !== undefined) {
    doc.refundTransactionReference = input.refundTransactionReference;
  }

  doc.refundStatus = next;
  await doc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CANCELLATION_REFUND_UPDATE,
    summary: `${actor.email} set refund status ${input.refundStatus} for ${doc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'case',
    targetId: doc.caseId,
    metadata: {
      refundStatus: next,
      refundTransactionReference: doc.refundTransactionReference,
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return toDto(doc, { id: actor.id, role: actor.role });
}

const EXPORT_HEADERS = [
  'Case ID',
  'Patient ID',
  'Patient Name',
  'Doctor',
  'Doctor ID',
  'Coordinator',
  'Company',
  'Account Type',
  'Category',
  'Case Type',
  'Treatment Plan',
  'Case Value',
  'Currency',
  'Invoice #',
  'Payment Status',
  'Payment Txn Ref',
  'Refund Amount',
  'Refunded Amount',
  'Pending Refund Amount',
  'Refund Status',
  'Refund Txn Ref',
  'Cancellation Reason',
  'Remarks',
  'Status at Cancel',
  'Submitted At',
  'Cancelled At',
  'Remaining Window (s)',
  'Cancelled By',
  'Cancelled By Email',
  'Cancelled By Role',
  'IP Address',
  'Device',
  'User Agent',
] as const;

function exportRow(item: CancellationAuditDto): string[] {
  return [
    item.caseId,
    item.patientId ?? '',
    item.patientName,
    item.doctorName,
    item.doctorDisplayId ?? '',
    item.coordinatorName ?? '',
    item.companyName ?? '',
    item.accountType ?? '',
    item.caseCategory ?? '',
    item.caseType ?? '',
    item.treatmentPlanName ?? '',
    item.caseValue != null ? String(item.caseValue) : '',
    item.currency,
    item.invoiceNumber ?? '',
    item.paymentStatus ?? '',
    item.paymentTransactionReference ?? '',
    String(item.refundAmount),
    String(item.refundedAmount),
    String(item.pendingRefundAmount),
    item.refundStatus,
    item.refundTransactionReference ?? '',
    item.cancellationReason,
    item.cancellationRemarks ?? '',
    item.statusAtCancellation,
    item.submittedAt ?? '',
    item.cancelledAt,
    String(item.remainingWindowSeconds),
    item.cancelledByName,
    item.cancelledByEmail ?? '',
    item.cancelledByRole ?? '',
    item.ipAddress ?? '',
    item.deviceSummary ?? '',
    item.userAgent ?? '',
  ];
}

export async function exportCancellationCsv(
  query: CancellationReportQuery,
  viewer?: DoctorViewer,
): Promise<string> {
  const data = await listCancellationAudits({ ...query, page: 1, pageSize: 5000 }, viewer);
  const rows = data.items.map((item) => exportRow(item).map(escapeCsv).join(','));
  return `\uFEFF${[EXPORT_HEADERS.join(','), ...rows].join('\n')}`;
}

/** SpreadsheetML that Excel opens as .xls without external libraries. */
export async function exportCancellationExcel(
  query: CancellationReportQuery,
  viewer?: DoctorViewer,
): Promise<string> {
  const data = await listCancellationAudits({ ...query, page: 1, pageSize: 5000 }, viewer);
  const headerCells = EXPORT_HEADERS.map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join(
    '',
  );
  const body = data.items
    .map((item) => {
      const cells = exportRow(item)
        .map((cell) => {
          const numeric = cell !== '' && !Number.isNaN(Number(cell)) && /^-?\d+(\.\d+)?$/.test(cell);
          return numeric
            ? `<Cell><Data ss:Type="Number">${escapeXml(cell)}</Data></Cell>`
            : `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Cancellations">
  <Table>
   <Row>${headerCells}</Row>
   ${body}
  </Table>
 </Worksheet>
</Workbook>`;
}

export async function exportCancellationHtml(
  query: CancellationReportQuery,
  viewer?: DoctorViewer,
): Promise<string> {
  const data = await listCancellationAudits({ ...query, page: 1, pageSize: 5000 }, viewer);
  const s = data.summary;
  const trendRows = data.trends
    .map(
      (t) =>
        `<tr><td>${escapeXml(t.label)}</td><td>${t.cancelled}</td><td>${t.refundAmount.toFixed(2)}</td><td>${t.refundedAmount.toFixed(2)}</td><td>${t.pendingRefundAmount.toFixed(2)}</td></tr>`,
    )
    .join('');
  const itemRows = data.items
    .map((item) => {
      const cells = exportRow(item)
        .map((c) => `<td>${escapeXml(c)}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Cancellation Audit Report</title>
<style>
  body{font-family:Georgia,serif;color:#111;margin:24px;line-height:1.4}
  h1{font-size:22px;margin:0 0 8px}
  .muted{color:#555;font-size:13px}
  .cards{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0 24px}
  .card{border:1px solid #ccc;padding:10px 14px;min-width:140px}
  .card strong{display:block;font-size:18px}
  table{border-collapse:collapse;width:100%;font-size:11px;margin-top:12px}
  th,td{border:1px solid #ddd;padding:4px 6px;text-align:left;vertical-align:top}
  th{background:#f4f4f4}
  @media print{button{display:none} body{margin:8px}}
</style></head><body>
  <button onclick="window.print()">Print / Save as PDF</button>
  <h1>Case Cancellation Audit Report</h1>
  <p class="muted">Generated ${new Date().toISOString()} · ${data.total} cancellations · trend: ${data.trendGranularity}</p>
  <div class="cards">
    <div class="card"><span class="muted">Cancelled</span><strong>${s.totalCancelled}</strong></div>
    <div class="card"><span class="muted">Cancel %</span><strong>${s.cancellationPercent}%</strong></div>
    <div class="card"><span class="muted">Cases in period</span><strong>${s.totalCasesInPeriod}</strong></div>
    <div class="card"><span class="muted">Refund total</span><strong>${s.totalRefundAmount.toFixed(2)}</strong></div>
    <div class="card"><span class="muted">Refunded</span><strong>${s.refundedAmount.toFixed(2)}</strong></div>
    <div class="card"><span class="muted">Pending refund</span><strong>${s.pendingRefundAmount.toFixed(2)}</strong></div>
  </div>
  <h2>Trends</h2>
  <table><thead><tr><th>Period</th><th>Cancelled</th><th>Refund amt</th><th>Refunded</th><th>Pending</th></tr></thead>
  <tbody>${trendRows || '<tr><td colspan="5">No trend data</td></tr>'}</tbody></table>
  <h2>Audit rows</h2>
  <table><thead><tr>${EXPORT_HEADERS.map((h) => `<th>${escapeXml(h)}</th>`).join('')}</tr></thead>
  <tbody>${itemRows || '<tr><td colspan="33">No rows</td></tr>'}</tbody></table>
</body></html>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function summarizeDevice(userAgent?: string | null): string | null {
  if (!userAgent?.trim()) return null;
  const ua = userAgent;
  const browser =
    /Edg\//.test(ua)
      ? 'Edge'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser';
  const os =
    /Windows/i.test(ua)
      ? 'Windows'
      : /Mac OS/i.test(ua)
        ? 'macOS'
        : /Android/i.test(ua)
          ? 'Android'
          : /iPhone|iPad/i.test(ua)
            ? 'iOS'
            : /Linux/i.test(ua)
              ? 'Linux'
              : 'Unknown OS';
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua) ? 'Mobile' : 'Desktop';
  return `${browser} · ${os} · ${mobile}`;
}
