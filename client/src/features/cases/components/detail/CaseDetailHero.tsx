import {
  formatCaseIdLabel,
  type CaseDetailDto,
} from '@ayetis/shared';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PaymentBadge, PriorityBadge, StatusBadge } from './CaseBadges';

export function CaseDetailHero({
  caseData,
  actions,
  onJumpToTab,
}: {
  caseData: CaseDetailDto;
  actions: ReactNode;
  onJumpToTab?: (tabId: string) => void;
}) {
  const stats = [
    { label: 'Files', value: String(caseData.files.length), tab: 'files' },
    {
      label: 'Clarifications',
      value: String(caseData.clarifications.length),
      tab: 'communication',
      highlight: caseData.openClarificationCount > 0,
    },
    { label: 'Notes', value: String(caseData.notes.length), tab: 'communication' },
    {
      label: 'QC rejects',
      value: String(caseData.qcRejectionCount),
      tab: 'work',
      highlight: caseData.qcRejectionCount > 0,
    },
  ] as const;

  return (
    <header className="bg-white">
      <div className="flex flex-col gap-4 pb-4 pt-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={caseData.status} />
            <PriorityBadge priority={caseData.priority} />
            <PaymentBadge status={caseData.paymentStatus} />
            {caseData.openClarificationCount > 0 ? (
              <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                {caseData.openClarificationCount} open clarification
                {caseData.openClarificationCount === 1 ? '' : 's'}
              </span>
            ) : null}
            {caseData.isDeleted ? (
              <span className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                Soft-deleted
              </span>
            ) : null}
          </div>

          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              {caseData.patientName}
            </h1>
            <p className="mt-1 text-sm text-muted">
              <span className="font-medium text-ink">
                {formatCaseIdLabel(caseData.caseId, caseData.status)}
              </span>
              {caseData.treatmentSummary ? (
                <>
                  <span className="mx-1.5 text-line">·</span>
                  {caseData.treatmentSummary}
                </>
              ) : null}
            </p>
            <p className="mt-1 text-sm text-muted">
              {caseData.clinicName || 'No clinic'}
              <span className="mx-1.5 text-line">·</span>
              {caseData.country || 'No country'}
            </p>
          </div>

          <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Doctor
              </dt>
              <dd className="mt-0.5 font-medium text-ink">{caseData.doctorName}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Designer
              </dt>
              <dd className="mt-0.5 font-medium text-ink">
                {caseData.assignedDesignerName || 'Unassigned'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Age / gender
              </dt>
              <dd className="mt-0.5 font-medium text-ink">
                {caseData.patientAge ?? '—'} · {caseData.patientGender || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Created
              </dt>
              <dd className="mt-0.5 font-medium text-ink">
                {new Date(caseData.createdAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
          <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <button
                key={stat.label}
                type="button"
                onClick={() => onJumpToTab?.(stat.tab)}
                className={`min-w-[4.5rem] rounded-lg border px-3 py-2 text-left transition hover:border-brand-300 ${
                  'highlight' in stat && stat.highlight
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-line bg-surface/50'
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">
                  {stat.label}
                </p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{stat.value}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

export function CaseDetailActionButton({
  children,
  onClick,
  disabled,
  tone = 'default',
  to,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'default' | 'warning' | 'danger' | 'urgent';
  to?: string;
}) {
  const tones = {
    default: 'border-line bg-white text-ink hover:border-brand-300',
    warning: 'border-line bg-white text-amber-700 hover:bg-amber-50',
    danger: 'border-red-200 bg-white text-red-600 hover:bg-red-50',
    urgent: 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100',
  };

  const className = `rounded-lg border px-3.5 py-2 text-sm font-semibold disabled:opacity-60 ${tones[tone]}`;

  if (to) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" disabled={disabled} onClick={onClick} className={className}>
      {children}
    </button>
  );
}
