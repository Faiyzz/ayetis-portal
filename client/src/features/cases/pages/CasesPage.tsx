import {
  ALL_CASE_PRIORITIES,
  ALL_CASE_STATUSES,
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PERMISSIONS,
  type CaseListItemDto,
  type CasePriority,
  type CaseStatus,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import { fetchCases } from '@/features/cases/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

function StatusPill({ status }: { status: CaseStatus }) {
  const cancelled = status === 'cancelled';
  return (
    <span
      className={[
        'inline-flex rounded-md px-2 py-1 text-xs font-medium',
        cancelled ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-700',
      ].join(' ')}
    >
      {CASE_STATUS_LABELS[status]}
    </span>
  );
}

export function CasesPage() {
  const { can, canAny } = usePermissions();
  const isDoctorView =
    can(PERMISSIONS.CASE_VIEW_OWN) &&
    !canAny(PERMISSIONS.CASE_VIEW_ALL, PERMISSIONS.CASE_VIEW_ASSIGNED);
  const isDesignerView =
    can(PERMISSIONS.CASE_VIEW_ASSIGNED) && !can(PERMISSIONS.CASE_VIEW_ALL);
  const [items, setItems] = useState<CaseListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<CaseStatus | ''>('');
  const [priority, setPriority] = useState<CasePriority | ''>('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load(nextPage = page) {
    setLoading(true);
    try {
      const data = await fetchCases({
        page: nextPage,
        pageSize,
        q,
        status,
        priority,
        includeDeleted: can(PERMISSIONS.CASE_DELETE) ? includeDeleted : false,
      });
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to load cases'));
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cases"
        title={
          isDoctorView
            ? 'My submitted cases'
            : isDesignerView
              ? 'My assigned cases'
              : 'Case listing'
        }
        subtitle={
          isDoctorView
            ? 'Track every case you have submitted in one place — status, priority, and payment.'
            : isDesignerView
              ? 'Cases assigned to you for production. Open a case to review files and instructions.'
              : 'Search and filter cases relevant to your role.'
        }
      >
        {can(PERMISSIONS.CASE_CREATE) ? (
          <Link
            to="/app/cases/new"
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Create case
          </Link>
        ) : null}
      </PageHeader>

      <form
        onSubmit={handleFilter}
        className="grid gap-3 rounded-xl border border-line bg-white p-4 lg:grid-cols-[1.4fr_1fr_1fr_auto]"
      >
        <TextField
          label="Search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Case ID, patient, doctor…"
        />
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CaseStatus | '')}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          >
            <option value="">All statuses</option>
            {ALL_CASE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {CASE_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Priority</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as CasePriority | '')}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          >
            <option value="">All priorities</option>
            {ALL_CASE_PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {CASE_PRIORITY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col justify-end gap-2">
          {can(PERMISSIONS.CASE_DELETE) ? (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
              />
              Include deleted
            </label>
          ) : null}
          <AuthButton loading={loading}>Apply</AuthButton>
        </div>
      </form>

      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Case ID</th>
                <th className="px-4 py-3 font-medium">Patient</th>
                {!isDoctorView && !isDesignerView ? (
                  <th className="px-4 py-3 font-medium">Doctor</th>
                ) : null}
                {!isDoctorView ? <th className="px-4 py-3 font-medium">Assignee</th> : null}
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-muted">
                    Loading cases…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-muted">
                    No cases found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className={item.isDeleted ? 'opacity-60' : undefined}>
                    <td className="px-4 py-3">
                      <Link
                        to={`/app/cases/${item.caseId}`}
                        className="font-semibold text-brand-600 hover:text-brand-700"
                      >
                        {item.caseId}
                      </Link>
                      {item.openClarificationCount > 0 ? (
                        <p className="mt-0.5 text-xs text-amber-700">
                          {item.openClarificationCount} clarification
                          {item.openClarificationCount === 1 ? '' : 's'}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-ink">{item.patientName}</td>
                    {!isDoctorView && !isDesignerView ? (
                      <td className="px-4 py-3">
                        <p className="text-ink">{item.doctorName}</p>
                        <p className="text-xs text-muted">{item.doctorEmail}</p>
                      </td>
                    ) : null}
                    {!isDoctorView ? (
                      <td className="px-4 py-3 text-ink">
                        {item.assignedDesignerName ||
                          (item.assignmentMode === 'auto_queue' ? 'Auto queue' : '—')}
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <StatusPill status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {CASE_PRIORITY_LABELS[item.priority]}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {PAYMENT_STATUS_LABELS[item.paymentStatus]}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {new Date(item.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted">
          <span>
            {total} case{total === 1 ? '' : 's'} · Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => void load(page - 1)}
              className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => void load(page + 1)}
              className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
