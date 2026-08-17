import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type MoreAction = {
  id: string;
  label: string;
  onClick?: () => void;
  to?: string;
  disabled?: boolean;
  tone?: 'default' | 'warning' | 'danger';
};

export function CaseMoreMenu({ items }: { items: MoreAction[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  const toneClass = {
    default: 'text-ink',
    warning: 'text-amber-800',
    danger: 'text-red-600',
  } as const;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-surface"
      >
        More
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-44 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-sm"
        >
          {items.map((item) => {
            const className = `block w-full px-3 py-2 text-left text-sm ${toneClass[item.tone ?? 'default']} hover:bg-surface disabled:opacity-50`;
            if (item.to) {
              return (
                <Link
                  key={item.id}
                  role="menuitem"
                  to={item.to}
                  className={className}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={className}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function CaseDetailActionButton({
  children,
  onClick,
  disabled,
  tone = 'default',
  to,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'urgent';
  to?: string;
}) {
  const tones = {
    default: 'border-line bg-white text-ink hover:bg-surface',
    primary: 'border-slate-800 bg-slate-800 text-white hover:bg-slate-900',
    success: 'border-teal-700 bg-teal-700 text-white hover:bg-teal-800',
    warning: 'border-transparent bg-transparent text-amber-800 hover:bg-amber-50',
    danger: 'border-transparent bg-transparent text-red-600 hover:bg-red-50',
    urgent: 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100',
  };

  const className = `inline-flex items-center justify-center rounded-lg border px-3.5 py-2 text-sm font-medium transition disabled:opacity-60 ${tones[tone]}`;

  if (to) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" disabled={disabled} onClick={onClick} className={className}>
      {children}
    </button>
  );
}
