import {
  THEMES,
  TOOTH_NUMBERING_SYSTEMS,
  type ToothNumberingSystem,
} from '@ayetis/shared';
import { Odontogram, type ToothConditionGroup, type ToothDetail } from 'react-odontogram';
import 'react-odontogram/style.css';
import { useThemeStore } from '@/features/theme/themeStore';
import './odontogram.css';

export function fdiToLibId(fdiId: string): string {
  const id = fdiId.trim();
  if (!id) return id;
  return id.startsWith('teeth-') ? id : `teeth-${id}`;
}

export function libIdToFdi(libId: string): string {
  return libId.replace(/^teeth-/, '');
}

export function fdiListToLibIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map(fdiToLibId).filter(Boolean))];
}

function notationFor(system: ToothNumberingSystem): 'FDI' | 'Universal' | 'Palmer' {
  if (system === TOOTH_NUMBERING_SYSTEMS.UNIVERSAL) return 'Universal';
  if (system === TOOTH_NUMBERING_SYSTEMS.PALMER) return 'Palmer';
  return 'FDI';
}

export type ToothChartCondition = {
  label: string;
  teeth: string[];
  fillColor: string;
  outlineColor: string;
};

export function ToothChart({
  system,
  selected,
  onToggle,
  onSelectedChange,
  modeLabel,
  conditions,
  showLabels = false,
}: {
  system: ToothNumberingSystem;
  selected: string[];
  onToggle: (fdiId: string) => void;
  onSelectedChange?: (fdiIds: string[]) => void;
  modeLabel: string;
  conditions?: ToothChartCondition[];
  showLabels?: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);

  function handleChange(teeth: ToothDetail[]) {
    const next = [
      ...new Set(teeth.map((tooth) => libIdToFdi(tooth.notations.fdi || tooth.id)).filter(Boolean)),
    ];
    if (onSelectedChange) {
      onSelectedChange(next);
      return;
    }
    const prev = new Set(selected);
    const nextSet = new Set(next);
    const added = next.find((id) => !prev.has(id));
    const removed = selected.find((id) => !nextSet.has(id));
    const changed = added ?? removed;
    if (changed) onToggle(changed);
  }

  const teethConditions: ToothConditionGroup[] | undefined = conditions
    ?.filter((group) => group.teeth.length > 0)
    .map((group) => ({
      label: group.label,
      teeth: fdiListToLibIds(group.teeth),
      fillColor: group.fillColor,
      outlineColor: group.outlineColor,
    }));

  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface/40 p-3">
      <p className="text-center text-xs font-medium text-muted">{modeLabel}</p>
      <div className="mx-auto max-w-xl overflow-x-auto">
        <Odontogram
          key={`${modeLabel}-${system}-${fdiListToLibIds(selected).join(',')}`}
          name={`ayetis-odontogram-${modeLabel.replace(/\s+/g, '-').toLowerCase()}`}
          defaultSelected={fdiListToLibIds(selected)}
          notation={notationFor(system)}
          theme={theme === THEMES.DARK ? 'dark' : 'light'}
          colors={{
            darkBlue: '#1d4ed8',
            baseBlue: '#2563eb',
            lightBlue: '#93c5fd',
          }}
          onChange={handleChange}
          teethConditions={teethConditions}
          showLabels={showLabels && Boolean(teethConditions?.length)}
          showHalf="full"
          className="ayetis-odontogram"
        />
      </div>
    </div>
  );
}
