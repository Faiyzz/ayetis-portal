import { useEffect, useId, useMemo, useRef, useState } from 'react';

export type SearchableOption = {
  value: string;
  label: string;
  meta?: string;
};

/**
 * Combobox-style select with typeahead filtering.
 * Falls back to allowing an exact custom value when `allowCustom` is true.
 */
export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Search…',
  emptyLabel = 'No matches',
  required,
  disabled,
  allowCustom = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  emptyLabel?: string;
  required?: boolean;
  disabled?: boolean;
  allowCustom?: boolean;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.value === value);
  const display = open ? query : selected?.label || value;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 80);
    return options
      .filter(
        (option) =>
          option.label.toLowerCase().includes(q) ||
          option.value.toLowerCase().includes(q) ||
          (option.meta?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 80);
  }, [options, query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={rootRef} className="relative block space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          autoComplete="off"
          value={display}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true);
            setQuery(selected?.label || value || '');
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (allowCustom) onChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              setQuery('');
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              const first = filtered[0];
              if (first) choose(first.value);
              else if (allowCustom && query.trim()) choose(query.trim());
            }
          }}
          className="w-full rounded-xl border border-line bg-white px-3.5 py-3 pr-10 text-[15px] text-ink outline-none transition placeholder:text-muted/70 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:opacity-60"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      {open && !disabled ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-line bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">{emptyLabel}</li>
          ) : (
            filtered.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={[
                    'flex w-full flex-col items-start px-3 py-2 text-left text-sm transition',
                    option.value === value
                      ? 'bg-brand-50 text-brand-800'
                      : 'text-ink hover:bg-surface',
                  ].join(' ')}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(option.value)}
                >
                  <span className="font-medium">{option.label}</span>
                  {option.meta ? (
                    <span className="text-xs text-muted">{option.meta}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
