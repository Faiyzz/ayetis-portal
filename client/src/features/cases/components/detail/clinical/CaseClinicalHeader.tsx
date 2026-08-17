import {
  CASE_STATUS_LABELS,
  formatCaseIdLabel,
  type CaseDetailDto,
} from '@ayetis/shared';
import type { ReactNode } from 'react';
import { PaymentBadge, PriorityBadge, StatusBadge } from '../CaseBadges';
import { TreatmentJourneyTimeline } from './TreatmentJourneyTimeline';
import { buildClinicalJourney, personInitials } from './clinicalUtils';

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

export function CaseClinicalHeader({
  caseData,
  actions,
}: {
  caseData: CaseDetailDto;
  actions: ReactNode;
  alerts?: ReactNode;
}) {
  const milestones = buildClinicalJourney(caseData);
  const sla =
    caseData.slaUtilizationPercent != null
      ? `SLA ${Math.round(caseData.slaUtilizationPercent)}%`
      : null;

  return (
    <header className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="flex gap-0">
        <span
          className={`w-1 shrink-0 ${
            caseData.status === 'approved'
              ? 'bg-emerald-500'
              : caseData.status === 'cancelled' || caseData.isDeleted
                ? 'bg-slate-400'
                : caseData.priority === 'urgent'
                  ? 'bg-amber-400'
                  : 'bg-teal-600'
          }`}
          aria-hidden
        />
        <div className="min-w-0 flex-1 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-slate-100 text-lg font-semibold text-slate-700"
                aria-hidden
              >
                {personInitials(caseData.patientName)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                    {caseData.patientName}
                  </h2>
                  <StatusBadge status={caseData.status} />
                  {caseData.priority === 'urgent' ? (
                    <PriorityBadge priority={caseData.priority} />
                  ) : null}
                  <PaymentBadge status={caseData.paymentStatus} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                  <Meta label="Case ID" value={formatCaseIdLabel(caseData.caseId, caseData.status)} />
                  <Meta
                    label="Age / gender"
                    value={`${caseData.patientAge ?? '—'} · ${caseData.patientGender || '—'}`}
                  />
                  <Meta label="Country" value={caseData.country || '—'} />
                  <Meta label="Doctor" value={caseData.doctorName} />
                  <Meta label="Clinic" value={caseData.clinicName || '—'} />
                  <Meta label="Designer" value={caseData.assignedDesignerName || 'Unassigned'} />
                  <Meta label="Turnaround" value={sla || 'No SLA'} />
                </dl>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
              {actions}
            </div>
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <TreatmentJourneyTimeline
              milestones={milestones}
              currentLabel={CASE_STATUS_LABELS[caseData.status]}
              isCancelled={caseData.status === 'cancelled'}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

export { CaseDetailActionButton, CaseMoreMenu } from './CaseMoreMenu';
