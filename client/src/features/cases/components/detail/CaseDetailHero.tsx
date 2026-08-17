import {
  formatCaseIdLabel,
  type CaseDetailDto,
} from '@ayetis/shared';
import type { ReactNode } from 'react';

export { CaseClinicalHeader } from './clinical/CaseClinicalHeader';
export { CaseDetailActionButton } from './clinical/CaseClinicalHeader';

/** @deprecated Prefer CaseClinicalHeader — kept for existing imports. */
export function CaseDetailHero({
  caseData,
  actions,
}: {
  caseData: CaseDetailDto;
  actions: ReactNode;
  onJumpToTab?: (tabId: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
      <p className="text-sm text-muted">{formatCaseIdLabel(caseData.caseId, caseData.status)}</p>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}
