import {
  ADDITIONAL_RECORD_LABELS,
  ALL_ADDITIONAL_RECORDS,
  ALL_CASE_CATEGORIES,
  ALL_CASE_COMPLEXITIES,
  ALL_IMPRESSION_METHODS,
  ALL_TOOTH_NUMBERING_SYSTEMS,
  ALL_TRIMLINE_HEIGHTS,
  ALL_VELOCITY_PER_STAGE,
  ALL_WEAR_SCHEDULES,
  ARCH_OPTION_LABELS,
  ARCH_OPTIONS,
  CASE_CATEGORY_LABELS,
  CASE_TYPE_LABELS,
  CASE_TYPES_BY_CATEGORY,
  COUNTRIES,
  EMPTY_RECORDS_NUMBERING,
  GENDER_OPTIONS,
  IMPRESSION_METHOD_LABELS,
  TOOTH_NUMBERING_LABELS,
  TRIMLINE_HEIGHT_LABELS,
  VELOCITY_PER_STAGE,
  VELOCITY_PER_STAGE_LABELS,
  WEAR_SCHEDULE_LABELS,
  type CaseCategory,
  type CaseType,
  type CreateCaseInput,
  type DoctorAssigneeDto,
  type FieldErrors,
  type RecordsNumbering,
} from '@ayetis/shared';
import { SearchableSelect } from '@/components/SearchableSelect';
import { TextField } from '@/features/auth/components/AuthUI';
import { FieldError, SectionCard, fieldClassName } from './FieldError';

const COUNTRY_OPTIONS = COUNTRIES.map((name) => ({ value: name, label: name }));

export type RecordsFormSlice = Pick<
  CreateCaseInput,
  | 'patientName'
  | 'patientAge'
  | 'patientGender'
  | 'patientDateOfBirth'
  | 'practiceName'
  | 'clinicName'
  | 'country'
  | 'chiefComplaint'
  | 'caseCategory'
  | 'caseType'
  | 'doctorId'
  | 'treatmentSummary'
>;

