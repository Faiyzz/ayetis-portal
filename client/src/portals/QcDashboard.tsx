import {
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  type QcDashboardDto,
  type QcPerformanceDto,
  type QcQueueCaseDto,
} from '@ayetis/shared';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { fetchQcDashboard, fetchQcPerformance } from '@/features/cases/api';
import { SlaProgressBar } from '@/features/cases/components/SlaProgressBar';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

function QueueRow({ item }: { item: QcQueueCaseDto }) {
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
        <SlaProgressBar
          utilizationPercent={item.slaUtilizationPercent}
          progressColor={item.slaProgressColor}
          className="min-w-[88px]"
        />
        <span className="rounded-md bg-brand-50 px-2 py-1 font-medium text-brand-700">
          {CASE_STATUS_LABELS[item.status as keyof typeof CASE_STATUS_LABELS] ?? item.status}
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
          {CASE_PRIORITY_LABELS[item.priority as keyof typeof CASE_PRIORITY_LABELS] ?? item.priority}
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
          {item.fileCount} file{item.fileCount === 1 ? '' : 's'}
        </span>
        {item.designerName ? (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">{item.designerName}</span>
        ) : null}
        {item.qcRejectionCount > 0 ? (
          <span className="rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-900">
            Rejected {item.qcRejectionCount}×
          </span>
        ) : null}
        {item.escalatedForOversight ? (
          <span className="rounded-md bg-red-50 px-2 py-1 font-medium text-red-800">Escalated</span>
        ) : null}
      </div>
    </li>
  );
}

function PerformancePanel({
  report,
  onMonthChange,
  onViewChange,
  loading,
}: {
  report: QcPerformanceDto | null;
  onMonthChange: (month: string) => void;
  onViewChange: (view: 'month' | 'quarter') => void;
  loading: boolean;
}) {
  if (loading && !report) {
    return <p className="text-sm text-muted">Loading performance…</p>;
  }
  if (!report) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-ink">Period</span>
          <select
            value={report.periodKey}
            onChange={(e) => onMonthChange(e.target.value)}
            className="block rounded-xl border border-line bg-white px-3 py-2 text-sm"
          >
            {report.availableMonths.map((month) => (
              <option key={month.key} value={month.key}>
                {month.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          {(['month', 'quarter'] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => onViewChange(view)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                report.view === view
                  ? 'bg-brand-600 text-white'
                  : 'border border-line text-ink hover:border-brand-300'
              }`}
            >
              {view === 'month' ? 'Monthly' : 'Quarter'}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted">{report.periodLabel}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Reviewed', report.casesReviewed],
          ['Approved', report.approvedCount],
          ['Reverted', report.revertedCount],
          ['Comments only', report.commentsOnly],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-surface/40 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink">Error trends</h3>
        {report.errorTrends.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No rejection error codes in this period.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {report.errorTrends.map((item) => (
              <li
                key={item.errorCode}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
              >
                <span className="text-ink">{item.label}</span>
                <span className="font-semibold text-ink">{item.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function QcDashboard({ firstName }: { firstName: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'performance' ? 'performance' : 'queue';

  const [dashboard, setDashboard] = useState<QcDashboardDto | null>(null);
  const [report, setReport] = useState<QcPerformanceDto | null>(null);
  const [month, setMonth] = useState<string | undefined>();
  const [view, setView] = useState<'month' | 'quarter'>('month');
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    async function load() {
      setLoadingQueue(true);
      try {
        setDashboard(await fetchQcDashboard());
      } catch (err) {
        toast().error(getErrorMessage(err, 'Unable to load QC queue'));
      } finally {
        setLoadingQueue(false);
      }
    }
    void load();
  }, []);

  useEffect(() => {
    if (tab !== 'performance') return;
    async function load() {
      setLoadingReport(true);
      try {
        setReport(await fetchQcPerformance({ month, view }));
      } catch (err) {
        toast().error(getErrorMessage(err, 'Unable to load QC performance'));
      } finally {
        setLoadingReport(false);
      }
    }
    void load();
  }, [tab, month, view]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quality Control portal"
        title={`Welcome, ${firstName}`}
        subtitle="Process the QC queue in order, open case files, and approve or return work with error codes."
      />

      <div className="flex gap-2 border-b border-line pb-px">
        {(
          [
            ['queue', 'QC queue'],
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
          <h2 className="text-sm font-semibold text-ink">Performance report</h2>
          <p className="mt-1 text-sm text-muted">
            Case counts, reverted counts, and error trends (up to 3 months).
          </p>
          <div className="mt-4">
            <PerformancePanel
              report={report}
              loading={loadingReport}
              onMonthChange={setMonth}
              onViewChange={setView}
            />
          </div>
        </section>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-white px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Pending QC</p>
              <p className="mt-1 text-2xl font-bold text-ink">
                {loadingQueue ? '…' : (dashboard?.pendingCount ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-white px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Escalated</p>
              <p className="mt-1 text-2xl font-bold text-ink">
                {loadingQueue ? '…' : (dashboard?.escalatedCount ?? 0)}
              </p>
            </div>
          </div>

          <section className="rounded-xl border border-line bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">Cases waiting for quality review</h2>
            <p className="mt-1 text-sm text-muted">
              Ordered by priority, then earliest submission to QC.
            </p>
            {loadingQueue ? (
              <p className="mt-4 text-sm text-muted">Loading queue…</p>
            ) : !dashboard || dashboard.items.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No cases waiting for QC right now.</p>
            ) : (
              <ul className="mt-4">
                {dashboard.items.map((item) => (
                  <QueueRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </section>

          {dashboard && dashboard.escalatedItems.length > 0 ? (
            <section className="rounded-xl border border-line bg-white p-5">
              <h2 className="text-sm font-semibold text-ink">Escalated oversight</h2>
              <p className="mt-1 text-sm text-muted">
                Cases with two or more QC rejections (also visible to consultants and supervisors).
              </p>
              <ul className="mt-4">
                {dashboard.escalatedItems.map((item) => (
                  <QueueRow key={item.id} item={item} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
