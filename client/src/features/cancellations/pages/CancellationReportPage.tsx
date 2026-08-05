import {
  ALL_CASE_CATEGORIES,
  ALL_REFUND_STATUSES,
  CASE_CATEGORY_LABELS,
  PERMISSIONS,
  REFUND_STATUS_LABELS,
  type RefundStatus,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import {
  exportCancellationCsv,
  fetchCancellationAudits,
  updateCancellationRefund,
  type CancellationAuditDto,
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
  const [caseCategory, setCaseCategory] = useState('');
  const [refundStatus, setRefundStatus] = useState('');
  const [summary, setSummary] = useState({
    totalCancelled: 0,
    totalRefundAmount: 0,
    refundsPending: 0,
    refundsProcessed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  async function load(nextPage = page) {
    setLoading(true);
    setError('');
    try {
      const data = await fetchCancellationAudits({
        page: nextPage,
        pageSize,
        q,
        from,
        to,
        caseCategory,
        refundStatus,
      });
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
      setSummary({
        totalCancelled: data.summary.totalCancelled,
        totalRefundAmount: data.summary.totalRefundAmount,
        refundsPending: data.summary.refundsPending,
        refundsProcessed: data.summary.refundsProcessed,
      });
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

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await exportCancellationCsv({ q, from, to, caseCategory, refundStatus });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cancellation-audit.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast().success('Export downloaded');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to export CSV'));
    } finally {
      setExporting(false);
    }
  }

  async function handleRefundUpdate(id: string, next: RefundStatus) {
    try {
      await updateCancellationRefund(id, { refundStatus: next });
      toast().success('Refund status updated');
      await load(page);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to update refund status'));
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reports"
        title="Cancellation audit"
        subtitle="Immutable cancellation records with refund status tracking."
      >
        <AuthButton type="button" loading={exporting} onClick={() => void handleExport()}>
          Export CSV
        </AuthButton>
      </PageHeader>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Cancelled', value: summary.totalCancelled },
          { label: 'Refund amount', value: summary.totalRefundAmount.toFixed(2) },
          { label: 'Refunds pending', value: summary.refundsPending },
          { label: 'Refunds processed', value: summary.refundsProcessed },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-line bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{card.value}</p>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleFilter}
        className="grid gap-3 rounded-xl border border-line bg-white p-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto]"
      >
        <TextField
          label="Search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Case, patient, doctor…"
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
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Category</span>
          <select
            value={caseCategory}
            onChange={(e) => setCaseCategory(e.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
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
          <span className="text-sm font-medium text-ink">Refund</span>
          <select
            value={refundStatus}
            onChange={(e) => setRefundStatus(e.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
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
          <AuthButton loading={loading}>Apply</AuthButton>
        </div>
      </form>

      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Case</th>
                <th className="px-4 py-3 font-medium">Doctor</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Refund</th>
                <th className="px-4 py-3 font-medium">Cancelled</th>
                <th className="px-4 py-3 font-medium">Window left</th>
                {canUpdateRefund ? <th className="px-4 py-3 font-medium">Update</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-muted">
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-muted">
                    No cancellations found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <Link
                        to={`/app/cases/${item.caseId}`}
                        className="font-semibold text-brand-600 hover:text-brand-700"
                      >
                        {item.caseId}
                      </Link>
                      <p className="text-xs text-muted">{item.patientName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-ink">{item.doctorName}</p>
                      <p className="font-mono text-xs text-muted">{item.doctorDisplayId || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-ink">{item.cancellationReason}</p>
                      {item.cancellationRemarks ? (
                        <p className="text-xs text-muted">{item.cancellationRemarks}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">
                        {REFUND_STATUS_LABELS[item.refundStatus]}
                      </p>
                      <p className="text-xs text-muted">{item.refundAmount.toFixed(2)}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatWhen(item.cancelledAt)}</td>
                    <td className="px-4 py-3 text-muted">{item.remainingWindowSeconds}s</td>
                    {canUpdateRefund ? (
                      <td className="px-4 py-3">
                        <select
                          value={item.refundStatus}
                          onChange={(e) =>
                            void handleRefundUpdate(item.id, e.target.value as RefundStatus)
                          }
                          className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs"
                        >
                          {ALL_REFUND_STATUSES.map((value) => (
                            <option key={value} value={value}>
                              {REFUND_STATUS_LABELS[value]}
                            </option>
                          ))}
                        </select>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-muted">
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
