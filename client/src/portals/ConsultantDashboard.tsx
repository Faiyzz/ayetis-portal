import {
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  CONSULTANT_INDICATORS,
  CONSULTANT_INDICATOR_LABELS,
  type ConsultantDashboardDto,
  type ConsultantIndicator,
  type ConsultantPerformanceDto,
  type ConsultantQueueCaseDto,
} from '@ayetis/shared';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  fetchConsultantDashboard,
  fetchConsultantPerformance,
} from '@/features/cases/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

const INDICATOR_PILL: Record<ConsultantIndicator, string> = {
  [CONSULTANT_INDICATORS.GREEN]: 'bg-emerald-50 text-emerald-800',
  [CONSULTANT_INDICATORS.YELLOW]: 'bg-amber-50 text-amber-900',
  [CONSULTANT_INDICATORS.RED]: 'bg-red-50 text-red-800',
};

function CaseRow({ item }: { item: ConsultantQueueCaseDto }) {
  return (
    <li className="flex flex-col gap-2 border-t border-line py-3 first:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link
          to={`/app/cases/${item.caseId}`}
          className="font-semibold text-brand-700 hover:text-brand-800"
        >
          {item.caseId}
        </Link>
        <p className="truncate text-sm text-ink">
          {item.patientName} · {item.doctorName}
        </p>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted">{item.treatmentSummary}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {item.consultantIndicator ? (
          <span className={`rounded-md px-2 py-1 font-medium ${INDICATOR_PILL[item.consultantIndicator]}`}>
            {CONSULTANT_INDICATOR_LABELS[item.consultantIndicator]}
          </span>
        ) : (
          <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
            Needs review
          </span>
        )}
        <span className="rounded-md bg-brand-50 px-2 py-1 font-medium text-brand-700">
          {CASE_STATUS_LABELS[item.status as keyof typeof CASE_STATUS_LABELS] ?? item.status}
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
          {CASE_PRIORITY_LABELS[item.priority as keyof typeof CASE_PRIORITY_LABELS] ?? item.priority}
        </span>
        {item.escalatedForOversight ? (
          <span className="rounded-md bg-red-50 px-2 py-1 font-medium text-red-800">Escalated</span>
        ) : null}
      </div>
    </li>
  );
}

export function ConsultantDashboard({ firstName }: { firstName: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'performance' ? 'performance' : 'queue';
  const [dashboard, setDashboard] = useState<ConsultantDashboardDto | null>(null);
  const [report, setReport] = useState<ConsultantPerformanceDto | null>(null);
  const [month, setMonth] = useState<string | undefined>();
  const [view, setView] = useState<'month' | 'quarter'>('month');
  const [loading, setLoading] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        setDashboard(await fetchConsultantDashboard());
      } catch (err) {
        toast().error(getErrorMessage(err, 'Unable to load consultant queue'));
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
        setReport(await fetchConsultantPerformance({ month, view }));
      } catch (err) {
        toast().error(getErrorMessage(err, 'Unable to load performance'));
      } finally {
        setLoadingReport(false);
      }
    }
    void load();
  }, [tab, month, view]);

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-line bg-white px-5 py-5 sm:px-6">
        <p className="text-sm font-medium text-brand-600">Consultant portal</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
          Welcome, {firstName}
        </h1>
        <p className="mt-1.5 text-[15px] text-muted">
          Review treatment plans, add clinical remarks with colour indicators, and act as QC when
          needed.
        </p>
      </header>

      <div className="flex gap-2 border-b border-line pb-px">
        {(
          [
            ['queue', 'Assigned cases'],
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
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Performance report</h2>
              <p className="mt-1 text-sm text-muted">
                Reviews, consultations, QC reverts, and error trends (3-month window).
              </p>
            </div>
            {report ? (
              <>
                <select
                  value={report.periodKey}
                  onChange={(e) => setMonth(e.target.value)}
                  className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
                >
                  {report.availableMonths.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  {(['month', 'quarter'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setView(option)}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                        report.view === option
                          ? 'bg-brand-600 text-white'
                          : 'border border-line text-ink'
                      }`}
                    >
                      {option === 'month' ? 'Monthly' : 'Quarter'}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {loadingReport && !report ? (
            <p className="mt-4 text-sm text-muted">Loading…</p>
          ) : report ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['QC / review count', report.reviewCount],
                  ['Consultations', report.consultationCount],
                  ['QC reverted', report.qcRevertedCount],
                  ['Approvals', report.approvedCount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-line bg-surface/40 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
                    <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">Remark colour trend</h3>
                <ul className="mt-2 grid gap-2 sm:grid-cols-3">
                  {(Object.values(CONSULTANT_INDICATORS) as ConsultantIndicator[]).map((key) => (
                    <li
                      key={key}
                      className={`rounded-xl px-3 py-2 text-sm font-medium ${INDICATOR_PILL[key]}`}
                    >
                      {CONSULTANT_INDICATOR_LABELS[key]}: {report.indicatorBreakdown[key]}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">Error trends</h3>
                {report.errorTrends.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">No QC rejection codes in this period.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                    {report.errorTrends.map((item) => (
                      <li
                        key={item.errorCode}
                        className="flex items-center justify-between px-4 py-2.5 text-sm"
                      >
                        <span>{item.label}</span>
                        <span className="font-semibold">{item.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Total', dashboard?.totalCount ?? 0, 'bg-white'],
              ['Reviewed', dashboard?.greenCount ?? 0, 'bg-emerald-50'],
              ['Remarks', dashboard?.yellowCount ?? 0, 'bg-amber-50'],
              ['Attention', dashboard?.redCount ?? 0, 'bg-red-50'],
            ].map(([label, value, bg]) => (
              <div key={String(label)} className={`rounded-xl border border-line ${bg} px-4 py-3`}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
                <p className="mt-1 text-2xl font-bold text-ink">{loading ? '…' : value}</p>
              </div>
            ))}
          </div>

          <section className="rounded-xl border border-line bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">Assigned &amp; escalated cases</h2>
            <p className="mt-1 text-sm text-muted">
              Colour indicators: green = reviewed, yellow = remarks available, red = attention
              required.
            </p>
            {loading ? (
              <p className="mt-4 text-sm text-muted">Loading…</p>
            ) : !dashboard || dashboard.items.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No consultation cases right now.</p>
            ) : (
              <ul className="mt-4">
                {dashboard.items.map((item) => (
                  <CaseRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
