import {
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  type DesignerPerformanceDto,
  type CaseListItemDto,
  type QcQueueCaseDto,
} from '@ayetis/shared';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  fetchCases,
  fetchDesignerPerformance,
  fetchEscalatedQueue,
} from '@/features/cases/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

function EscalatedList({ items, loading }: { items: QcQueueCaseDto[]; loading: boolean }) {
  if (loading) return <p className="mt-4 text-sm text-muted">Loading escalated cases…</p>;
  if (items.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted">
        No cases escalated after repeated QC rejection.
      </p>
    );
  }

  return (
    <ul className="mt-4 divide-y divide-line">
      {items.map((item) => (
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
            <span className="rounded-md bg-red-50 px-2 py-1 font-medium text-red-800">
              Rejected {item.qcRejectionCount}×
            </span>
            <span className="rounded-md bg-brand-50 px-2 py-1 font-medium text-brand-700">
              {CASE_STATUS_LABELS[item.status as keyof typeof CASE_STATUS_LABELS] ?? item.status}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DesignerDashboard({ firstName }: { firstName: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'performance' ? 'performance' : 'queue';

  const [items, setItems] = useState<CaseListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<DesignerPerformanceDto | null>(null);
  const [month, setMonth] = useState<string | undefined>();
  const [loadingReport, setLoadingReport] = useState(false);

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

  useEffect(() => {
    if (tab !== 'performance') return;
    async function load() {
      setLoadingReport(true);
      try {
        setReport(await fetchDesignerPerformance(month));
      } catch (err) {
        toast().error(getErrorMessage(err, 'Unable to load performance'));
      } finally {
        setLoadingReport(false);
      }
    }
    void load();
  }, [tab, month]);

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

      <div className="flex gap-2 border-b border-line pb-px">
        {(
          [
            ['queue', 'My cases'],
            ['performance', 'My performance'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() =>
              setSearchParams(id === 'queue' ? {} : { tab: id }, { replace: true })
            }
            className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${
              tab === id
                ? 'border border-b-white border-line bg-white text-brand-700'
                : 'text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'performance' ? (
        <section className="rounded-xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Monthly performance</h2>
              <p className="mt-1 text-sm text-muted">
                Total cases and modifications for the last 3 months.
              </p>
            </div>
            {report ? (
              <label className="space-y-1 text-sm">
                <span className="font-medium text-ink">Month</span>
                <select
                  value={report.periodKey}
                  onChange={(e) => setMonth(e.target.value)}
                  className="block rounded-xl border border-line bg-white px-3 py-2 text-sm"
                >
                  {report.availableMonths.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {loadingReport && !report ? (
            <p className="mt-4 text-sm text-muted">Loading performance…</p>
          ) : report ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Total cases', report.totalCases],
                ['Submitted to QC', report.submittedToQc],
                ['Modifications', report.modifications],
                ['QC rejections', report.qcRejections],
                ['Resubmissions', report.resubmissions],
                ['In production', report.inProductionCases],
                ['Completed', report.completedCases],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-line bg-surface/40 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
                  <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
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
      )}
    </div>
  );
}

export function EscalatedOversightDashboard({
  firstName,
  title,
  subtitle,
}: {
  firstName: string;
  title: string;
  subtitle: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'escalated' ? 'escalated' : 'home';
  const [items, setItems] = useState<QcQueueCaseDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        setItems(await fetchEscalatedQueue());
      } catch (err) {
        toast().error(getErrorMessage(err, 'Unable to load escalated cases'));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-line bg-white px-5 py-5 sm:px-6">
        <p className="text-sm font-medium text-brand-600">{title}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
          Welcome, {firstName}
        </h1>
        <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>
      </header>

      <div className="flex gap-2 border-b border-line pb-px">
        {(
          [
            ['home', 'Overview'],
            ['escalated', 'Escalated QC'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() =>
              setSearchParams(id === 'home' ? {} : { tab: id }, { replace: true })
            }
            className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${
              tab === id
                ? 'border border-b-white border-line bg-white text-brand-700'
                : 'text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">
          {tab === 'escalated' ? 'Escalated after repeated QC rejection' : 'Oversight snapshot'}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Cases with two or more QC rejections are surfaced here for extra review.
        </p>
        <EscalatedList items={items} loading={loading} />
      </section>
    </div>
  );
}