export function RecordsNumberingPart({
  form,
  records,
  errors,
  doctors,
  needsDoctorPicker,
  onFormChange,
  onRecordsChange,
}: {
  form: RecordsFormSlice;
  records: RecordsNumbering;
  errors?: FieldErrors;
  doctors: DoctorAssigneeDto[];
  needsDoctorPicker: boolean;
  onFormChange: <K extends keyof RecordsFormSlice>(key: K, value: RecordsFormSlice[K]) => void;
  onRecordsChange: (patch: Partial<RecordsNumbering>) => void;
}) {
  const category = (form.caseCategory || ALL_CASE_CATEGORIES[0]) as CaseCategory;
  const typeOptions = CASE_TYPES_BY_CATEGORY[category];
  const recordsMerged = { ...EMPTY_RECORDS_NUMBERING, ...records };

  function toggleImpressionTaken(arch: (typeof ARCH_OPTIONS)[keyof typeof ARCH_OPTIONS]) {
    const current = recordsMerged.impressionsTaken ?? [];
    const next = current.includes(arch)
      ? current.filter((a) => a !== arch)
      : [...current, arch];
    onRecordsChange({ impressionsTaken: next });
  }

  function toggleAdditionalRecord(value: string) {
    const current = recordsMerged.additionalRecords ?? [];
    const next = current.includes(value)
      ? current.filter((a) => a !== value)
      : [...current, value];
    onRecordsChange({ additionalRecords: next });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SectionCard title="Patient information">
        <div className="grid gap-3">
          {ALL_CASE_CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                onFormChange('caseCategory', value);
                onFormChange('caseType', CASE_TYPES_BY_CATEGORY[value][0]);
              }}
              className={[
                'rounded-xl border px-3 py-2.5 text-left text-sm',
                category === value
                  ? 'border-brand-500 bg-brand-50 text-brand-800'
                  : 'border-line text-ink hover:border-brand-300',
              ].join(' ')}
            >
              {CASE_CATEGORY_LABELS[value]}
            </button>
          ))}
          <FieldError errors={errors} name="caseCategory" />
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Case type *</span>
          <select
            value={form.caseType || ''}
            onChange={(e) => onFormChange('caseType', e.target.value as CaseType)}
            className={fieldClassName(errors, 'caseType')}
          >
            {typeOptions.map((value) => (
              <option key={value} value={value}>
                {CASE_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
          <FieldError errors={errors} name="caseType" />
        </label>

        <div>
          <TextField
            label="Patient name *"
            name="patientName"
            value={form.patientName}
            onChange={(e) => onFormChange('patientName', e.target.value)}
            required
          />
          <FieldError errors={errors} name="patientName" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Age"
            name="age"
            type="number"
            value={form.patientAge ?? ''}
            onChange={(e) =>
              onFormChange('patientAge', e.target.value ? Number(e.target.value) : null)
            }
          />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Gender</span>
            <select
              value={form.patientGender || ''}
              onChange={(e) => onFormChange('patientGender', e.target.value)}
              className={fieldClassName(errors, 'patientGender')}
            >
              <option value="">—</option>
              {GENDER_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <TextField
            label="Date of birth"
            name="dob"
            type="date"
            value={form.patientDateOfBirth ?? ''}
            onChange={(e) => onFormChange('patientDateOfBirth', e.target.value || null)}
          />
          <FieldError errors={errors} name="patientDateOfBirth" />
        </div>

        <div>
          <TextField
            label="Practice name *"
            name="practice"
            value={form.practiceName || ''}
            onChange={(e) => onFormChange('practiceName', e.target.value)}
          />
          <FieldError errors={errors} name="practiceName" />
        </div>

        <TextField
          label="Clinic"
          name="clinic"
          value={form.clinicName || ''}
          onChange={(e) => onFormChange('clinicName', e.target.value)}
        />

        <SearchableSelect
          label="Country"
          options={COUNTRY_OPTIONS}
          value={form.country || ''}
          onChange={(value) => onFormChange('country', value)}
        />

        {needsDoctorPicker ? (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Treating doctor *</span>
            <select
              value={form.doctorId || ''}
              onChange={(e) => onFormChange('doctorId', e.target.value)}
              className={fieldClassName(errors, 'doctorId')}
            >
              <option value="">Select doctor…</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {`${d.firstName} ${d.lastName}`.trim()} ({d.email})
                </option>
              ))}
            </select>
            <FieldError errors={errors} name="doctorId" />
          </label>
        ) : null}

        <div>
          <TextField
            label="Chief complaint *"
            name="complaint"
            value={form.chiefComplaint || ''}
            onChange={(e) => onFormChange('chiefComplaint', e.target.value)}
          />
          <FieldError errors={errors} name="chiefComplaint" />
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Treatment summary</span>
          <textarea
            value={form.treatmentSummary}
            onChange={(e) => onFormChange('treatmentSummary', e.target.value)}
            rows={3}
            className={fieldClassName(errors, 'treatmentSummary')}
          />
        </label>
      </SectionCard>

      <SectionCard title="Treatment parameters">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Tooth numbering system</span>
          <select
            value={recordsMerged.toothNumberingSystem}
            onChange={(e) =>
              onRecordsChange({
                toothNumberingSystem: e.target.value as RecordsNumbering['toothNumberingSystem'],
              })
            }
            className={fieldClassName(errors, 'recordsNumbering.toothNumberingSystem')}
          >
            {ALL_TOOTH_NUMBERING_SYSTEMS.map((value) => (
              <option key={value} value={value}>
                {TOOTH_NUMBERING_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Impression method *</span>
          <select
            value={recordsMerged.impressionMethod}
            onChange={(e) =>
              onRecordsChange({
                impressionMethod: e.target.value as RecordsNumbering['impressionMethod'],
              })
            }
            className={fieldClassName(errors, 'recordsNumbering.impressionMethod')}
          >
            <option value="">—</option>
            {ALL_IMPRESSION_METHODS.map((value) => (
              <option key={value} value={value}>
                {IMPRESSION_METHOD_LABELS[value]}
              </option>
            ))}
          </select>
          <FieldError errors={errors} name="recordsNumbering.impressionMethod" />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">Impressions taken</legend>
          <div className="flex flex-wrap gap-2">
            {Object.values(ARCH_OPTIONS).map((arch) => {
              const on = recordsMerged.impressionsTaken.includes(arch);
              return (
                <button
                  key={arch}
                  type="button"
                  onClick={() => toggleImpressionTaken(arch)}
                  className={[
                    'rounded-lg px-3 py-1.5 text-xs font-semibold',
                    on ? 'bg-brand-600 text-white' : 'border border-line text-ink',
                  ].join(' ')}
                >
                  {ARCH_OPTION_LABELS[arch]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">Additional records</legend>
          <div className="flex flex-wrap gap-2">
            {ALL_ADDITIONAL_RECORDS.map((value) => {
              const on = recordsMerged.additionalRecords.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleAdditionalRecord(value)}
                  className={[
                    'rounded-lg px-3 py-1.5 text-xs font-semibold',
                    on ? 'bg-brand-600 text-white' : 'border border-line text-ink',
                  ].join(' ')}
                >
                  {ADDITIONAL_RECORD_LABELS[value]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Treat arches *</span>
          <select
            value={recordsMerged.treatArches}
            onChange={(e) =>
              onRecordsChange({
                treatArches: e.target.value as RecordsNumbering['treatArches'],
              })
            }
            className={fieldClassName(errors, 'recordsNumbering.treatArches')}
          >
            <option value="">—</option>
            {Object.values(ARCH_OPTIONS).map((value) => (
              <option key={value} value={value}>
                {ARCH_OPTION_LABELS[value]}
              </option>
            ))}
          </select>
          <FieldError errors={errors} name="recordsNumbering.treatArches" />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Velocity per stage *</span>
          <select
            value={recordsMerged.velocityPerStage}
            onChange={(e) => onRecordsChange({ velocityPerStage: e.target.value })}
            className={fieldClassName(errors, 'recordsNumbering.velocityPerStage')}
          >
            <option value="">—</option>
            {ALL_VELOCITY_PER_STAGE.map((value) => (
              <option key={value} value={value}>
                {VELOCITY_PER_STAGE_LABELS[value]}
              </option>
            ))}
          </select>
          <FieldError errors={errors} name="recordsNumbering.velocityPerStage" />
        </label>

        {recordsMerged.velocityPerStage === VELOCITY_PER_STAGE.OTHER ? (
          <div>
            <TextField
              label="Custom velocity (mm) *"
              name="velocityCustom"
              value={recordsMerged.velocityCustomMm}
              onChange={(e) => onRecordsChange({ velocityCustomMm: e.target.value })}
            />
            <FieldError errors={errors} name="recordsNumbering.velocityCustomMm" />
          </div>
        ) : null}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Case type (complexity)</span>
          <select
            value={recordsMerged.caseComplexity}
            onChange={(e) =>
              onRecordsChange({
                caseComplexity: e.target.value as RecordsNumbering['caseComplexity'],
              })
            }
            className={fieldClassName(errors, 'recordsNumbering.caseComplexity')}
          >
            <option value="">—</option>
            {ALL_CASE_COMPLEXITIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Wear schedule</span>
          <select
            value={recordsMerged.wearSchedule}
            onChange={(e) =>
              onRecordsChange({
                wearSchedule: e.target.value as RecordsNumbering['wearSchedule'],
              })
            }
            className={fieldClassName(errors, 'recordsNumbering.wearSchedule')}
          >
            <option value="">—</option>
            {ALL_WEAR_SCHEDULES.map((value) => (
              <option key={value} value={value}>
                {WEAR_SCHEDULE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Trimline height</span>
          <select
            value={recordsMerged.trimlineHeight}
            onChange={(e) =>
              onRecordsChange({
                trimlineHeight: e.target.value as RecordsNumbering['trimlineHeight'],
              })
            }
            className={fieldClassName(errors, 'recordsNumbering.trimlineHeight')}
          >
            <option value="">—</option>
            {ALL_TRIMLINE_HEIGHTS.map((value) => (
              <option key={value} value={value}>
                {TRIMLINE_HEIGHT_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">Retainer required *</legend>
          <div className="flex gap-2">
            {[
              { value: true, label: 'Yes' },
              { value: false, label: 'No' },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => onRecordsChange({ retainerRequired: opt.value })}
                className={[
                  'rounded-lg px-4 py-1.5 text-xs font-semibold',
                  recordsMerged.retainerRequired === opt.value
                    ? 'bg-brand-600 text-white'
                    : 'border border-line text-ink',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <FieldError errors={errors} name="recordsNumbering.retainerRequired" />
        </fieldset>

        <TextField
          label="Planned treatment duration"
          name="duration"
          value={recordsMerged.plannedTreatmentDuration}
          onChange={(e) => onRecordsChange({ plannedTreatmentDuration: e.target.value })}
          placeholder="e.g. 6–9 months"
        />
      </SectionCard>
    </div>
  );
}
