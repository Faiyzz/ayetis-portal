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

  if (caseData.openClarificationCount > 0) {
    const count = caseData.openClarificationCount;
    items.push({
      id: 'clarifications',
      title:
        count > 0
          ? `${count} open clarification${count === 1 ? '' : 's'}`
          : 'Waiting for clarification',
      detail: 'Production is waiting on a reply.',
      tone: 'warning',
      action: opts?.onOpenCommunication ? (
        <button
          type="button"
          onClick={opts.onOpenCommunication}
          className="text-sm font-medium text-amber-900 underline"
        >
          Open communication
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
    return null;
  }

  const item = items[0]!;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-l-4 px-4 py-3 ${toneStyles[item.tone]}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{item.title}</p>
        {items.length > 1 ? (
          <p className="mt-0.5 text-sm text-muted">
            +{items.length - 1} more · {item.detail}
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-muted">{item.detail}</p>
        )}
      </div>
      {item.action}
    </div>
  );
}
