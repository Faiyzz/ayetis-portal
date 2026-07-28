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
    const idx = tabs.findIndex((t) => t.id === activeId);
    if (idx < 0) return;

    let next = idx;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      next = (idx + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      next = (idx - 1 + tabs.length) % tabs.length;
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
      className="flex flex-wrap gap-x-1 border-b border-line bg-white"
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
              'relative px-3.5 py-3 text-sm font-medium transition',
              selected ? 'text-brand-700' : 'text-muted hover:text-ink',
            ].join(' ')}
          >
            {tab.label}
            {selected ? (
              <span
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600"
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
