import {
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  isCaseDraft,
  type CasePriority,
  type CaseStatus,
  type PaymentStatus,
} from '@ayetis/shared';

export function StatusBadge({ status }: { status: CaseStatus }) {
  const draft = isCaseDraft(status);
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${
        draft ? 'bg-amber-50 text-amber-800' : 'bg-brand-50 text-brand-700'
      }`}
    >
      {CASE_STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: CasePriority }) {
  const urgent = priority === 'urgent';
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${
        urgent ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'
      }`}
    >
      {CASE_PRIORITY_LABELS[priority]}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}
