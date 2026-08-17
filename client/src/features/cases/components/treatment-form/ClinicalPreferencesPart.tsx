import {
  EMPTY_CLINICAL_PREFERENCES,
  TOOTH_NUMBERING_LABELS,
  type ClinicalPreferences,
  type ToothNumberingSystem,
} from '@ayetis/shared';
import { useState } from 'react';
import { ToothChart, type ToothChartCondition } from './ToothChart';

type ClinicalKey = keyof ClinicalPreferences;

const MODES: Array<{
  key: ClinicalKey;
  label: string;
  fillColor: string;
  outlineColor: string;
}> = [
  {
    key: 'doNotMoveTeeth',
    label: 'Do not move',
    fillColor: '#94a3b8',
    outlineColor: '#475569',
  },
  {
    key: 'avoidEngagersTeeth',
    label: 'Avoid engagers',
    fillColor: '#fbbf24',
    outlineColor: '#b45309',
  },
  {
    key: 'extractionTeeth',
    label: 'Extraction',
    fillColor: '#f87171',
    outlineColor: '#b91c1c',
  },
  {
    key: 'leaveSpacesOpenTeeth',
    label: 'Leave spaces open',
    fillColor: '#34d399',
    outlineColor: '#047857',
  },
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
  const active = MODES.find((item) => item.key === mode) ?? MODES[0];

  const conditions: ToothChartCondition[] = MODES.filter((item) => item.key !== mode).map(
    (item) => ({
      label: item.label,
      teeth: merged[item.key] ?? [],
      fillColor: item.fillColor,
      outlineColor: item.outlineColor,
    }),
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Numbering system:{' '}
        <span className="font-medium text-ink">{TOOTH_NUMBERING_LABELS[numberingSystem]}</span>
        . Click a tooth to add or remove it from the selected list. Other lists stay color-coded on
        the same chart. Selections are stored as FDI tooth IDs.
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
        onToggle={(fdiId) => {
          const list = merged[mode] ?? [];
          const next = list.includes(fdiId) ? list.filter((id) => id !== fdiId) : [...list, fdiId];
          onClinicalChange({ [mode]: next });
        }}
        onSelectedChange={(fdiIds) => onClinicalChange({ [mode]: fdiIds })}
        modeLabel={active.label}
        conditions={conditions}
        showLabels
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
