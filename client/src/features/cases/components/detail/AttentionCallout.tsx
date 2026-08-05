import { isCaseDeliveryLocked, type CaseDetailDto } from '@ayetis/shared';
import type { ReactNode } from 'react';

export type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  tone: 'warning' | 'danger' | 'info';
  action?: ReactNode;
};

export function buildAttentionItems(
  caseData: CaseDetailDto,
  opts?: {
    onOpenCommunication?: () => void;
    onOpenWork?: () => void;
    onOpenAssignment?: () => void;
    canAssign?: boolean;
  },
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const deliveryLocked = isCaseDeliveryLocked(caseData.status);

  if (caseData.status === 'in_process') {
    items.push({
      id: 'waiting-clarification',
      title: 'Waiting for clarification',
      detail: 'This case is blocked until the doctor provides the requested information.',
      tone: 'warning',
      action: opts?.onOpenCommunication ? (
        <button
          type="button"
          onClick={opts.onOpenCommunication}
          className="text-xs font-semibold text-amber-900 underline"
        >
          Open communication
        </button>
      ) : undefined,
    });
  }

  if (caseData.openClarificationCount > 0) {
    items.push({
      id: 'open-clarifications',
      title: `${caseData.openClarificationCount} open clarification${caseData.openClarificationCount === 1 ? '' : 's'}`,
      detail: 'Review and reply so production can continue.',
      tone: 'warning',
      action: opts?.onOpenCommunication ? (
        <button
          type="button"
          onClick={opts.onOpenCommunication}
          className="text-xs font-semibold text-amber-900 underline"
        >
          View threads
        </button>
      ) : undefined,
    });
  }

  if (!deliveryLocked && (caseData.qcRejectionCount > 0 || caseData.lastQcComments)) {
    items.push({
      id: 'qc-rejection',
      title:
        caseData.qcRejectionCount > 0
          ? `QC rejected ${caseData.qcRejectionCount} time${caseData.qcRejectionCount === 1 ? '' : 's'}`
          : 'QC feedback pending',
      detail: caseData.lastQcComments || caseData.lastQcRequiredChanges || 'Review QC notes in Work.',
      tone: 'danger',
      action: opts?.onOpenWork ? (
        <button
          type="button"
          onClick={opts.onOpenWork}
          className="text-xs font-semibold text-red-800 underline"
        >
          Open work
        </button>
      ) : undefined,
    });
  }

  if (
    opts?.canAssign &&
    !deliveryLocked &&
    !caseData.assignedDesignerId &&
    caseData.status !== 'cancelled' &&
    !caseData.isDeleted
  ) {
    items.push({
      id: 'unassigned',
      title: 'No designer assigned',
      detail: 'Assign a designer or queue this case for auto pick-up.',
      tone: 'info',
      action: opts?.onOpenAssignment ? (
        <button
          type="button"
          onClick={opts.onOpenAssignment}
          className="text-xs font-semibold text-brand-700 underline"
        >
          Go to assignment
        </button>
      ) : undefined,
    });
  }

  if (caseData.isDeleted) {
    items.push({
      id: 'deleted',
      title: 'Soft-deleted',
      detail: caseData.deleteReason || 'This case is marked for deletion.',
      tone: 'danger',
    });
  }

  if (caseData.cancelReason && caseData.status === 'cancelled') {
    items.push({
      id: 'cancelled',
      title: 'Case cancelled',
      detail: caseData.cancelReason,
      tone: 'danger',
    });
  }

  return items;
}

const toneStyles = {
  warning: 'border-l-amber-400 bg-amber-50/50',
  danger: 'border-l-red-400 bg-red-50/40',
  info: 'border-l-brand-400 bg-brand-50/40',
} as const;

export function AttentionCallout({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-white px-4 py-4">
        <p className="text-sm font-semibold text-ink">All clear</p>
        <p className="mt-1 text-sm text-muted">Nothing requires attention right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Needs attention</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={`rounded-r-lg border border-line border-l-4 px-3.5 py-3 ${toneStyles[item.tone]}`}
          >
            <p className="text-sm font-semibold text-ink">{item.title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted">{item.detail}</p>
            {item.action ? <div className="mt-2">{item.action}</div> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
