import {
  type ActivityLogDto,
  type AuditAction,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { AUDIT_ACTION_OPTIONS, fetchActivityLogs } from '@/features/audit/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function ActionBadge({ action }: { action: AuditAction }) {
  const failed = action.includes('failed');
  const auth = action.startsWith('auth.');

  const styles = failed
    ? 'bg-red-50 text-red-700'
    : auth
      ? 'bg-brand-50 text-brand-700'
      : 'bg-slate-100 text-slate-700';

  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${styles}`}>
      {action}
    </span>
  );
}

export function ActivityLogPage() {
  const [items, setItems] = useState<ActivityLogDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [action, setAction] = useState<AuditAction | ''>('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(nextPage = page) {
    setLoading(true);
    setError('');
    try {
      const data = await fetchActivityLogs({
        page: nextPage,
        pageSize,
        action,
        q,
        from,
        to,
      });
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to load activity log');
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Activity log"
        subtitle="Audit user logins and important system activity across the portal."
      />

      <form
        onSubmit={handleFilter}
        className="grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_220px_160px_160px_auto]"
      >
        <TextField
          label="Search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Email, name, or summary"
        />
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Action</span>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as AuditAction | '')}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          >
            <option value="">All actions</option>
            {AUDIT_ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
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
        <div className="flex items-end">
          <AuthButton loading={loading}>Apply</AuthButton>
        </div>
      </form>

      {error ? <Alert>{error}</Alert> : null}

      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Summary</th>
                <th className="px-4 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-muted">
                    Loading activity…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-muted">
                    No activity found for this filter.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {formatWhen(item.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-medium text-ink">{item.actionLabel}</p>
                        <ActionBadge action={item.action} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{item.actorName ?? '—'}</p>
                      <p className="text-muted">{item.actorEmail ?? 'Unknown'}</p>
                    </td>
                    <td className="max-w-md px-4 py-3 text-ink">{item.summary}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {item.ipAddress ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted">
          <span>
            {total} event{total === 1 ? '' : 's'} · Page {page} of {totalPages}
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
