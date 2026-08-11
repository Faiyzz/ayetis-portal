import {
  ALL_CANCELLATION_TREND_GRANULARITIES,
  ALL_CASE_CATEGORIES,
  ALL_PAYMENT_STATUSES,
  ALL_REFUND_STATUSES,
  CASE_CATEGORY_LABELS,
  PAYMENT_STATUS_LABELS,
  PERMISSIONS,
  REFUND_STATUS_LABELS,
  type CancellationAuditDto,
  type CancellationReportSummary,
  type CancellationTrendGranularity,
  type CancellationTrendPoint,
  type RefundStatus,
} from '@ayetis/shared';
import { useEffect, useMemo, useState, Fragment, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import {
  exportCancellationCsv,
  exportCancellationExcel,
  fetchCancellationAudits,
  openCancellationPrintHtml,
  updateCancellationRefund,
} from '@/features/cancellations/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

function formatWhen(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function money(amount: number, currency = 'USD') {
  return `${currency} ${amount.toFixed(2)}`;
}

function TrendChart({ trends }: { trends: CancellationTrendPoint[] }) {
  const max = Math.max(1, ...trends.map((t) => t.cancelled));
  if (trends.length === 0) {
    return <p className="text-sm text-muted">No trend data for this filter window.</p>;
  }
  return (
    <div className="space-y-2">
      {trends.map((point) => (
        <div key={point.period} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2 text-sm">
          <span className="truncate font-mono text-xs text-muted" title={point.label}>
            {point.label}
          </span>
          <div className="h-3 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${(point.cancelled / max) * 100}%` }}
            />
          </div>
          <span className="w-20 text-right text-xs text-ink">
            {point.cancelled}
            <span className="text-muted"> / {point.refundAmount.toFixed(0)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-2 border-b border-line/60 py-1.5 text-xs last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="break-all text-ink">{value || '—'}</dd>
    </div>
  );
}

const EMPTY_SUMMARY: CancellationReportSummary = {
  totalCancelled: 0,
  totalCasesInPeriod: 0,
  cancellationPercent: 0,
  totalCaseValue: 0,
  totalRefundAmount: 0,
  refundedAmount: 0,
  pendingRefundAmount: 0,
  refundsPending: 0,
  refundsProcessed: 0,
  refundsApproved: 0,
  refundsRejected: 0,
};

export function CancellationReportPage() {
  const { can } = usePermissions();
  const canUpdateRefund = can(PERMISSIONS.CANCELLATION_REFUND_UPDATE);

  const [items, setItems] = useState<CancellationAuditDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [coordinatorId, setCoordinatorId] = useState('');
  const [treatmentPlanName, setTreatmentPlanName] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [caseCategory, setCaseCategory] = useState('');
  const [refundStatus, setRefundStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [trend, setTrend] = useState<CancellationTrendGranularity>('month');
  const [summary, setSummary] = useState<CancellationReportSummary>(EMPTY_SUMMARY);
  const [trends, setTrends] = useState<CancellationTrendPoint[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const filterPayload = useMemo(
    () => ({
      q,
      from,
      to,
      companyName,
      doctorId,
      coordinatorId,
      treatmentPlanName,
      cancellationReason,
      caseCategory,
      refundStatus,
      paymentStatus,
      trend,
    }),
    [
      q,
      from,
      to,
      companyName,
      doctorId,
      coordinatorId,
      treatmentPlanName,
      cancellationReason,
      caseCategory,
      refundStatus,
      paymentStatus,
      trend,
    ],
  );

  async function load(nextPage = page) {
    setLoading(true);
    setError('');
    try {
      const data = await fetchCancellationAudits({
        page: nextPage,
        pageSize,
        ...filterPayload,
      });
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
      setSummary(data.summary);
      setTrends(data.trends);
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to load cancellation report');
      setError(message);
      toast().error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilter(event: FormEvent) {
    event.preventDefault();
    void load(1);
  }

  async function runExport(kind: 'csv' | 'excel' | 'print') {
    setExporting(true);
    try {
      if (kind === 'csv') {
        await exportCancellationCsv(filterPayload);
        toast().success('CSV downloaded');
      } else if (kind === 'excel') {
        await exportCancellationExcel(filterPayload);
        toast().success('Excel downloaded');
      } else {
        await openCancellationPrintHtml(filterPayload);
        toast().success('Print / PDF view opened');
      }
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to export report'));
    } finally {
      setExporting(false);
    }
  }

  async function handleRefundUpdate(
    id: string,
    next: RefundStatus,
    refundTransactionReference?: string,
  ) {
    try {
      await updateCancellationRefund(id, {
        refundStatus: next,
        refundTransactionReference,
      });
      toast().success('Refund status updated');
      await load(page);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to update refund status'));
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const statCards = [
    { label: 'Cancelled', value: summary.totalCancelled },
    { label: 'Cancel %', value: `${summary.cancellationPercent}%` },
    { label: 'Cases in period', value: summary.totalCasesInPeriod },
    { label: 'Case value', value: summary.totalCaseValue.toFixed(2) },
    { label: 'Refund total', value: summary.totalRefundAmount.toFixed(2) },
    { label: 'Refunded', value: summary.refundedAmount.toFixed(2) },
    { label: 'Pending refund $', value: summary.pendingRefundAmount.toFixed(2) },
    { label: 'Pending count', value: summary.refundsPending },
  ];

  return (
    <div className="space-y-5 print:space-y-3">
      <PageHeader
        eyebrow="Reports"
        title="Cancellation, refund & audit"
        subtitle="20+ tracked fields — filter by company, doctor, coordinator, plan, reason, and payment/refund status."
      >
        <div className="flex flex-wrap gap-2 print:hidden">
          <AuthButton type="button" loading={exporting} onClick={() => void runExport('csv')}>
            Export CSV
          </AuthButton>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void runExport('excel')}
            className="rounded-lg border border-line px-3.5 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Export Excel
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void runExport('print')}
            className="rounded-lg border border-line px-3.5 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Print / PDF
          </button>
        </div>
      </PageHeader>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-line bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-line bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Cancellation trends</h2>
          <label className="flex items-center gap-2 text-sm text-muted print:hidden">
            Bucket
            <select
              value={trend}
              onChange={(e) => setTrend(e.target.value as CancellationTrendGranularity)}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm"
            >
              {ALL_CANCELLATION_TREND_GRANULARITIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void load(page)}
              className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold"
            >
              Refresh
            </button>
          </label>
        </div>
        <TrendChart trends={trends} />
      </section>

      <form
        onSubmit={handleFilter}
        className="grid gap-3 rounded-xl border border-line bg-white p-4 print:hidden md:grid-cols-2 lg:grid-cols-4"
      >
        <TextField
          label="Search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Case, patient, doctor, IP, txn…"
        />
        <TextField
          label="From"
          name="from"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <TextField
          label="To"
          name="to"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <TextField
          label="Company"
          name="company"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
        <TextField
          label="Doctor user ID"
          name="doctorId"
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
        />
        <TextField
          label="Coordinator user ID"
          name="coordinatorId"
          value={coordinatorId}
          onChange={(e) => setCoordinatorId(e.target.value)}
        />
        <TextField
          label="Treatment plan"
          name="plan"
          value={treatmentPlanName}
          onChange={(e) => setTreatmentPlanName(e.target.value)}
        />
        <TextField
          label="Cancellation reason"
          name="reason"
          value={cancellationReason}
          onChange={(e) => setCancellationReason(e.target.value)}
        />
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Category</span>
          <select
            value={caseCategory}
            onChange={(e) => setCaseCategory(e.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
          >
            <option value="">All</option>
            {ALL_CASE_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {CASE_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Payment status</span>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
          >
            <option value="">All</option>
            {ALL_PAYMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {PAYMENT_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Refund status</span>
          <select
            value={refundStatus}
            onChange={(e) => setRefundStatus(e.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
          >
            <option value="">All</option>
            {ALL_REFUND_STATUSES.map((value) => (
              <option key={value} value={value}>
                {REFUND_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <AuthButton loading={loading}>Apply filters</AuthButton>
        </div>
      </form>

      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="px-3 py-3 font-medium">Case</th>
                <th className="px-3 py-3 font-medium">Company</th>
                <th className="px-3 py-3 font-medium">Doctor</th>
                <th className="px-3 py-3 font-medium">Coordinator</th>
                <th className="px-3 py-3 font-medium">Plan</th>
                <th className="px-3 py-3 font-medium">Reason</th>
                <th className="px-3 py-3 font-medium">Payment</th>
                <th className="px-3 py-3 font-medium">Refund</th>
                <th className="px-3 py-3 font-medium">Window</th>
                <th className="px-3 py-3 font-medium">Cancelled</th>
                <th className="px-3 py-3 font-medium print:hidden" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-muted">
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-muted">
                    No cancellations found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <Fragment key={item.id}>
                    <tr>
                      <td className="px-3 py-3">
                        <Link
                          to={`/app/cases/${item.caseId}`}
                          className="font-semibold text-brand-600 hover:text-brand-700"
                        >
                          {item.caseId}
                        </Link>
                        <p className="text-xs text-muted">{item.patientName}</p>
                      </td>
                      <td className="px-3 py-3 text-muted">{item.companyName || '—'}</td>
                      <td className="px-3 py-3">
                        <p className="text-ink">{item.doctorName}</p>
                        <p className="font-mono text-xs text-muted">
                          {item.doctorDisplayId || '—'}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-muted">{item.coordinatorName || '—'}</td>
                      <td className="px-3 py-3 text-muted">{item.treatmentPlanName || '—'}</td>
                      <td className="px-3 py-3">
                        <p className="text-ink">{item.cancellationReason}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-ink">
                          {item.paymentStatus
                            ? PAYMENT_STATUS_LABELS[
                                item.paymentStatus as keyof typeof PAYMENT_STATUS_LABELS
                              ] ?? item.paymentStatus
                            : '—'}
                        </p>
                        <p className="text-xs text-muted">
                          {item.caseValue != null ? money(item.caseValue, item.currency) : '—'}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-ink">
                          {REFUND_STATUS_LABELS[item.refundStatus]}
                        </p>
                        <p className="text-xs text-muted">
                          {money(item.refundAmount, item.currency)}
                        </p>
                        {canUpdateRefund ? (
                          <select
                            value={item.refundStatus}
                            onChange={(e) =>
                              void handleRefundUpdate(item.id, e.target.value as RefundStatus)
                            }
                            className="mt-1 rounded-lg border border-line bg-white px-2 py-1 text-xs print:hidden"
                          >
                            {ALL_REFUND_STATUSES.map((value) => (
                              <option key={value} value={value}>
                                {REFUND_STATUS_LABELS[value]}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-muted">{item.remainingWindowSeconds}s</td>
                      <td className="px-3 py-3 text-muted">{formatWhen(item.cancelledAt)}</td>
                      <td className="px-3 py-3 print:hidden">
                        <button
                          type="button"
                          className="text-xs font-semibold text-brand-600"
                          onClick={() =>
                            setExpandedId((prev) => (prev === item.id ? null : item.id))
                          }
                        >
                          {expandedId === item.id ? 'Hide' : 'Fields'}
                        </button>
                      </td>
                    </tr>
                    {expandedId === item.id ? (
                      <tr>
                        <td colSpan={11} className="bg-surface/60 px-4 py-3">
                          <dl className="grid gap-x-6 md:grid-cols-2">
                            <DetailRow label="Patient ID" value={item.patientId} />
                            <DetailRow label="Invoice #" value={item.invoiceNumber} />
                            <DetailRow
                              label="Payment txn"
                              value={item.paymentTransactionReference}
                            />
                            <DetailRow
                              label="Refund txn"
                              value={item.refundTransactionReference}
                            />
                            <DetailRow
                              label="Refunded amount"
                              value={money(item.refundedAmount, item.currency)}
                            />
                            <DetailRow
                              label="Pending refund"
                              value={money(item.pendingRefundAmount, item.currency)}
                            />
                            <DetailRow label="Status at cancel" value={item.statusAtCancellation} />
                            <DetailRow label="Case type" value={item.caseType} />
                            <DetailRow label="Account type" value={item.accountType} />
                            <DetailRow label="Submitted" value={formatWhen(item.submittedAt)} />
                            <DetailRow
                              label="Cancelled by"
                              value={`${item.cancelledByName} (${item.cancelledByEmail || '—'}) · ${item.cancelledByRole || '—'}`}
                            />
                            <DetailRow label="Remarks" value={item.cancellationRemarks} />
                            <DetailRow label="IP address" value={item.ipAddress} />
                            <DetailRow label="Device" value={item.deviceSummary} />
                            <DetailRow label="User agent" value={item.userAgent} />
                            <DetailRow label="Organization ID" value={item.organizationId} />
                            <DetailRow label="Facility ID" value={item.facilityId} />
                            <DetailRow label="Audit created" value={formatWhen(item.createdAt)} />
                          </dl>
                          {canUpdateRefund ? (
                            <div className="mt-3 flex flex-wrap items-end gap-2 print:hidden">
                              <label className="block space-y-1.5">
                                <span className="text-sm font-medium text-ink">
                                  Refund transaction reference
                                </span>
                                <input
                                  defaultValue={item.refundTransactionReference ?? ''}
                                  onBlur={(e) => {
                                    const value = e.target.value.trim();
                                    if (
                                      value &&
                                      value !== (item.refundTransactionReference || '')
                                    ) {
                                      void handleRefundUpdate(item.id, item.refundStatus, value);
                                    }
                                  }}
                                  className="w-full min-w-[16rem] rounded-xl border border-line bg-white px-3.5 py-2 text-sm"
                                />
                              </label>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-muted print:hidden">
          <span>
            Page {page} of {totalPages} · {total} total
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => void load(page - 1)}
              className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => void load(page + 1)}
              className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
