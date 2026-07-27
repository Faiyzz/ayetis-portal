import {
  ALL_PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  type CasePaymentOverview,
  type PaymentStatus,
  type UpdateCasePaymentInput,
} from '@ayetis/shared';
import { useState, type FormEvent } from 'react';
import { AuthButton, TextField } from '@/features/auth/components/AuthUI';

function money(amount: number | null, currency: string) {
  if (amount === null || amount === undefined) return '—';
  return `${currency} ${amount.toFixed(2)}`;
}

export function CasePaymentPanel({
  payment,
  canManage,
  saving,
  onSave,
}: {
  payment: CasePaymentOverview;
  canManage: boolean;
  saving?: boolean;
  onSave: (payload: UpdateCasePaymentInput) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UpdateCasePaymentInput>({
    status: payment.status,
    currency: payment.currency,
    amountDue: payment.amountDue,
    amountPaid: payment.amountPaid,
    invoiceNumber: payment.invoiceNumber,
    notes: payment.notes,
  });

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    await onSave(draft);
    setEditing(false);
  }

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Payment overview</h2>
          <p className="mt-1 text-sm text-muted">Billing status for this case.</p>
        </div>
        {canManage && !editing ? (
          <button
            type="button"
            onClick={() => {
              setDraft({
                status: payment.status,
                currency: payment.currency,
                amountDue: payment.amountDue,
                amountPaid: payment.amountPaid,
                invoiceNumber: payment.invoiceNumber,
                notes: payment.notes,
              });
              setEditing(true);
            }}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-brand-700 hover:border-brand-300"
          >
            Update
          </button>
        ) : null}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="mt-4 space-y-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Status</span>
            <select
              value={draft.status}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, status: e.target.value as PaymentStatus }))
              }
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            >
              {ALL_PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PAYMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Currency"
              value={draft.currency ?? 'USD'}
              onChange={(e) => setDraft((prev) => ({ ...prev, currency: e.target.value }))}
            />
            <TextField
              label="Invoice #"
              value={draft.invoiceNumber ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
            />
            <TextField
              label="Amount due"
              type="number"
              min={0}
              step="0.01"
              value={draft.amountDue ?? ''}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  amountDue: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            />
            <TextField
              label="Amount paid"
              type="number"
              min={0}
              step="0.01"
              value={draft.amountPaid ?? ''}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  amountPaid: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            />
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Notes</span>
            <textarea
              rows={2}
              value={draft.notes ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <div className="min-w-[8rem]">
              <AuthButton loading={saving}>Save payment</AuthButton>
            </div>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Status</dt>
            <dd className="mt-1">
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                {PAYMENT_STATUS_LABELS[payment.status]}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Invoice</dt>
            <dd className="mt-1 text-ink">{payment.invoiceNumber || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Amount due</dt>
            <dd className="mt-1 text-ink">{money(payment.amountDue, payment.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Amount paid</dt>
            <dd className="mt-1 text-ink">{money(payment.amountPaid, payment.currency)}</dd>
          </div>
          {payment.notes ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Notes</dt>
              <dd className="mt-1 whitespace-pre-wrap text-ink">{payment.notes}</dd>
            </div>
          ) : null}
        </dl>
      )}
    </section>
  );
}
