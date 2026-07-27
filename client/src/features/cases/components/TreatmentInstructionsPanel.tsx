import {
  ALL_ARCH_OPTIONS,
  ARCH_OPTION_LABELS,
  EMPTY_TREATMENT_INSTRUCTIONS,
  type ArchOption,
  type TreatmentInstructions,
} from '@ayetis/shared';
import { useState, type FormEvent } from 'react';
import { AuthButton, TextField } from '@/features/auth/components/AuthUI';

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
    <div className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink">Arches</span>
        <select
          disabled={disabled}
          value={value.arches}
          onChange={(e) => update('arches', e.target.value as ArchOption | '')}
          className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:opacity-60"
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

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink">Treatment goal</span>
        <textarea
          disabled={disabled}
          rows={3}
          value={value.treatmentGoal}
          onChange={(e) => update('treatmentGoal', e.target.value)}
          placeholder="Primary clinical objectives…"
          className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:opacity-60"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink">Bite / occlusion details</span>
        <textarea
          disabled={disabled}
          rows={3}
          value={value.biteDetails}
          onChange={(e) => update('biteDetails', e.target.value)}
          className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:opacity-60"
        />
      </label>

      <TextField
        label="Retainers"
        disabled={disabled}
        value={value.retainers}
        onChange={(e) => update('retainers', e.target.value)}
        placeholder="Retainer preferences or schedule"
      />

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink">Special requirements</span>
        <textarea
          disabled={disabled}
          rows={3}
          value={value.specialRequirements}
          onChange={(e) => update('specialRequirements', e.target.value)}
          className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:opacity-60"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink">Additional notes</span>
        <textarea
          disabled={disabled}
          rows={3}
          value={value.additionalNotes}
          onChange={(e) => update('additionalNotes', e.target.value)}
          className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:opacity-60"
        />
      </label>
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
    await onSave(draft);
    setEditing(false);
  }

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Treatment instructions</h2>
          <p className="mt-1 text-sm text-muted">Structured requirements for production.</p>
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

      {editing ? (
        <form onSubmit={handleSave} className="mt-4 space-y-4">
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
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          {(
            [
              ['Arches', value.arches ? ARCH_OPTION_LABELS[value.arches as ArchOption] : '—'],
              ['Appliance', value.applianceType || '—'],
              ['Retainers', value.retainers || '—'],
              ['Treatment goal', value.treatmentGoal || '—'],
              ['Bite details', value.biteDetails || '—'],
              ['Special requirements', value.specialRequirements || '—'],
              ['Additional notes', value.additionalNotes || '—'],
            ] as Array<[string, string]>
          ).map(([label, text]) => (
            <div key={label} className={label.includes('goal') || label.includes('Bite') || label.includes('Special') || label.includes('Additional') ? 'sm:col-span-2' : ''}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-ink">{text}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
