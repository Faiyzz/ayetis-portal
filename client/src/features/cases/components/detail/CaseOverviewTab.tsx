import {
  ARCH_OPTION_LABELS,
  EMPTY_TREATMENT_INSTRUCTIONS,
  type CaseDetailDto,
} from '@ayetis/shared';
import { CaseValidationAssignPanel } from '@/features/cases/components/CaseValidationAssignPanel';
import { AttentionCallout, buildAttentionItems } from './AttentionCallout';
import { ClinicalStatusCard } from './clinical/ClinicalStatusCard';
import { wearScheduleLabel } from './clinical/clinicalUtils';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-ink">{value || '—'}</p>
    </div>
  );
}

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
  canAddNote?: boolean;
  savingNote?: boolean;
  onAddNote?: (body: string) => Promise<void>;
}) {
  const ti = { ...EMPTY_TREATMENT_INSTRUCTIONS, ...caseData.treatmentInstructions };
  const attention = buildAttentionItems(caseData, {
    onOpenCommunication: () => onOpenTab('communication'),
    onOpenWork: () => onOpenTab('work'),
    onOpenAssignment: canAssign || canValidate ? () => onOpenTab('assignment') : undefined,
    canAssign,
  });

  return (
    <div className="space-y-6">
      <AttentionCallout items={attention} />

      <section className="rounded-lg border border-line bg-white px-6 py-5">
        <h3 className="text-base font-semibold text-ink">Details</h3>
        <div className="mt-4 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Treatment" value={caseData.treatmentSummary} />
          <Field label="Appliance" value={ti.applianceType} />
          <Field label="Arches" value={ti.arches ? ARCH_OPTION_LABELS[ti.arches] : ''} />
          <Field label="Wear schedule" value={wearScheduleLabel(caseData)} />
          <Field label="Created" value={new Date(caseData.createdAt).toLocaleString()} />
          <Field
            label="Last updated"
            value={new Date(caseData.updatedAt).toLocaleString()}
          />
        </div>
        {ti.treatmentGoal || ti.biteDetails || caseData.instructions ? (
          <div className="mt-5 border-t border-line pt-4">
            {ti.treatmentGoal ? (
              <Field label="Treatment goal" value={ti.treatmentGoal} />
            ) : null}
            {ti.biteDetails ? (
              <div className="mt-4">
                <Field label="Bite" value={ti.biteDetails} />
              </div>
            ) : null}
            {caseData.instructions?.trim() ? (
              <div className="mt-4">
                <p className="text-xs text-muted">Instructions</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {caseData.instructions.trim()}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <ClinicalStatusCard caseData={caseData} />

      {(canAssign || canValidate) && !caseData.isDeleted ? (
        <div id="assignment-actions" className="scroll-mt-24">
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
    </div>
  );
}
