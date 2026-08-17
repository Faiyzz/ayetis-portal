import type { TimelineStep } from '@ayetis/shared';
import {
  journeyProgressPercent,
  type JourneyMilestone,
} from './clinicalUtils';

const STATE_DOT: Record<JourneyMilestone['state'], string> = {
  complete: 'border-emerald-500 bg-emerald-500 text-white',
  current: 'border-teal-600 bg-white text-teal-700 ring-2 ring-teal-500/25',
  upcoming: 'border-line bg-white text-muted',
  cancelled: 'border-slate-300 bg-slate-100 text-slate-400',
};

const STATE_LINE: Record<JourneyMilestone['state'], string> = {
  complete: 'bg-emerald-500',
  current: 'bg-teal-200',
  upcoming: 'bg-line',
  cancelled: 'bg-slate-200',
};

const STATE_LABEL: Record<JourneyMilestone['state'], string> = {
  complete: 'text-ink',
  current: 'text-teal-800 font-semibold',
  upcoming: 'text-muted',
  cancelled: 'text-slate-400 line-through',
};

export function TreatmentJourneyTimeline({
  milestones,
  currentLabel,
  isCancelled,
}: {
  milestones: JourneyMilestone[];
  currentLabel: string;
  isCancelled?: boolean;
  workflowSteps?: TimelineStep[];
}) {
  const percent = journeyProgressPercent(milestones);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-muted">
          {isCancelled ? 'Cancelled' : currentLabel}
          <span className="mx-1.5 text-line">·</span>
          {percent}% complete
        </p>
      </div>

      <ol className="mt-4 flex items-start">
        {milestones.map((step, index) => {
          const isLast = index === milestones.length - 1;
          return (
            <li key={step.id} className="relative flex flex-1 flex-col items-center px-1">
              {!isLast ? (
                <span
                  className={`absolute left-[calc(50%+0.7rem)] top-[11px] h-0.5 w-[calc(100%-1.4rem)] ${STATE_LINE[step.state]}`}
                  aria-hidden
                />
              ) : null}
              <span
                className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold ${STATE_DOT[step.state]}`}
              >
                {step.state === 'complete' ? '✓' : index + 1}
              </span>
              <p className={`mt-2 text-center text-xs ${STATE_LABEL[step.state]}`}>{step.label}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
