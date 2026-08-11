import {
  SLA_PROGRESS_COLOR_LABELS,
  type SlaProgressColor,
} from '@ayetis/shared';

const SLA_BAR_CLASS: Record<SlaProgressColor, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  blue: 'bg-sky-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
};

export type SlaProgressBarProps = {
  utilizationPercent: number | null | undefined;
  progressColor: SlaProgressColor | null | undefined;
  /** Show compact "SLA N%" caption (default true). */
  showLabel?: boolean;
  className?: string;
  emptyLabel?: string;
};

/**
 * Reusable URD SLA progress bar (Green ≤25 → Yellow ≤50 → Blue ≤75 → Orange ≤90 → Red ≥100).
 */
export function SlaProgressBar({
  utilizationPercent,
  progressColor,
  showLabel = true,
  className = 'min-w-[100px]',
  emptyLabel = 'No SLA',
}: SlaProgressBarProps) {
  if (utilizationPercent == null || !progressColor) {
    return <span className="text-xs text-muted">{emptyLabel}</span>;
  }

  const pct = Math.min(100, Math.max(0, utilizationPercent));
  const title = `${SLA_PROGRESS_COLOR_LABELS[progressColor]} · ${Math.round(utilizationPercent)}%`;

  return (
    <div className={className} title={title}>
      <div className="h-2 overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full rounded-full ${SLA_BAR_CLASS[progressColor]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel ? (
        <p className="mt-0.5 text-[10px] text-muted">SLA {Math.round(utilizationPercent)}%</p>
      ) : null}
    </div>
  );
}
