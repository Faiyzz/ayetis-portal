import {
  ALL_PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  type CasePaymentOverview,
  type PaymentStatus,
  type UpdateCasePaymentInput,
} from '@ayetis/shared';
import { useState, type FormEvent } from 'react';
import { AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { PropertyTable } from '@/features/cases/components/detail/PropertyTable';
import api from '@/lib/api';

function money(amount: number | null, currency: string) {
  if (amount === null || amount === undefined) return '—';
  return `${currency} ${amount.toFixed(2)}`;
}

export function CasePaymentPanel({
  payment,
  invoiceId,
  canManage,
  saving,
  onSave,
}: {
  payment: CasePaymentOverview;
  invoiceId?: string | null;
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

  async function openInvoiceHtml() {
    if (!invoiceId) return;
    try {
      const { data } = await api.get(`/commercial/invoices/${invoiceId}/html`, {
        responseType: 'text',
      });
      const blob = new Blob([data], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // ignore
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    await onSave(draft);
    setEditing(false);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Payment</h2>
          <p className="mt-0.5 text-sm text-muted">Billing status and invoice details for this case.</p>
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

      <div className="p-4">
        {editing ? (
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
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
          <div className="overflow-hidden rounded-lg border border-line">
            <PropertyTable
              flush
              rows={[
                {
                  label: 'Status',
                  value: (
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {PAYMENT_STATUS_LABELS[payment.status]}
                    </span>
                  ),
                },
                { label: 'Invoice', value: payment.invoiceNumber || '—' },
                {
                  label: 'Documents',
                  value: invoiceId ? (
                    <button
                      type="button"
                      onClick={() => void openInvoiceHtml()}
                      className="font-medium text-brand-600 hover:text-brand-700"
                    >
                      Print invoice HTML
                    </button>
                  ) : (
                    '—'
                  ),
                },
                {
                  label: 'Amount due',
                  value: money(payment.amountDue, payment.currency),
                },
                {
                  label: 'Amount paid',
                  value: money(payment.amountPaid, payment.currency),
                },
                {
                  label: 'Currency',
                  value: payment.currency || '—',
                },
                {
                  label: 'Notes',
                  value: payment.notes ? (
                    <span className="whitespace-pre-wrap">{payment.notes}</span>
                  ) : (
                    '—'
                  ),
                },
                {
                  label: 'Updated',
                  value: payment.updatedAt
                    ? new Date(payment.updatedAt).toLocaleString()
                    : '—',
                },
              ]}
            />
          </div>
        )}
      </div>
    </section>
  );
}
