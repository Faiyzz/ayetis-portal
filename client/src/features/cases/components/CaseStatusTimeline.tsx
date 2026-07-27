import type { TimelineStep } from '@ayetis/shared';

const stateStyles: Record<
  TimelineStep['state'],
  { dot: string; label: string; line: string }
> = {
  complete: {
    dot: 'border-brand-600 bg-brand-600 text-white',
    label: 'text-ink',
    line: 'bg-brand-600',
  },
  current: {
    dot: 'border-brand-600 bg-white text-brand-700 ring-4 ring-brand-500/20',
    label: 'text-brand-700 font-semibold',
    line: 'bg-line',
  },
  upcoming: {
    dot: 'border-line bg-white text-muted',
    label: 'text-muted',
    line: 'bg-line',
  },
  cancelled: {
    dot: 'border-slate-300 bg-slate-100 text-slate-400',
    label: 'text-slate-400 line-through',
    line: 'bg-slate-200',
  },
};

export function CaseStatusTimeline({
  steps,
  currentLabel,
  isCancelled,
}: {
  steps: TimelineStep[];
  currentLabel: string;
  isCancelled?: boolean;
}) {
  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Status timeline</h2>
          <p className="mt-1 text-sm text-muted">
            {isCancelled
              ? 'This case was cancelled and is no longer progressing.'
              : `Current stage: ${currentLabel}`}
          </p>
        </div>
        {isCancelled ? (
          <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
            Cancelled
          </span>
        ) : null}
      </div>

      <ol className="mt-6 flex flex-col gap-0 sm:flex-row sm:items-start">
        {steps.map((step, index) => {
          const styles = stateStyles[step.state];
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step.status}
              className="relative flex flex-1 gap-3 sm:flex-col sm:items-center sm:gap-2 sm:px-1"
            >
              {!isLast ? (
                <span
                  className={`absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-0.5 sm:left-[calc(50%+0.75rem)] sm:top-[15px] sm:h-0.5 sm:w-[calc(100%-1.5rem)] ${styles.line}`}
                  aria-hidden
                />
              ) : null}

              <span
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${styles.dot}`}
              >
                {step.state === 'complete' ? '✓' : index + 1}
              </span>

              <div className="pb-5 sm:pb-0 sm:pt-1 sm:text-center">
                <p className={`text-sm ${styles.label}`}>{step.label}</p>
                {step.state === 'current' ? (
                  <p className="mt-0.5 text-xs font-medium text-brand-600">In progress</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
