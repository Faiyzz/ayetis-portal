import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  useDialogStore,
  type ActiveDialog,
  type DialogTone,
} from '@/components/dialog/dialogStore';

const TONE_CONFIRM: Record<DialogTone, string> = {
  default: 'bg-brand-600 text-white hover:bg-brand-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  warning: 'bg-amber-600 text-white hover:bg-amber-700',
};

function DialogIcon({ tone }: { tone: DialogTone }) {
  if (tone === 'danger') {
    return (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M10 6.5v4.25M10 13.75h.01"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </span>
    );
  }

  if (tone === 'warning') {
    return (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-700">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M10 4.5 16.5 16H3.5L10 4.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M10 9v3.25" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="10" cy="14.25" r="0.85" fill="currentColor" />
        </svg>
      </span>
    );
  }

  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 9v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <circle cx="10" cy="6.75" r="0.85" fill="currentColor" />
      </svg>
    </span>
  );
}

function DialogFrame({
  dialog,
  children,
  onCancel,
}: {
  dialog: ActiveDialog;
  children: ReactNode;
  onCancel: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'input, textarea, button:not([disabled])',
    );
    focusable?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-ink/45 backdrop-blur-[1px]"
        onClick={onCancel}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
      >
        <div className="flex gap-3 border-b border-line px-5 py-4">
          <DialogIcon tone={dialog.tone ?? 'default'} />
          <div className="min-w-0 pt-0.5">
            <h2 id={titleId} className="text-[15px] font-semibold tracking-tight text-ink">
              {dialog.title}
            </h2>
            {dialog.message ? (
              <p className="mt-1 text-sm leading-relaxed text-muted">{dialog.message}</p>
            ) : null}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmBody({ dialog }: { dialog: Extract<ActiveDialog, { kind: 'confirm' }> }) {
  return (
    <DialogFrame dialog={dialog} onCancel={() => dialog.resolve(false)}>
      <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => dialog.resolve(false)}
          className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface"
        >
          {dialog.cancelLabel ?? 'Cancel'}
        </button>
        <button
          type="button"
          onClick={() => dialog.resolve(true)}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${TONE_CONFIRM[dialog.tone ?? 'default']}`}
        >
          {dialog.confirmLabel ?? 'Confirm'}
        </button>
      </div>
    </DialogFrame>
  );
}

function AlertBody({ dialog }: { dialog: Extract<ActiveDialog, { kind: 'alert' }> }) {
  return (
    <DialogFrame dialog={dialog} onCancel={() => dialog.resolve()}>
      <div className="flex justify-end px-5 py-4">
        <button
          type="button"
          onClick={() => dialog.resolve()}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${TONE_CONFIRM[dialog.tone ?? 'default']}`}
        >
          {dialog.confirmLabel ?? 'OK'}
        </button>
      </div>
    </DialogFrame>
  );
}

function PromptBody({ dialog }: { dialog: Extract<ActiveDialog, { kind: 'prompt' }> }) {
  const inputId = useId();
  const [value, setValue] = useState(dialog.defaultValue ?? '');
  const [error, setError] = useState('');

  function validate(next: string): string | null {
    const trimmed = next.trim();
    if (dialog.matchValue != null) {
      return trimmed === dialog.matchValue
        ? trimmed
        : null;
    }
    if ((dialog.minLength ?? 0) > 0 && trimmed.length < (dialog.minLength ?? 0)) {
      return null;
    }
    return trimmed;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (dialog.matchValue != null && trimmed !== dialog.matchValue) {
      setError(`Type ${dialog.matchValue} exactly to continue.`);
      return;
    }
    if ((dialog.minLength ?? 0) > 0 && trimmed.length < (dialog.minLength ?? 0)) {
      setError(`Enter at least ${dialog.minLength} characters.`);
      return;
    }
    const result = validate(value);
    if (result == null) {
      setError('Please enter a valid value.');
      return;
    }
    dialog.resolve(result);
  }

  return (
    <DialogFrame dialog={dialog} onCancel={() => dialog.resolve(null)}>
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
        <label className="block space-y-1.5" htmlFor={inputId}>
          <span className="text-sm font-medium text-ink">{dialog.label ?? 'Value'}</span>
          <input
            id={inputId}
            type={dialog.inputType ?? 'text'}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError('');
            }}
            placeholder={dialog.placeholder}
            className={[
              'w-full rounded-xl border bg-white px-3.5 py-3 text-[15px] text-ink outline-none transition',
              'placeholder:text-muted/70 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15',
              error ? 'border-red-400' : 'border-line',
            ].join(' ')}
            autoComplete="off"
          />
          {error ? <span className="text-sm text-red-500">{error}</span> : null}
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => dialog.resolve(null)}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface"
          >
            {dialog.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="submit"
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${TONE_CONFIRM[dialog.tone ?? 'default']}`}
          >
            {dialog.confirmLabel ?? 'Continue'}
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}

export function DialogHost() {
  const dialog = useDialogStore((s) => s.dialog);
  if (!dialog) return null;

  if (dialog.kind === 'confirm') return <ConfirmBody dialog={dialog} />;
  if (dialog.kind === 'prompt') return <PromptBody dialog={dialog} />;
  return <AlertBody dialog={dialog} />;
}
