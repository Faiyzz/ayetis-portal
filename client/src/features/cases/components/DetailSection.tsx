import type { ReactNode } from 'react';

/** Consistent card chrome for case-detail sections. */
export function DetailSection({
  id,
  title,
  description,
  actions,
  children,
  tone = 'default',
}: {
  id: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  tone?: 'default' | 'success';
}) {
  const shell =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50/40'
      : 'border-line bg-white';
  const headerBorder = tone === 'success' ? 'border-emerald-200/80' : 'border-line';

  return (
    <section
      id={id}
      className={`scroll-mt-24 overflow-hidden rounded-xl border ${shell}`}
    >
      <header
        className={`flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 ${headerBorder}`}
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
