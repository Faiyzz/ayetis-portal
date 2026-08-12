import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, id, className = '', ...props }: TextFieldProps) {
  const fieldId = id ?? props.name;

  return (
    <label className="block space-y-1.5" htmlFor={fieldId}>
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        id={fieldId}
        className={[
          'w-full rounded-xl border bg-panel px-3.5 py-3 text-[15px] text-ink outline-none transition',
          'placeholder:text-muted/70',
          'focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15',
          error ? 'border-red-400' : 'border-line',
          className,
        ].join(' ')}
        {...props}
      />
      {hint ? <span className="block text-xs leading-relaxed text-muted">{hint}</span> : null}
      {error ? <span className="block text-sm text-red-500">{error}</span> : null}
    </label>
  );
}

interface AuthButtonProps {
  children: ReactNode;
  loading?: boolean;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'ghost' | 'dark';
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

  const styles = {
    primary:
      'bg-brand-500 text-white shadow-[0_8px_24px_rgba(15,23,42,0.20)] hover:bg-brand-600 active:bg-brand-700',
    ghost: 'bg-transparent text-brand-600 hover:bg-brand-50',
    dark: 'bg-slate-900 text-white shadow-[0_10px_28px_rgba(15,23,42,0.22)] hover:bg-slate-800 active:bg-slate-950',
  }[variant];

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
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  brandTone?: 'brand' | 'dark';
}

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  onSubmit,
  brandTone = 'brand',
}: AuthCardProps) {
  return (
    <div className="w-full max-w-105">
      <div className="mb-8">
        <BrandMark tone={brandTone} />
        <h1 className="mt-8 text-[1.75rem] font-bold tracking-tight text-ink">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{subtitle}</p>
      </div>

      {onSubmit ? (
        <form onSubmit={onSubmit} className="space-y-4">
          {children}
        </form>
      ) : (
        <div className="space-y-4">{children}</div>
      )}

      {footer ? <div className="mt-6 text-center text-sm text-muted">{footer}</div> : null}
    </div>
  );
}

export function BrandMark({
  tone = 'brand',
  companyName,
  logoUrl,
}: {
  tone?: 'brand' | 'dark';
  companyName?: string | null;
  logoUrl?: string | null;
}) {
  const dark = tone === 'dark';
  const name = companyName?.trim() || 'Ayetis';
  return (
    <div className="inline-flex items-center gap-2.5">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-9 w-9 rounded-xl object-contain" />
      ) : (
        <span
          className={[
            'flex h-9 w-9 items-center justify-center rounded-xl text-white',
            dark
              ? 'bg-slate-900 shadow-[0_6px_18px_rgba(15,23,42,0.25)]'
              : 'bg-brand-500 shadow-[0_6px_18px_rgba(15,23,42,0.22)]',
          ].join(' ')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 19L12 5L19 19H15.2L12 12.5L8.8 19H5Z" fill="currentColor" />
          </svg>
        </span>
      )}
      <span className="text-xl font-bold tracking-tight text-ink">
        {name}
        <span className={dark ? 'text-slate-500' : 'text-brand-500'}>.</span>
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
