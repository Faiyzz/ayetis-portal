import {
  FDI_LOWER_TEETH,
  FDI_UPPER_TEETH,
  toothDisplayLabel,
  type ToothNumberingSystem,
} from '@ayetis/shared';

export function ToothChart({
  system,
  selected,
  onToggle,
  modeLabel,
}: {
  system: ToothNumberingSystem;
  selected: string[];
  onToggle: (fdiId: string) => void;
  modeLabel: string;
}) {
  function row(teeth: readonly string[]) {
    return (
      <div className="flex flex-wrap justify-center gap-1">
        {teeth.map((fdiId) => {
          const on = selected.includes(fdiId);
          const label = toothDisplayLabel(fdiId, system);
          return (
            <button
              key={fdiId}
              type="button"
              onClick={() => onToggle(fdiId)}
              className={[
                'min-h-8 min-w-8 rounded-md px-1 text-[11px] font-semibold transition',
                on
                  ? 'bg-brand-600 text-white'
                  : 'border border-line bg-white text-ink hover:border-brand-300',
              ].join(' ')}
              title={`${modeLabel}: ${label} (FDI ${fdiId})`}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface/40 p-3">
      <p className="text-center text-xs font-medium text-muted">Upper</p>
      {row(FDI_UPPER_TEETH)}
      <div className="border-t border-dashed border-line" />
      {row(FDI_LOWER_TEETH)}
      <p className="text-center text-xs font-medium text-muted">Lower</p>
    </div>
  );
}
