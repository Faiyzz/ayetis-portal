import type { CaseDetailNavSection } from '@/features/cases/caseDetailNav';
import { PageTabs } from '@/components/PageTabs';

export function CaseDetailTabs({
  tabs,
  activeId,
  onChange,
}: {
  tabs: CaseDetailNavSection[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <PageTabs
      tabs={tabs}
      activeId={activeId}
      onChange={onChange}
      ariaLabel="Case detail sections"
    />
  );
}
