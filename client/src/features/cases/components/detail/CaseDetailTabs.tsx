import type { CaseDetailNavSection } from '@/features/cases/caseDetailNav';
import type { KeyboardEvent } from 'react';

export function CaseDetailTabs({
  tabs,
  activeId,
  onChange,
}: {
  tabs: CaseDetailNavSection[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.id === activeId);
    if (index < 0) return;

    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      next = (index + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      next = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      event.preventDefault();
      next = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      next = tabs.length - 1;
    } else {
      return;
    }

    onChange(tabs[next]!.id);
  }

  return (
    <div
      role="tablist"
      aria-label="Case detail sections"
      onKeyDown={onKeyDown}
      className="flex flex-wrap gap-x-0.5"
    >
      {tabs.map((tab) => {
        const selected = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={tab.id}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={[
              'relative px-3 py-2.5 text-sm font-medium transition',
              selected ? 'text-ink' : 'text-muted hover:text-ink',
            ].join(' ')}
          >
            {tab.label}
            {selected ? (
              <span
                className="absolute inset-x-3 -bottom-px h-0.5 bg-slate-800"
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
