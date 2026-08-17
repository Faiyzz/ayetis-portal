import type { ActivityLogDto } from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { AdminOrgPicker, SelectOrganizationEmpty } from '@/features/corporate/AdminOrgPicker';
import { fetchCorporateAudit } from '@/features/corporate/api';
import { useCorporateOrgId, useIsMainAdmin } from '@/features/corporate/orgContext';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

export function CorporateAuditPage() {
  const isMainAdmin = useIsMainAdmin();
  const orgId = useCorporateOrgId();
  const [items, setItems] = useState<ActivityLogDto[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [company, setCompany] = useState('');

  async function load(nextPage = page) {
    if (isMainAdmin && !orgId) {
      setItems([]);
      setTotal(0);
      setCompany('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchCorporateAudit({
        page: nextPage,
        pageSize: 25,
        q,
        organizationId: orgId,
      });
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
      setCompany(data.companyName);
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to load corporate audit');
      setError(message);
      toast().error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={isMainAdmin ? 'Admin' : 'Corporate'}
        title="Organization audit"
        subtitle={company ? `Activity for ${company}` : 'Company-scoped activity log.'}
      >
        <Link to="/app/corporate/reports" className="text-sm font-medium text-brand-600">
          Reports
        </Link>
      </PageHeader>
      {isMainAdmin ? <AdminOrgPicker /> : null}
      {error ? <Alert>{error}</Alert> : null}
      {isMainAdmin && !orgId ? <SelectOrganizationEmpty /> : null}
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void load(1);
        }}
        className="flex flex-wrap gap-3 rounded-xl border border-line bg-white p-4"
      >
        <div className="min-w-56 flex-1">
          <TextField
            label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Actor, case, summary…"
          />
        </div>
        <div className="self-end">
          <AuthButton loading={loading}>Search</AuthButton>
        </div>
      </form>
      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Summary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-xs text-muted">
                  {new Date(item.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {item.actorName || item.actorEmail || '—'}
                </td>
                <td className="px-4 py-3">{item.actionLabel}</td>
                <td className="px-4 py-3">{item.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && !loading ? (
          <p className="px-4 py-6 text-sm text-muted">No matching activity.</p>
        ) : null}
      </section>
      <p className="text-xs text-muted">
        Page {page} · {total} events
      </p>
    </div>
  );
}
