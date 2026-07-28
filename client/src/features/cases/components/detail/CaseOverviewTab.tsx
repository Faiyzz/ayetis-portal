import {
  ARCH_OPTION_LABELS,
  ASSIGNMENT_MODE_LABELS,
  CASE_STATUS_LABELS,
  EMPTY_TREATMENT_INSTRUCTIONS,
  type CaseDetailDto,
} from '@ayetis/shared';
import { useState } from 'react';
import { Alert } from '@/features/auth/components/AuthUI';
import { CaseStatusTimeline } from '@/features/cases/components/CaseStatusTimeline';
import { CaseValidationAssignPanel } from '@/features/cases/components/CaseValidationAssignPanel';
import { AttentionCallout, buildAttentionItems } from './AttentionCallout';
import { PropertyTable } from './PropertyTable';

export function CaseOverviewTab({
  caseData,
  onOpenTab,
  onUpdated,
  canAssign = false,
  canValidate = false,
  canSetPriority = false,
}: {
  caseData: CaseDetailDto;
  onOpenTab: (tabId: string) => void;
  onUpdated: (next: CaseDetailDto) => void;
  canAssign?: boolean;
  canValidate?: boolean;
  canSetPriority?: boolean;
}) {
  const [showAllInstructions, setShowAllInstructions] = useState(false);
  const instructions = caseData.instructions?.trim() || '';
  const longInstructions = instructions.length > 220;
  const visibleInstructions =
    !longInstructions || showAllInstructions
      ? instructions || 'No free-text instructions provided.'
      : `${instructions.slice(0, 220).trimEnd()}…`;

  const ti = { ...EMPTY_TREATMENT_INSTRUCTIONS, ...caseData.treatmentInstructions };
  const attention = buildAttentionItems(caseData, {
    onOpenCommunication: () => onOpenTab('communication'),
    onOpenWork: () => onOpenTab('work'),
    onOpenAssignment: canAssign || canValidate ? () => onOpenTab('assignment') : undefined,
    canAssign,
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <PropertyTable
            title="Patient"
            rows={[
              { label: 'Name', value: caseData.patientName },
              {
                label: 'Age / gender',
                value: `${caseData.patientAge ?? '—'} · ${caseData.patientGender || '—'}`,
              },
              { label: 'Clinic', value: caseData.clinicName || '—' },
              { label: 'Country', value: caseData.country || '—' },
            ]}
          />
          <PropertyTable
            title="Case"
            rows={[
              { label: 'Case ID', value: caseData.caseId },
              { label: 'Status', value: CASE_STATUS_LABELS[caseData.status] },
              { label: 'Treatment', value: caseData.treatmentSummary || '—' },
              {
                label: 'Created',
                value: new Date(caseData.createdAt).toLocaleString(),
              },
              {
                label: 'Updated',
                value: new Date(caseData.updatedAt).toLocaleString(),
              },
            ]}
          />
        </div>

        <PropertyTable
          title="Assignment"
          rows={[
            { label: 'Doctor', value: caseData.doctorName },
            {
              label: 'Designer',
              value: caseData.assignedDesignerName || 'Unassigned',
            },
            {
              label: 'Assignment mode',
              value: ASSIGNMENT_MODE_LABELS[caseData.assignmentMode],
            },
            {
              label: 'Consultant',
              value: caseData.assignedConsultantName || '—',
            },
            {
              label: 'Validated',
              value: caseData.validatedAt
                ? `${new Date(caseData.validatedAt).toLocaleString()}${
                    caseData.validatedByName ? ` · ${caseData.validatedByName}` : ''
                  }`
                : 'Not validated',
            },
          ]}
        />

        {(canAssign || canValidate) && !caseData.isDeleted ? (
          <div id="assignment-actions" className="scroll-mt-40">
            <CaseValidationAssignPanel
              caseData={caseData}
              canValidate={canValidate}
              canAssign={canAssign}
              canSetPriority={canSetPriority}
              onUpdated={onUpdated}
              onOpenClarifications={() => onOpenTab('communication')}
            />
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <PropertyTable
            title="Appliance"
            rows={[
              {
                label: 'Arches',
                value: ti.arches ? ARCH_OPTION_LABELS[ti.arches] : '—',
              },
              { label: 'Appliance', value: ti.applianceType || '—' },
              { label: 'Retainers', value: ti.retainers || '—' },
            ]}
          />
          <PropertyTable
            title="Goals & details"
            rows={[
              { label: 'Treatment goal', value: ti.treatmentGoal || '—' },
              { label: 'Bite details', value: ti.biteDetails || '—' },
            ]}
          />
          <div className="lg:col-span-2">
            <PropertyTable
              title="Special"
              rows={[
                { label: 'Special requirements', value: ti.specialRequirements || '—' },
                { label: 'Additional notes', value: ti.additionalNotes || '—' },
              ]}
            />
          </div>
        </div>

        <div className="rounded-xl border border-line bg-white">
          <div className="border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold text-ink">Free-text instructions</h3>
          </div>
          <div className="px-4 py-3.5">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {visibleInstructions}
            </p>
            {longInstructions ? (
              <button
                type="button"
                onClick={() => setShowAllInstructions((v) => !v)}
                className="mt-2 text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                {showAllInstructions ? 'Show less' : 'Show more'}
              </button>
            ) : null}
            {caseData.cancelReason ? (
              <div className="mt-3">
                <Alert tone="info">Cancel reason: {caseData.cancelReason}</Alert>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <AttentionCallout items={attention} />
        <CaseStatusTimeline
          variant="compact"
          steps={caseData.timeline}
          currentLabel={CASE_STATUS_LABELS[caseData.status]}
          isCancelled={caseData.status === 'cancelled'}
        />
      </aside>
    </div>
  );
}
