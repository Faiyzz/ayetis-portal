import {
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  isCaseDraft,
  type CasePriority,
  type CaseStatus,
  type PaymentStatus,
} from '@ayetis/shared';

const STATUS_TONE: Record<CaseStatus, string> = {
  new_case: 'bg-slate-100 text-slate-800',
  in_process: 'bg-teal-50 text-teal-800',
  waiting_for_approval: 'bg-indigo-50 text-indigo-800',
  approved: 'bg-emerald-50 text-emerald-800',
  cancelled: 'bg-slate-100 text-slate-500',
  saved_for_submission: 'bg-amber-50 text-amber-800',
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  const draft = isCaseDraft(status);
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${
        draft ? 'bg-amber-50 text-amber-800' : STATUS_TONE[status]
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
        urgent ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-700'
      }`}
    >
      {CASE_PRIORITY_LABELS[priority]}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const paid = status === 'paid' || status === 'waived';
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${
        paid ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'
      }`}
    >
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}
