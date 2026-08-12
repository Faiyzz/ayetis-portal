import {
  ALL_IMPLANT_PLANNING_MODES,
  EMPTY_IMPLANT_DETAILS,
  IMPLANT_PLANNING_MODE_LABELS,
  TOOTH_NUMBERING_SYSTEMS,
  type FieldErrors,
  type ImplantDetails,
  type ToothNumberingSystem,
} from '@ayetis/shared';
import { TextField } from '@/features/auth/components/AuthUI';
import { FieldError, SectionCard, fieldClassName } from './FieldError';
import { ToothChart } from './ToothChart';

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((t) => t !== id) : [...list, id];
}

function YesNo({
  label,
  value,
  errorName,
  errors,
  onChange,
}: {
  label: string;
  value: boolean | null;
  errorName: string;
  errors?: FieldErrors;
  onChange: (next: boolean) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">{label}</legend>
      <div className="flex gap-2">
        {[
          { value: true, label: 'Yes' },
          { value: false, label: 'No' },
        ].map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              'rounded-lg px-4 py-1.5 text-xs font-semibold',
              value === opt.value ? 'bg-brand-600 text-white' : 'border border-line text-ink',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <FieldError errors={errors} name={errorName} />
    </fieldset>
  );
}

export function ImplantClinicalPart({
  details,
  numberingSystem,
  errors,
  onChange,
}: {
  details: ImplantDetails;
  numberingSystem: ToothNumberingSystem;
  errors?: FieldErrors;
  onChange: (patch: Partial<ImplantDetails>) => void;
}) {
  const value = { ...EMPTY_IMPLANT_DETAILS, ...details };
  const system = numberingSystem || TOOTH_NUMBERING_SYSTEMS.FDI;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SectionCard title="Implant sites">
        <p className="text-sm text-muted">
          Select planned implant positions. CBCT / DICOM is required at file upload.
        </p>
        <ToothChart
          system={system}
          selected={value.implantSites}
          onToggle={(id) => {
            const next = toggle(value.implantSites, id);
            onChange({
              implantSites: next,
              implantCount: next.length,
            });
          }}
          modeLabel="Implant site"
        />
        <FieldError errors={errors} name="implantDetails.implantSites" />
        <TextField
          label="Implant count"
          name="implantCount"
          type="number"
          min={1}
          value={value.implantCount ?? ''}
          onChange={(e) =>
            onChange({ implantCount: e.target.value ? Number(e.target.value) : null })
          }
        />
      </SectionCard>

      <SectionCard title="Planning details">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Planning mode *</span>
          <select
            value={value.planningMode}
            onChange={(e) =>
              onChange({ planningMode: e.target.value as ImplantDetails['planningMode'] })
            }
            className={fieldClassName(errors, 'implantDetails.planningMode')}
          >
            <option value="">—</option>
            {ALL_IMPLANT_PLANNING_MODES.map((item) => (
              <option key={item} value={item}>
                {IMPLANT_PLANNING_MODE_LABELS[item]}
              </option>
            ))}
          </select>
          <FieldError errors={errors} name="implantDetails.planningMode" />
        </label>
        <YesNo
          label="CBCT available *"
          value={value.cbctAvailable}
          errorName="implantDetails.cbctAvailable"
          errors={errors}
          onChange={(next) => onChange({ cbctAvailable: next })}
        />
        <YesNo
          label="Bone graft required"
          value={value.boneGraftRequired}
          errorName="implantDetails.boneGraftRequired"
          errors={errors}
          onChange={(next) => onChange({ boneGraftRequired: next })}
        />
        <YesNo
          label="Surgical guide required"
          value={value.surgicalGuideRequired}
          errorName="implantDetails.surgicalGuideRequired"
          errors={errors}
          onChange={(next) => onChange({ surgicalGuideRequired: next })}
        />
        <TextField
          label="Restoration planned"
          name="restorationPlanned"
          value={value.restorationPlanned}
          onChange={(e) => onChange({ restorationPlanned: e.target.value })}
          placeholder="e.g. screw-retained crown"
        />
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Clinical notes</span>
          <textarea
            rows={4}
            value={value.clinicalNotes}
            onChange={(e) => onChange({ clinicalNotes: e.target.value })}
            className="w-full rounded-xl border border-line bg-panel px-3.5 py-3 text-[15px]"
          />
        </label>
      </SectionCard>
    </div>
  );
}
