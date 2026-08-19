import type { TimelineStep } from '@ayetis/shared';

const stateStyles: Record<
  TimelineStep['state'],
  { dot: string; label: string; line: string; caption: string | null }
> = {
  complete: {
    dot: 'border-brand-600 bg-brand-600 text-white',
    label: 'text-ink',
    line: 'bg-brand-600',
    caption: 'Completed',
  },
  current: {
    dot: 'border-brand-600 bg-white text-brand-700 ring-4 ring-brand-500/20',
    label: 'text-brand-700 font-semibold',
    line: 'bg-line',
    caption: 'Current',
  },
  upcoming: {
    dot: 'border-line bg-white text-muted',
    label: 'text-muted',
    line: 'bg-line',
    caption: null,
  },
  cancelled: {
    dot: 'border-slate-300 bg-slate-100 text-slate-400',
    label: 'text-slate-400 line-through',
    line: 'bg-slate-200',
    caption: 'Cancelled',
  },
};

const TERMINAL_CURRENT = new Set(['approved', 'cancelled', 'waiting_for_approval', 'approved']);

function captionFor(step: TimelineStep, isCancelled?: boolean): string | null {
  if (isCancelled && step.state === 'cancelled') return 'Cancelled';
  if (step.state === 'current') {
    if (TERMINAL_CURRENT.has(step.status) || step.status === 'approved') {
      return step.status === 'cancelled' ? 'Cancelled' : 'Done';
    }
    if (step.status === 'in_process') return 'In progress';
    return 'Current';
  }
  return stateStyles[step.state].caption;
}

export function CaseStatusTimeline({
  steps,
  currentLabel,
  isCancelled,
  variant = 'full',
}: {
  steps: TimelineStep[];
  currentLabel: string;
  isCancelled?: boolean;
  variant?: 'full' | 'compact';
}) {
  if (variant === 'compact') {
    return (
      <div className="rounded-xl border border-line bg-white">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">Status timeline</h3>
          <p className="mt-0.5 text-xs text-muted">
            {isCancelled ? 'Case cancelled' : `Current: ${currentLabel}`}
          </p>
        </div>
        <ol className="space-y-0 p-3">
          {steps.map((step, index) => {
            const styles = stateStyles[step.state];
            const caption = captionFor(step, isCancelled);
            const isLast = index === steps.length - 1;
            return (
              <li key={step.status} className="relative flex gap-3 pb-4 last:pb-0">
                {!isLast ? (
                  <span
                    className={`absolute left-[11px] top-6 h-[calc(100%-0.75rem)] w-0.5 ${styles.line}`}
                    aria-hidden
                  />
                ) : null}
                <span
                  className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold ${styles.dot}`}
                >
                  {step.state === 'complete' ? '✓' : index + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className={`text-sm leading-tight ${styles.label}`}>{step.label}</p>
                  {caption ? (
                    <p
                      className={`mt-0.5 text-[11px] font-medium ${
                        step.state === 'current' ? 'text-brand-600' : 'text-muted'
                      }`}
                    >
                      {caption}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line px-5 py-3.5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">Status timeline</h2>
          <p className="mt-0.5 text-sm text-muted">
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

      <ol className="flex flex-col gap-0 p-5 sm:flex-row sm:items-start">
        {steps.map((step, index) => {
          const styles = stateStyles[step.state];
          const isLast = index === steps.length - 1;
          const caption = captionFor(step, isCancelled);

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
                {caption ? (
                  <p
                    className={`mt-0.5 text-xs font-medium ${
                      step.state === 'current' ? 'text-brand-600' : 'text-muted'
                    }`}
                  >
                    {caption}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
