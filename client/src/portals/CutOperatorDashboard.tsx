import {
  CUT_PHASE_LABELS,
  CASE_PRIORITY_LABELS,
  type CutDashboardDto,
  type CutPerformanceDto,
  type CutQueueCaseDto,
} from '@ayetis/shared';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { fetchCutDashboard, fetchCutPerformance } from '@/features/cases/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

function QueueRow({ item }: { item: CutQueueCaseDto }) {
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
        <span className="rounded-md bg-brand-50 px-2 py-1 font-medium text-brand-700">
          {CUT_PHASE_LABELS[item.cutPhase]}
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
          {CASE_PRIORITY_LABELS[item.priority as keyof typeof CASE_PRIORITY_LABELS] ??
            item.priority}
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
          {item.fileCount} file{item.fileCount === 1 ? '' : 's'}
        </span>
        {item.openClarificationCount > 0 ? (
          <span className="rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-900">
            {item.openClarificationCount} clarification
            {item.openClarificationCount === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function QueueSection({
  title,
  description,
  items,
  empty,
}: {
  title: string;
  description: string;
  items: CutQueueCaseDto[];
  empty: string;
}) {
  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-4">
          {items.map((item) => (
            <QueueRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function PerformancePanel({
  report,
  onMonthChange,
  onViewChange,
  loading,
}: {
  report: CutPerformanceDto | null;
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['Assigned', report.totalAssigned],
          ['Completed', report.totalCompleted],
          ['Pending', report.pending],
          ['Avg. completion (hrs)', report.averageCompletionHours ?? '—'],
          ['Clarifications raised', report.clarificationsRaised],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-surface/40 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CutOperatorDashboard({ firstName }: { firstName: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'performance' ? 'performance' : 'queue';

  const [dashboard, setDashboard] = useState<CutDashboardDto | null>(null);
  const [report, setReport] = useState<CutPerformanceDto | null>(null);
  const [month, setMonth] = useState<string | undefined>();
  const [view, setView] = useState<'month' | 'quarter'>('month');
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    async function load() {
      setLoadingQueue(true);
      try {
        setDashboard(await fetchCutDashboard());
      } catch (err) {
        toast().error(getErrorMessage(err, 'Unable to load cut dashboard'));
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
        setReport(await fetchCutPerformance({ month, view }));
      } catch (err) {
        toast().error(getErrorMessage(err, 'Unable to load cut performance'));
      } finally {
        setLoadingReport(false);
      }
    }
    void load();
  }, [tab, month, view]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cut Operator portal"
        title={`Welcome, ${firstName}`}
        subtitle="Claim cut cases, upload cut outputs, and hand off completed work to designers."
      />

      <div className="flex gap-2 border-b border-line pb-px">
        {(
          [
            ['queue', 'Cut queues'],
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
            Assigned and completed cut cases, average turnaround, and clarifications raised.
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
      ) : loadingQueue ? (
        <p className="text-sm text-muted">Loading queues…</p>
      ) : dashboard ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ['Assigned', dashboard.counts.assigned],
                ['Auto queue', dashboard.counts.autoQueue],
                ['In progress', dashboard.counts.inProgress],
                ['Clarifications', dashboard.counts.pendingClarification],
                ['Waiting for designer', dashboard.counts.waitingForDesigner],
                ['Completed', dashboard.counts.completed],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl border border-line bg-white px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
                <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
              </div>
            ))}
          </div>

          <QueueSection
            title="Assigned to you"
            description="Cases explicitly assigned for cutting."
            items={dashboard.assigned}
            empty="No assigned cut cases right now."
          />

          <QueueSection
            title="Cut auto-pick queue"
            description="Unclaimed cases available from the cut auto queue."
            items={dashboard.autoQueue}
            empty="No cases in the cut auto queue."
          />

          <QueueSection
            title="In progress"
            description="Cases you are actively cutting."
            items={dashboard.inProgress}
            empty="No cut work in progress."
          />

          {dashboard.pendingClarification.length > 0 ? (
            <QueueSection
              title="Pending clarification"
              description="Your cut cases with open clarification threads."
              items={dashboard.pendingClarification}
              empty="No clarifications pending."
            />
          ) : null}

          {dashboard.waitingForDesigner.length > 0 ? (
            <QueueSection
              title="Waiting for designer"
              description="Cut work submitted — awaiting designer assignment."
              items={dashboard.waitingForDesigner}
              empty="None waiting for designer."
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
