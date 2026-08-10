import type { ReactNode } from 'react';
import type { FieldErrors } from '@ayetis/shared';

export function FieldError({
  errors,
  name,
}: {
  errors?: FieldErrors;
  name: string;
}) {
  const message = errors?.[name];
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-red-600">{message}</p>;
}

export function fieldClassName(errors: FieldErrors | undefined, name: string, base = '') {
  const invalid = Boolean(errors?.[name]);
  return [
    base ||
      'w-full rounded-xl border bg-white px-3.5 py-3 text-[15px] text-ink outline-none focus:border-brand-400',
    invalid ? 'border-red-400' : 'border-line',
  ].join(' ');
}

export function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-line bg-surface/30 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}
