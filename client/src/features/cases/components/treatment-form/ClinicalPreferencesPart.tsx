import {
  EMPTY_CLINICAL_PREFERENCES,
  TOOTH_NUMBERING_LABELS,
  toothDisplayLabel,
  type ClinicalPreferences,
  type ToothNumberingSystem,
} from '@ayetis/shared';
import { ToothChart } from './ToothChart';

type ClinicalKey = keyof ClinicalPreferences;

const CHARTS: Array<{
  key: ClinicalKey;
  label: string;
}> = [
  { key: 'doNotMoveTeeth', label: 'Do not move' },
  { key: 'avoidEngagersTeeth', label: 'Avoid engagers' },
  { key: 'extractionTeeth', label: 'Extraction' },
  { key: 'leaveSpacesOpenTeeth', label: 'Leave spaces open' },
];

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function SelectedToothChips({
  ids,
  numberingSystem,
  onRemove,
}: {
  ids: string[];
  numberingSystem: ToothNumberingSystem;
  onRemove: (id: string) => void;
}) {
  if (!ids.length) {
    return <p className="text-xs text-muted">None selected.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onRemove(id)}
          className="inline-flex items-center rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-medium text-ink hover:border-brand-400 hover:text-brand-700"
          title="Remove"
        >
          {toothDisplayLabel(id, numberingSystem)}
          <span className="ml-1 text-muted">×</span>
        </button>
      ))}
    </div>
  );
}

export function ClinicalPreferencesPart({
  clinical,
  numberingSystem,
  instructions,
  onClinicalChange,
  onInstructionsChange,
}: {
  clinical: ClinicalPreferences;
  numberingSystem: ToothNumberingSystem;
  instructions?: string;
  onClinicalChange: (patch: Partial<ClinicalPreferences>) => void;
  onInstructionsChange?: (value: string) => void;
}) {
  const merged = { ...EMPTY_CLINICAL_PREFERENCES, ...clinical };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Numbering system:{' '}
        <span className="font-medium text-ink">{TOOTH_NUMBERING_LABELS[numberingSystem]}</span>
        . Use a separate chart for each list. Click a tooth or a chip to add or remove it.
        Selections are stored as FDI tooth IDs.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {CHARTS.map(({ key, label }) => {
          const selected = merged[key] ?? [];
          return (
            <div key={key} className="space-y-2">
              <ToothChart
                system={numberingSystem}
                selected={selected}
                onToggle={(fdiId) => onClinicalChange({ [key]: toggle(selected, fdiId) })}
                onSelectedChange={(fdiIds) => onClinicalChange({ [key]: fdiIds })}
                modeLabel={label}
                showLabels
              />
              <SelectedToothChips
                ids={selected}
                numberingSystem={numberingSystem}
                onRemove={(id) => onClinicalChange({ [key]: selected.filter((item) => item !== id) })}
              />
            </div>
          );
        })}
      </div>

      {onInstructionsChange ? (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Additional instructions</span>
          <textarea
            value={instructions || ''}
            onChange={(e) => onInstructionsChange(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
          />
        </label>
      ) : null}
    </div>
  );
}
