import {
  ALL_CASE_CATEGORIES,
  CASE_CATEGORY_LABELS,
  CASE_STATUS_LABELS,
  type CaseCategory,
  type CaseListItemDto,
  type DoctorDeliveryQueueItemDto,
  type SlaProgressColor,
} from '@ayetis/shared';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { fetchCases, fetchDoctorDeliveries } from '@/features/cases/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

const SLA_BAR_CLASS: Record<SlaProgressColor, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  blue: 'bg-sky-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
};

export function DoctorDashboard({ firstName }: { firstName: string }) {
  const [items, setItems] = useState<DoctorDeliveryQueueItemDto[]>([]);
  const [cases, setCases] = useState<CaseListItemDto[]>([]);
  const [categoryTab, setCategoryTab] = useState<CaseCategory | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [deliveries, caseList] = await Promise.all([
          fetchDoctorDeliveries(),
          fetchCases({ page: 1, pageSize: 50 }),
        ]);
        setItems(deliveries);
        setCases(caseList.items);
      } catch (err) {
        toast().error(getErrorMessage(err, 'Unable to load doctor dashboard'));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const awaiting = items.filter(
    (item) => item.status === 'waiting_for_approval' && !item.doctorDecision,
  );

  const openCases = useMemo(() => {
    const filtered =
      categoryTab === 'all'
        ? cases
        : cases.filter((c) => c.caseCategory === categoryTab);
    return filtered.filter((c) => c.status !== 'cancelled' && c.status !== 'approved');
  }, [cases, categoryTab]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: cases.length };
    for (const cat of ALL_CASE_CATEGORIES) map[cat] = 0;
    for (const c of cases) {
      if (c.caseCategory) map[c.caseCategory] = (map[c.caseCategory] ?? 0) + 1;
    }
    return map;
  }, [cases]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Doctor portal"
        title={`Welcome, ${firstName}`}
        subtitle="Review delivered cases, track SLA, and continue drafts or new submissions."
      />

      <div className="flex flex-wrap gap-3">
        <Link
          to="/app/cases/new"
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Create case
        </Link>
        <Link
          to="/app/cases"
          className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand-300"
        >
          All my cases
        </Link>
      </div>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">Awaiting your review</h2>
        <p className="mt-1 text-sm text-muted">
          {loading
            ? 'Loading…'
            : `${awaiting.length} delivered case${awaiting.length === 1 ? '' : 's'} ready`}
        </p>
        {loading ? (
          <p className="mt-4 text-sm text-muted">Loading deliveries…</p>
        ) : awaiting.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No deliveries waiting for a decision.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {awaiting.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
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
                  {item.hasDeliveryVideo ? (
                    <span className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-800">
                      Video
                    </span>
                  ) : null}
                  {item.hasDeliveryLink ? (
                    <span className="rounded-md bg-sky-50 px-2 py-1 font-medium text-sky-800">
                      Link
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">My open cases</h2>
            <p className="mt-1 text-sm text-muted">Filter by category and monitor SLA progress.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategoryTab('all')}
              className={[
                'rounded-lg px-3 py-1.5 text-xs font-semibold',
                categoryTab === 'all' ? 'bg-brand-500 text-white' : 'border border-line',
              ].join(' ')}
            >
              All ({counts.all})
            </button>
            {ALL_CASE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryTab(cat)}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-semibold',
                  categoryTab === cat ? 'bg-brand-500 text-white' : 'border border-line',
                ].join(' ')}
              >
                {CASE_CATEGORY_LABELS[cat].split(' ')[0]} ({counts[cat] ?? 0})
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-muted">Loading cases…</p>
        ) : openCases.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No open cases in this category.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {openCases.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link
                    to={`/app/cases/${item.caseId}`}
                    className="font-semibold text-brand-700 hover:text-brand-800"
                  >
                    {item.caseId}
                  </Link>
                  <p className="text-sm text-ink">{item.patientName}</p>
                  <p className="text-xs text-muted">{CASE_STATUS_LABELS[item.status]}</p>
                </div>
                <div className="min-w-[120px]">
                  {item.slaUtilizationPercent != null && item.slaProgressColor ? (
                    <>
                      <div className="h-2 overflow-hidden rounded-full bg-surface">
                        <div
                          className={`h-full rounded-full ${SLA_BAR_CLASS[item.slaProgressColor]}`}
                          style={{
                            width: `${Math.min(100, Math.max(0, item.slaUtilizationPercent))}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-muted">
                        SLA {Math.round(item.slaUtilizationPercent)}%
                      </p>
                    </>
                  ) : (
                    <span className="text-xs text-muted">No SLA</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
