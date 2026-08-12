import {
  ALL_PROSTHO_MATERIALS,
  EMPTY_PROSTHO_DETAILS,
  PROSTHO_MATERIAL_LABELS,
  PROSTHO_MATERIALS,
  TOOTH_NUMBERING_SYSTEMS,
  type FieldErrors,
  type ProsthoDetails,
  type ToothNumberingSystem,
} from '@ayetis/shared';
import { TextField } from '@/features/auth/components/AuthUI';
import { FieldError, SectionCard, fieldClassName } from './FieldError';
import { ToothChart } from './ToothChart';

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((t) => t !== id) : [...list, id];
}

export function ProsthodonticClinicalPart({
  details,
  numberingSystem,
  errors,
  onChange,
}: {
  details: ProsthoDetails;
  numberingSystem: ToothNumberingSystem;
  errors?: FieldErrors;
  onChange: (patch: Partial<ProsthoDetails>) => void;
}) {
  const value = { ...EMPTY_PROSTHO_DETAILS, ...details };
  const system = numberingSystem || TOOTH_NUMBERING_SYSTEMS.FDI;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SectionCard title="Restoration teeth">
        <p className="text-sm text-muted">
          Mark units for the selected prosthodontic type (crown, bridge, partial, or complete
          denture). The same tooth may appear in more than one set.
        </p>
        <ToothChart
          system={system}
          selected={value.restorationTeeth}
          onToggle={(id) => onChange({ restorationTeeth: toggle(value.restorationTeeth, id) })}
          modeLabel="Restoration"
        />
        <FieldError errors={errors} name="prosthoDetails.restorationTeeth" />
        <ToothChart
          system={system}
          selected={value.abutmentTeeth}
          onToggle={(id) => onChange({ abutmentTeeth: toggle(value.abutmentTeeth, id) })}
          modeLabel="Abutments"
        />
        <ToothChart
          system={system}
          selected={value.ponticTeeth}
          onToggle={(id) => onChange({ ponticTeeth: toggle(value.ponticTeeth, id) })}
          modeLabel="Pontics"
        />
      </SectionCard>

      <SectionCard title="Material & notes">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Material *</span>
          <select
            value={value.material}
            onChange={(e) => onChange({ material: e.target.value as ProsthoDetails['material'] })}
            className={fieldClassName(errors, 'prosthoDetails.material')}
          >
            <option value="">—</option>
            {ALL_PROSTHO_MATERIALS.map((item) => (
              <option key={item} value={item}>
                {PROSTHO_MATERIAL_LABELS[item]}
              </option>
            ))}
          </select>
          <FieldError errors={errors} name="prosthoDetails.material" />
        </label>
        {value.material === PROSTHO_MATERIALS.OTHER ? (
          <div>
            <TextField
              label="Specify material *"
              name="materialOther"
              value={value.materialOther}
              onChange={(e) => onChange({ materialOther: e.target.value })}
            />
            <FieldError errors={errors} name="prosthoDetails.materialOther" />
          </div>
        ) : null}
        <TextField
          label="Shade"
          name="shade"
          value={value.shade}
          onChange={(e) => onChange({ shade: e.target.value })}
          placeholder="e.g. A2"
        />
        <TextField
          label="Units"
          name="units"
          type="number"
          min={1}
          value={value.units ?? ''}
          onChange={(e) => onChange({ units: e.target.value ? Number(e.target.value) : null })}
        />
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Antagonist / occlusion notes</span>
          <textarea
            rows={3}
            value={value.antagonistNotes}
            onChange={(e) => onChange({ antagonistNotes: e.target.value })}
            className="w-full rounded-xl border border-line bg-panel px-3.5 py-3 text-[15px]"
          />
        </label>
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
