import {
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  type CaseListItemDto,
} from '@ayetis/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCases } from '@/features/cases/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

export function DesignerDashboard({ firstName }: { firstName: string }) {
  const [items, setItems] = useState<CaseListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchCases({ page: 1, pageSize: 20 });
        setItems(data.items);
        setTotal(data.total);
      } catch (err) {
        toast().error(getErrorMessage(err, 'Unable to load assigned cases'));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-line bg-white px-5 py-5 sm:px-6">
        <p className="text-sm font-medium text-brand-600">Designer portal</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
          Welcome, {firstName}
        </h1>
        <p className="mt-1.5 text-[15px] text-muted">
          Cases assigned to you appear here. Open a case to download files, review instructions, or
          raise a clarification.
        </p>
      </header>

      <section className="rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">My assigned cases</h2>
            <p className="mt-1 text-sm text-muted">
              {loading ? 'Loading…' : `${total} case${total === 1 ? '' : 's'} in your queue`}
            </p>
          </div>
          <Link
            to="/app/cases"
            className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-brand-300"
          >
            Full listing
          </Link>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-muted">Loading assigned cases…</p>
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No cases assigned yet. Once a coordinator assigns work to you, it will show up here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link
                    to={`/app/cases/${item.caseId}`}
                    className="font-semibold text-brand-700 hover:text-brand-800"
                  >
                    {item.caseId}
                  </Link>
                  <p className="text-sm text-ink">{item.patientName}</p>
                  <p className="line-clamp-1 text-xs text-muted">{item.treatmentSummary}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-md bg-brand-50 px-2 py-1 font-medium text-brand-700">
                    {CASE_STATUS_LABELS[item.status]}
                  </span>
                  <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
                    {CASE_PRIORITY_LABELS[item.priority]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
