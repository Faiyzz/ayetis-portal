import { useEffect } from 'react';
import { useToastStore, type ToastItem, type ToastTone } from '@/features/notifications/toastStore';

const TONE_STYLES: Record<
  ToastTone,
  { bar: string; panel: string; icon: string; title: string }
> = {
  success: {
    bar: 'bg-emerald-500',
    panel: 'border-emerald-200 bg-white',
    icon: 'bg-emerald-50 text-emerald-600',
    title: 'text-emerald-700',
  },
  error: {
    bar: 'bg-red-500',
    panel: 'border-red-200 bg-white',
    icon: 'bg-red-50 text-red-600',
    title: 'text-red-700',
  },
  info: {
    bar: 'bg-brand-500',
    panel: 'border-brand-200 bg-white',
    icon: 'bg-brand-50 text-brand-600',
    title: 'text-brand-700',
  },
  warning: {
    bar: 'bg-amber-500',
    panel: 'border-amber-200 bg-white',
    icon: 'bg-amber-50 text-amber-700',
    title: 'text-amber-700',
  },
};

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'success') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M3.5 8.5L6.5 11.5L12.5 4.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (tone === 'error') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M4.5 4.5L11.5 11.5M11.5 4.5L4.5 11.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (tone === 'warning') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M8 3.5L13.5 13H2.5L8 3.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M8 7V9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="11.2" r="0.8" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7V11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="5.2" r="0.8" fill="currentColor" />
    </svg>
  );
}

function ToastCard({ toast }: { toast: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const styles = TONE_STYLES[toast.tone];

  useEffect(() => {
    if (toast.durationMs <= 0) return;
    const timer = window.setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [dismiss, toast.durationMs, toast.id]);

  return (
    <div
      role="status"
      className={[
        'pointer-events-auto flex w-full max-w-md overflow-hidden rounded-xl border shadow-[0_12px_40px_rgba(29,30,37,0.12)]',
        styles.panel,
      ].join(' ')}
    >
      <div className={`w-1 shrink-0 ${styles.bar}`} />
      <div className="flex flex-1 items-start gap-3 px-3.5 py-3">
        <span
          className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}
        >
          <ToastIcon tone={toast.tone} />
        </span>
        <div className="min-w-0 flex-1">
          {toast.title ? (
            <p className={`text-sm font-semibold ${styles.title}`}>{toast.title}</p>
          ) : null}
          <p className={`text-sm leading-relaxed text-ink ${toast.title ? 'mt-0.5' : ''}`}>
            {toast.message}
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => dismiss(toast.id)}
          className="rounded-md px-1.5 py-0.5 text-sm text-muted hover:bg-surface hover:text-ink"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-end gap-2 p-4 sm:p-5">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
