import {
  ASSIGNMENT_MODE_LABELS,
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  DELAY_LEVEL_LABELS,
  DELAY_LEVELS,
  DELAY_THRESHOLDS_HOURS,
  type CoordinatorDashboardDto,
  type CoordinatorQueueCaseDto,
  type DelayLevel,
} from '@ayetis/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCoordinatorDashboard } from '@/features/cases/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

const DELAY_BAR_COLORS: Record<DelayLevel, string> = {
  [DELAY_LEVELS.GREEN]: 'bg-emerald-500',
  [DELAY_LEVELS.YELLOW]: 'bg-amber-400',
  [DELAY_LEVELS.BLUE]: 'bg-sky-500',
  [DELAY_LEVELS.RED]: 'bg-red-500',
};

const DELAY_PILL: Record<DelayLevel, string> = {
  [DELAY_LEVELS.GREEN]: 'bg-emerald-50 text-emerald-800',
  [DELAY_LEVELS.YELLOW]: 'bg-amber-50 text-amber-800',
  [DELAY_LEVELS.BLUE]: 'bg-sky-50 text-sky-800',
  [DELAY_LEVELS.RED]: 'bg-red-50 text-red-800',
};

function DelayBar({
  breakdown,
  total,
}: {
  breakdown: Record<DelayLevel, number>;
  total: number;
}) {
  if (total === 0) {
    return <div className="h-2.5 w-full rounded-full bg-slate-100" />;
  }

  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      {([DELAY_LEVELS.GREEN, DELAY_LEVELS.YELLOW, DELAY_LEVELS.BLUE, DELAY_LEVELS.RED] as const).map(
        (level) => {
          const count = breakdown[level] ?? 0;
          if (!count) return null;
          return (
            <div
              key={level}
              title={`${DELAY_LEVEL_LABELS[level]}: ${count}`}
              className={`${DELAY_BAR_COLORS[level]} h-full`}
              style={{ width: `${(count / total) * 100}%` }}
            />
          );
        },
      )}
    </div>
  );
}

function CaseRow({ item }: { item: CoordinatorQueueCaseDto }) {
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
        <span className={`rounded-md px-2 py-1 font-medium ${DELAY_PILL[item.delayLevel]}`}>
          {DELAY_LEVEL_LABELS[item.delayLevel]} · {item.delayHours.toFixed(0)}h
        </span>
        <span className="rounded-md bg-brand-50 px-2 py-1 font-medium text-brand-700">
          {CASE_STATUS_LABELS[item.status]}
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
          {CASE_PRIORITY_LABELS[item.priority]}
        </span>
        {item.assignedDesignerName ? (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
            {item.assignedDesignerName}
          </span>
        ) : item.assignmentMode === 'auto_queue' ? (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
            {ASSIGNMENT_MODE_LABELS.auto_queue}
          </span>
        ) : null}
      </div>
    </li>
  );
}

export function CoordinatorDashboard({ firstName }: { firstName: string }) {
  const [data, setData] = useState<CoordinatorDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeQueue, setActiveQueue] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setData(await fetchCoordinatorDashboard());
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to load coordinator dashboard'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totalCases = data
    ? Object.values(data.totals).reduce((sum, value) => sum + value, 0)
    : 0;

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-line bg-white px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-brand-600">Coordinator portal</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
              Welcome, {firstName}
            </h1>
            <p className="mt-1.5 text-[15px] text-muted">
              Validate submissions, chase clarifications, and route ready cases to designers.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-brand-300"
          >
            Refresh
          </button>
        </div>

        <div className="mt-5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>Review delay colour bar</span>
            <span>
              Green &lt;{DELAY_THRESHOLDS_HOURS.greenMax}h · Yellow &lt;
              {DELAY_THRESHOLDS_HOURS.yellowMax}h · Blue &lt;{DELAY_THRESHOLDS_HOURS.blueMax}h · Red
              older
            </span>
          </div>
          {data ? (
            <DelayBar breakdown={data.delayBreakdown} total={totalCases} />
          ) : (
            <div className="h-2.5 w-full rounded-full bg-slate-100" />
          )}
          <div className="flex flex-wrap gap-3 text-xs">
            {(
              [
                DELAY_LEVELS.GREEN,
                DELAY_LEVELS.YELLOW,
                DELAY_LEVELS.BLUE,
                DELAY_LEVELS.RED,
              ] as const
            ).map((level) => (
              <span key={level} className="inline-flex items-center gap-1.5 text-muted">
                <span className={`h-2.5 w-2.5 rounded-full ${DELAY_BAR_COLORS[level]}`} />
                {DELAY_LEVEL_LABELS[level]}
                {data ? ` (${data.delayBreakdown[level]})` : ''}
              </span>
            ))}
          </div>
        </div>
      </header>

      {loading && !data ? (
        <p className="text-sm text-muted">Loading queues…</p>
      ) : data ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.buckets.map((bucket) => {
            const expanded = activeQueue === bucket.queue || activeQueue === null;
            return (
              <section
                key={bucket.queue}
                className="rounded-xl border border-line bg-white p-5"
              >
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 text-left"
                  onClick={() =>
                    setActiveQueue((prev) => (prev === bucket.queue ? null : bucket.queue))
                  }
                >
                  <div>
                    <h2 className="text-sm font-semibold text-ink">{bucket.label}</h2>
                    <p className="mt-1 text-sm text-muted">{bucket.description}</p>
                  </div>
                  <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-sm font-bold text-brand-700">
                    {bucket.count}
                  </span>
                </button>

                <div className="mt-3">
                  <DelayBar breakdown={bucket.delayBreakdown} total={bucket.count} />
                </div>

                {expanded ? (
                  bucket.items.length === 0 ? (
                    <p className="mt-4 text-sm text-muted">No cases in this queue.</p>
                  ) : (
                    <ul className="mt-2">
                      {bucket.items.map((item) => (
                        <CaseRow key={item.id} item={item} />
                      ))}
                    </ul>
                  )
                ) : null}
              </section>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link
          to="/app/cases"
          className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand-300"
        >
          Open full case listing
        </Link>
        <Link
          to="/app/cases?status=waiting_clarification"
          className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand-300"
        >
          Waiting for doctor
        </Link>
      </div>
    </div>
  );
}
