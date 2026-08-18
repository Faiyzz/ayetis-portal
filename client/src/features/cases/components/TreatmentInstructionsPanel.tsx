import {
  ALL_ARCH_OPTIONS,
  ARCH_OPTION_LABELS,
  EMPTY_TREATMENT_INSTRUCTIONS,
  type ArchOption,
  type TreatmentInstructions,
} from '@ayetis/shared';
import { useState, type FormEvent } from 'react';
import { AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { PropertyTable } from '@/features/cases/components/detail/PropertyTable';

const fieldClass =
  'w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:opacity-60';

export function TreatmentInstructionsFields({
  value,
  onChange,
  disabled,
}: {
  value: TreatmentInstructions;
  onChange: (next: TreatmentInstructions) => void;
  disabled?: boolean;
}) {
  function update<K extends keyof TreatmentInstructions>(key: K, next: TreatmentInstructions[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
          Appliance
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Arches</span>
            <select
              disabled={disabled}
              value={value.arches}
              onChange={(e) => update('arches', e.target.value as ArchOption | '')}
              className={fieldClass}
            >
              <option value="">Select arches</option>
              {ALL_ARCH_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {ARCH_OPTION_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Appliance type"
            disabled={disabled}
            value={value.applianceType}
            onChange={(e) => update('applianceType', e.target.value)}
            placeholder="e.g. Clear aligners, retainer, expander"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
          Goals
        </legend>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Treatment goal</span>
          <textarea
            disabled={disabled}
            rows={3}
            value={value.treatmentGoal}
            onChange={(e) => update('treatmentGoal', e.target.value)}
            placeholder="Primary clinical objectives…"
            className={fieldClass}
          />
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
          Bite & retainers
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-ink">Bite / occlusion details</span>
            <textarea
              disabled={disabled}
              rows={3}
              value={value.biteDetails}
              onChange={(e) => update('biteDetails', e.target.value)}
              className={fieldClass}
            />
          </label>
          <TextField
            label="Retainers"
            disabled={disabled}
            value={value.retainers}
            onChange={(e) => update('retainers', e.target.value)}
            placeholder="Retainer preferences or schedule"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
          Special requirements
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Special requirements</span>
            <textarea
              disabled={disabled}
              rows={3}
              value={value.specialRequirements}
              onChange={(e) => update('specialRequirements', e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Additional notes</span>
            <textarea
              disabled={disabled}
              rows={3}
              value={value.additionalNotes}
              onChange={(e) => update('additionalNotes', e.target.value)}
              className={fieldClass}
            />
          </label>
        </div>
      </fieldset>
    </div>
  );
}

export function TreatmentInstructionsPanel({
  value,
  canEdit,
  saving,
  onSave,
}: {
  value: TreatmentInstructions;
  canEdit: boolean;
  saving?: boolean;
  onSave: (next: TreatmentInstructions) => Promise<void>;
}) {
  const [draft, setDraft] = useState<TreatmentInstructions>({
    ...EMPTY_TREATMENT_INSTRUCTIONS,
    ...value,
  });
  const [editing, setEditing] = useState(false);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    await onSave({
      arches: draft.arches || '',
      applianceType: draft.applianceType,
      treatmentGoal: draft.treatmentGoal,
      biteDetails: draft.biteDetails,
      retainers: draft.retainers,
      specialRequirements: draft.specialRequirements,
      additionalNotes: draft.additionalNotes,
    });
    setEditing(false);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Treatment instructions</h2>
          <p className="mt-0.5 text-sm text-muted">Structured requirements for production.</p>
        </div>
        {canEdit && !editing ? (
          <button
            type="button"
            onClick={() => {
              setDraft({ ...EMPTY_TREATMENT_INSTRUCTIONS, ...value });
              setEditing(true);
            }}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-brand-700 hover:border-brand-300"
          >
            Edit form
          </button>
        ) : null}
      </div>

      <div className="p-4">
        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <TreatmentInstructionsFields value={draft} onChange={setDraft} />
            <div className="flex flex-wrap gap-2">
              <div className="min-w-[8rem]">
                <AuthButton loading={saving}>Save instructions</AuthButton>
              </div>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <PropertyTable
              title="Appliance"
              rows={[
                {
                  label: 'Arches',
                  value: value.arches
                    ? ARCH_OPTION_LABELS[value.arches as ArchOption]
                    : '—',
                },
                { label: 'Appliance', value: value.applianceType || '—' },
                { label: 'Retainers', value: value.retainers || '—' },
              ]}
            />
            <PropertyTable
              title="Goals & details"
              rows={[
                {
                  label: 'Treatment goal',
                  value: (
                    <span className="whitespace-pre-wrap">
                      {value.treatmentGoal || '—'}
                    </span>
                  ),
                },
                {
                  label: 'Bite details',
                  value: (
                    <span className="whitespace-pre-wrap">{value.biteDetails || '—'}</span>
                  ),
                },
              ]}
            />
            <div className="lg:col-span-2">
              <PropertyTable
                title="Special"
                rows={[
                  {
                    label: 'Special requirements',
                    value: (
                      <span className="whitespace-pre-wrap">
                        {value.specialRequirements || '—'}
                      </span>
                    ),
                  },
                  {
                    label: 'Additional notes',
                    value: (
                      <span className="whitespace-pre-wrap">
                        {value.additionalNotes || '—'}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
