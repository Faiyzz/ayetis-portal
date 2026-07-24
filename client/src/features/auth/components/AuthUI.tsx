import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function TextField({ label, error, id, className = '', ...props }: TextFieldProps) {
  const fieldId = id ?? props.name;

  return (
    <label className="block space-y-1.5" htmlFor={fieldId}>
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        id={fieldId}
        className={[
          'w-full rounded-xl border bg-white px-3.5 py-3 text-[15px] text-ink outline-none transition',
          'placeholder:text-muted/70',
          'focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15',
          error ? 'border-red-400' : 'border-line',
          className,
        ].join(' ')}
        {...props}
      />
      {error ? <span className="text-sm text-red-500">{error}</span> : null}
    </label>
  );
}

interface AuthButtonProps {
  children: ReactNode;
  loading?: boolean;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'ghost';
  onClick?: () => void;
  disabled?: boolean;
}

export function AuthButton({
  children,
  loading,
  type = 'submit',
  variant = 'primary',
  onClick,
  disabled,
}: AuthButtonProps) {
  const base =
    'inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60';

  const styles =
    variant === 'primary'
      ? 'bg-brand-500 text-white shadow-[0_8px_24px_rgba(103,61,230,0.28)] hover:bg-brand-600 active:bg-brand-700'
      : 'bg-transparent text-brand-600 hover:bg-brand-50';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${styles}`}
    >
      {loading ? 'Please wait…' : children}
    </button>
  );
}

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function AuthCard({ title, subtitle, children, footer, onSubmit }: AuthCardProps) {
  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-8">
        <BrandMark />
        <h1 className="mt-8 text-[1.75rem] font-bold tracking-tight text-ink">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{subtitle}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {children}
      </form>

      {footer ? <div className="mt-6 text-center text-sm text-muted">{footer}</div> : null}
    </div>
  );
}

export function BrandMark() {
  return (
    <div className="inline-flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white shadow-[0_6px_18px_rgba(103,61,230,0.35)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 19L12 5L19 19H15.2L12 12.5L8.8 19H5Z" fill="currentColor" />
        </svg>
      </span>
      <span className="text-xl font-bold tracking-tight text-ink">
        Ayetis<span className="text-brand-500">.</span>
      </span>
    </div>
  );
}

export function Alert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success' | 'info';
  children: ReactNode;
}) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    info: 'border-brand-200 bg-brand-50 text-brand-700',
  }[tone];

  return (
    <div className={`rounded-xl border px-3.5 py-3 text-sm leading-relaxed ${styles}`}>
      {children}
    </div>
  );
}
