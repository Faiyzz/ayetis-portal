import {
  EMPTY_CLINICAL_PREFERENCES,
  TOOTH_NUMBERING_LABELS,
  type ClinicalPreferences,
  type ToothNumberingSystem,
} from '@ayetis/shared';
import { useState } from 'react';
import { ToothChart } from './ToothChart';

type ClinicalKey = keyof ClinicalPreferences;

const MODES: Array<{ key: ClinicalKey; label: string }> = [
  { key: 'doNotMoveTeeth', label: 'Do not move' },
  { key: 'avoidEngagersTeeth', label: 'Avoid engagers' },
  { key: 'extractionTeeth', label: 'Extraction' },
  { key: 'leaveSpacesOpenTeeth', label: 'Leave spaces open' },
];

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
  const [mode, setMode] = useState<ClinicalKey>('doNotMoveTeeth');
  const merged = { ...EMPTY_CLINICAL_PREFERENCES, ...clinical };

  function toggleTooth(fdiId: string) {
    const list = merged[mode] ?? [];
    const next = list.includes(fdiId) ? list.filter((t) => t !== fdiId) : [...list, fdiId];
    onClinicalChange({ [mode]: next });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Numbering system:{' '}
        <span className="font-medium text-ink">{TOOTH_NUMBERING_LABELS[numberingSystem]}</span>
        . Selections are stored as FDI tooth IDs so they stay stable if you change numbering later.
      </p>

      <div className="flex flex-wrap gap-2">
        {MODES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={[
              'rounded-lg px-3 py-1.5 text-xs font-semibold',
              mode === key ? 'bg-brand-600 text-white' : 'border border-line text-ink',
            ].join(' ')}
          >
            {label} ({merged[key].length})
          </button>
        ))}
      </div>

      <ToothChart
        system={numberingSystem}
        selected={merged[mode]}
        onToggle={toggleTooth}
        modeLabel={MODES.find((m) => m.key === mode)?.label ?? mode}
      />

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
