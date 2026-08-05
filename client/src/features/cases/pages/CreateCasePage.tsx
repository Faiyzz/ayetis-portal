import {
  AESTHETIC_SUBCATEGORIES,
  ALL_CASE_CATEGORIES,
  ALL_CASE_COMPLEXITIES,
  ALL_FILE_CATEGORIES,
  ALL_IMPRESSION_METHODS,
  ALL_TOOTH_NUMBERING_SYSTEMS,
  ALL_TREATMENT_APPROACHES,
  ALL_WEAR_SCHEDULES,
  ARCH_OPTIONS,
  ARCH_OPTION_LABELS,
  CASE_CATEGORIES,
  CASE_CATEGORY_LABELS,
  CASE_COMPLEXITIES,
  CASE_PRIORITIES,
  CASE_TYPE_LABELS,
  CASE_TYPES_BY_CATEGORY,
  COMPLEX_SUBCATEGORIES,
  COUNTRIES,
  EMPTY_CASE_COMMERCIAL,
  EMPTY_CLINICAL_PREFERENCES,
  EMPTY_OCCLUSION_GOALS,
  EMPTY_RECORDS_NUMBERING,
  EMPTY_TREATMENT_INSTRUCTIONS,
  FILE_CATEGORY_LABELS,
  GENDER_OPTIONS,
  IMPRESSION_METHODS,
  ROLES,
  TOOTH_NUMBERING_LABELS,
  TOOTH_NUMBERING_SYSTEMS,
  TREATMENT_APPROACH_LABELS,
  TREATMENT_APPROACHES,
  type CaseCategory,
  type CaseType,
  type CreateCaseInput,
  type DoctorAssigneeDto,
  type FileCategory,
  type TreatmentPlanDto,
} from '@ayetis/shared';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { SearchableSelect } from '@/components/SearchableSelect';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { useAuthStore } from '@/features/auth/store';
import { createCase, fetchDoctorAssignees, uploadCaseFiles } from '@/features/cases/api';
import { fetchTreatmentPlans, validateDiscountCode } from '@/features/commercial/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

const STEPS = [
  { id: 'category', title: 'Category & Type', hint: 'What kind of case is this?' },
  { id: 'records', title: 'Records', hint: 'Patient and manufacturing preferences' },
  { id: 'clinical', title: 'Clinical prefs', hint: 'Tooth chart selections' },
  { id: 'commercial', title: 'Occlusion & Commercial', hint: 'Goals, plan, and pricing' },
  { id: 'files', title: 'Files & Submit', hint: 'Attach files, save or submit' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

const FDI_UPPER = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const FDI_LOWER = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

const COUNTRY_OPTIONS = COUNTRIES.map((name) => ({ value: name, label: name }));

type ClinicalKey = keyof typeof EMPTY_CLINICAL_PREFERENCES;

function ToothChart({
  selected,
  onToggle,
  modeLabel,
}: {
  selected: string[];
  onToggle: (tooth: string) => void;
  modeLabel: string;
}) {
  function row(teeth: string[]) {
    return (
      <div className="flex flex-wrap justify-center gap-1">
        {teeth.map((tooth) => {
          const on = selected.includes(tooth);
          return (
            <button
              key={tooth}
              type="button"
              onClick={() => onToggle(tooth)}
              className={[
                'h-8 w-8 rounded-md text-xs font-semibold transition',
                on
                  ? 'bg-brand-600 text-white'
                  : 'border border-line bg-white text-ink hover:border-brand-300',
              ].join(' ')}
              title={`${modeLabel}: ${tooth}`}
            >
              {tooth}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface/40 p-3">
      <p className="text-center text-xs font-medium text-muted">Upper</p>
      {row(FDI_UPPER)}
      <div className="border-t border-dashed border-line" />
      {row(FDI_LOWER)}
      <p className="text-center text-xs font-medium text-muted">Lower</p>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CreateCasePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isDoctor = user?.role === ROLES.DOCTOR;
  const needsDoctorPicker = Boolean(user && !isDoctor);

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<CreateCaseInput>(() => ({
    patientName: '',
    patientAge: null,
    patientGender: '',
    patientDateOfBirth: null,
    clinicName: user?.clinicName ?? '',
    practiceName: user?.companyName ?? '',
    country: '',
    chiefComplaint: '',
    caseCategory: CASE_CATEGORIES.DIGITAL_ALIGNER,
    caseType: 'new',
    treatmentSummary: '',
    instructions: '',
    treatmentInstructions: { ...EMPTY_TREATMENT_INSTRUCTIONS },
    recordsNumbering: { ...EMPTY_RECORDS_NUMBERING },
    clinicalPreferences: { ...EMPTY_CLINICAL_PREFERENCES },
    occlusionGoals: { ...EMPTY_OCCLUSION_GOALS },
    commercial: { ...EMPTY_CASE_COMMERCIAL },
    priority: CASE_PRIORITIES.NORMAL,
    initialNote: '',
    doctorId: isDoctor ? user?.id : '',
    asDraft: false,
  }));
  const [clinicalMode, setClinicalMode] = useState<ClinicalKey>('doNotMoveTeeth');
  const [doctors, setDoctors] = useState<DoctorAssigneeDto[]>([]);
  const [plans, setPlans] = useState<TreatmentPlanDto[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileCategory, setFileCategory] = useState<FileCategory | ''>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const step = STEPS[stepIndex]!;
  const progress = useMemo(() => ((stepIndex + 1) / STEPS.length) * 100, [stepIndex]);
  const category = (form.caseCategory || CASE_CATEGORIES.DIGITAL_ALIGNER) as CaseCategory;
  const typeOptions = CASE_TYPES_BY_CATEGORY[category];
  const isAligner = category === CASE_CATEGORIES.DIGITAL_ALIGNER;
  const records = { ...EMPTY_RECORDS_NUMBERING, ...(form.recordsNumbering ?? {}) };
  const clinical = { ...EMPTY_CLINICAL_PREFERENCES, ...(form.clinicalPreferences ?? {}) };
  const occlusion = { ...EMPTY_OCCLUSION_GOALS, ...(form.occlusionGoals ?? {}) };
  const commercial = { ...EMPTY_CASE_COMMERCIAL, ...(form.commercial ?? {}) };

  useEffect(() => {
    if (!needsDoctorPicker) return;
    void fetchDoctorAssignees()
      .then(setDoctors)
      .catch(() => {
        setDoctors([]);
        toast().error('Unable to load doctor list');
      });
  }, [needsDoctorPicker]);

  useEffect(() => {
    void fetchTreatmentPlans(true)
      .then(setPlans)
      .catch(() => setPlans([]));
  }, []);

  const filteredPlans = useMemo(
    () =>
      plans.filter(
        (plan) => !plan.caseCategory || plan.caseCategory === category,
      ),
    [plans, category],
  );

  function update<K extends keyof CreateCaseInput>(key: K, value: CreateCaseInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateRecords(patch: Partial<typeof records>) {
    update('recordsNumbering', { ...records, ...patch });
  }

  function updateClinical(patch: Partial<typeof clinical>) {
    update('clinicalPreferences', { ...clinical, ...patch });
  }

  function updateOcclusion(patch: Partial<typeof occlusion>) {
    update('occlusionGoals', { ...occlusion, ...patch });
  }

  function updateCommercial(patch: Partial<typeof commercial>) {
    update('commercial', { ...commercial, ...patch });
  }

  function toggleTooth(tooth: string) {
    const list = clinical[clinicalMode] ?? [];
    const next = list.includes(tooth) ? list.filter((t) => t !== tooth) : [...list, tooth];
    updateClinical({ [clinicalMode]: next });
  }

  function validateStep(id: StepId): string | null {
    if (id === 'category') {
      if (!form.caseCategory) return 'Select a case category';
      if (!form.caseType) return 'Select a case type';
      if (!form.patientName.trim()) return 'Patient name is required';
      if (needsDoctorPicker && !form.doctorId) return 'Select the treating doctor';
      return null;
    }
    if (id === 'records') {
      if (!form.treatmentSummary.trim() && !form.chiefComplaint?.trim()) {
        return 'Chief complaint or treatment summary is required';
      }
      return null;
    }
    if (id === 'commercial') {
      if (isAligner && !commercial.treatmentApproach) {
        return 'Select a treatment approach';
      }
      return null;
    }
    return null;
  }

  function goNext() {
    const message = validateStep(step.id);
    if (message) {
      setError(message);
      toast().warning(message);
      return;
    }
    setError('');
    setStepIndex((index) => Math.min(index + 1, STEPS.length - 1));
  }

  function goBack() {
    setError('');
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  async function applyDiscount() {
    if (!commercial.discountCode.trim()) return;
    try {
      const result = await validateDiscountCode(commercial.discountCode.trim());
      const unit = commercial.unitPrice ?? 0;
      let discountAmount = 0;
      if (result.percentOff) discountAmount = (unit * result.percentOff) / 100;
      else if (result.amountOff) discountAmount = result.amountOff;
      updateCommercial({
        discountAmount,
        finalPayableAmount: Math.max(0, unit - discountAmount),
      });
      toast().success('Discount applied');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Invalid discount code'));
    }
  }

  async function submit(asDraft: boolean) {
    for (const s of STEPS) {
      if (s.id === 'files') continue;
      const message = validateStep(s.id);
      if (message) {
        setError(message);
        toast().warning(message);
        return;
      }
    }

    const summary =
      form.treatmentSummary.trim() ||
      form.chiefComplaint?.trim() ||
      `${CASE_CATEGORY_LABELS[category]} — ${CASE_TYPE_LABELS[form.caseType as CaseType]}`;

    setLoading(true);
    setError('');
    try {
      const created = await createCase({
        ...form,
        treatmentSummary: summary,
        asDraft,
      });
      if (pendingFiles.length > 0) {
        await uploadCaseFiles(created.caseId, pendingFiles, {
          category: fileCategory || undefined,
        });
      }
      toast().success(asDraft ? 'Case saved for submission' : 'Case submitted');
      navigate(`/app/cases/${created.caseId}`);
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to create case');
      setError(message);
      toast().error(message);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        eyebrow="Cases"
        title="Create new case"
        subtitle="Multi-step intake matching Ayetis case management requirements."
      >
        <Link to="/app/cases" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          Back to cases
        </Link>
      </PageHeader>

      <div className="rounded-xl border border-line bg-white p-4">
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((s, index) => (
            <li
              key={s.id}
              className={[
                'rounded-lg px-2.5 py-1 text-xs font-medium',
                index === stepIndex
                  ? 'bg-brand-50 text-brand-700'
                  : index < stepIndex
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-surface text-muted',
              ].join(' ')}
            >
              {index + 1}. {s.title}
            </li>
          ))}
        </ol>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-line bg-white p-5">
        <div>
          <h2 className="text-lg font-semibold text-ink">{step.title}</h2>
          <p className="text-sm text-muted">{step.hint}</p>
        </div>

        {step.id === 'category' ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {ALL_CASE_CATEGORIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    const types = CASE_TYPES_BY_CATEGORY[value];
                    update('caseCategory', value);
                    update('caseType', types[0]);
                  }}
                  className={[
                    'rounded-xl border px-3 py-3 text-left text-sm',
                    category === value
                      ? 'border-brand-500 bg-brand-50 text-brand-800'
                      : 'border-line text-ink hover:border-brand-300',
                  ].join(' ')}
                >
                  {CASE_CATEGORY_LABELS[value]}
                </button>
              ))}
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Case type</span>
              <select
                value={form.caseType || ''}
                onChange={(e) => update('caseType', e.target.value as CaseType)}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
              >
                {typeOptions.map((value) => (
                  <option key={value} value={value}>
                    {CASE_TYPE_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="Patient name"
              name="patientName"
              value={form.patientName}
              onChange={(e) => update('patientName', e.target.value)}
              required
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField
                label="Age"
                name="age"
                type="number"
                value={form.patientAge ?? ''}
                onChange={(e) =>
                  update('patientAge', e.target.value ? Number(e.target.value) : null)
                }
              />
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Gender</span>
                <select
                  value={form.patientGender || ''}
                  onChange={(e) => update('patientGender', e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
                >
                  <option value="">—</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                label="Date of birth"
                name="dob"
                type="date"
                value={form.patientDateOfBirth ?? ''}
                onChange={(e) => update('patientDateOfBirth', e.target.value || null)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Practice name"
                name="practice"
                value={form.practiceName || ''}
                onChange={(e) => update('practiceName', e.target.value)}
              />
              <TextField
                label="Clinic"
                name="clinic"
                value={form.clinicName || ''}
                onChange={(e) => update('clinicName', e.target.value)}
              />
            </div>
            <SearchableSelect
              label="Country"
              options={COUNTRY_OPTIONS}
              value={form.country || ''}
              onChange={(value) => update('country', value)}
            />
            {needsDoctorPicker ? (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Treating doctor</span>
                <select
                  value={form.doctorId || ''}
                  onChange={(e) => update('doctorId', e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
                >
                  <option value="">Select doctor…</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {`${d.firstName} ${d.lastName}`.trim()} ({d.email})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}

        {step.id === 'records' ? (
          <div className="space-y-4">
            <TextField
              label="Chief complaint"
              name="complaint"
              value={form.chiefComplaint || ''}
              onChange={(e) => update('chiefComplaint', e.target.value)}
            />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Treatment summary</span>
              <textarea
                value={form.treatmentSummary}
                onChange={(e) => update('treatmentSummary', e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
              />
            </label>
            {isAligner ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-ink">Tooth numbering</span>
                    <select
                      value={records.toothNumberingSystem}
                      onChange={(e) =>
                        updateRecords({
                          toothNumberingSystem: e.target.value as typeof TOOTH_NUMBERING_SYSTEMS.FDI,
                        })
                      }
                      className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
                    >
                      {ALL_TOOTH_NUMBERING_SYSTEMS.map((value) => (
                        <option key={value} value={value}>
                          {TOOTH_NUMBERING_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-ink">Impression method</span>
                    <select
                      value={records.impressionMethod}
                      onChange={(e) => updateRecords({ impressionMethod: e.target.value as typeof IMPRESSION_METHODS.DIGITAL_SCAN | '' })}
                      className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
                    >
                      <option value="">—</option>
                      {ALL_IMPRESSION_METHODS.map((value) => (
                        <option key={value} value={value}>
                          {value === IMPRESSION_METHODS.DIGITAL_SCAN ? 'Digital scan' : 'PVS'}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-ink">Treat arches</span>
                  <select
                    value={records.treatArches}
                    onChange={(e) =>
                      updateRecords({
                        treatArches: e.target.value as typeof ARCH_OPTIONS.BOTH | '',
                      })
                    }
                    className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
                  >
                    <option value="">—</option>
                    {Object.values(ARCH_OPTIONS).map((value) => (
                      <option key={value} value={value}>
                        {ARCH_OPTION_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-ink">Complexity</span>
                    <select
                      value={records.caseComplexity}
                      onChange={(e) =>
                        updateRecords({
                          caseComplexity: e.target.value as typeof CASE_COMPLEXITIES.SIX_SIX | '',
                        })
                      }
                      className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
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
                      value={records.wearSchedule}
                      onChange={(e) => updateRecords({ wearSchedule: e.target.value as typeof ALL_WEAR_SCHEDULES[number] | '' })}
                      className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
                    >
                      <option value="">—</option>
                      {ALL_WEAR_SCHEDULES.map((value) => (
                        <option key={value} value={value}>
                          {value.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <TextField
                    label="Planned duration"
                    name="duration"
                    value={records.plannedTreatmentDuration}
                    onChange={(e) => updateRecords({ plannedTreatmentDuration: e.target.value })}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">
                Category-specific clinical parameters are reduced for prosthodontic / implant cases.
                Commercial and files still apply.
              </p>
            )}
          </div>
        ) : null}

        {step.id === 'clinical' ? (
          <div className="space-y-4">
            {isAligner ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['doNotMoveTeeth', 'Do not move'],
                      ['avoidEngagersTeeth', 'No engagers'],
                      ['extractionTeeth', 'Extractions'],
                      ['leaveSpacesOpenTeeth', 'Leave spaces'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setClinicalMode(key)}
                      className={[
                        'rounded-lg px-3 py-1.5 text-xs font-semibold',
                        clinicalMode === key
                          ? 'bg-brand-600 text-white'
                          : 'border border-line text-ink',
                      ].join(' ')}
                    >
                      {label} ({clinical[key].length})
                    </button>
                  ))}
                </div>
                <ToothChart
                  selected={clinical[clinicalMode]}
                  onToggle={toggleTooth}
                  modeLabel={clinicalMode}
                />
              </>
            ) : (
              <p className="text-sm text-muted">Tooth-chart preferences apply to aligner cases.</p>
            )}
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Additional instructions</span>
              <textarea
                value={form.instructions || ''}
                onChange={(e) => update('instructions', e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
              />
            </label>
          </div>
        ) : null}

        {step.id === 'commercial' ? (
          <div className="space-y-4">
            {isAligner ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    label="Overjet (mm)"
                    name="overjet"
                    type="number"
                    value={occlusion.overjetMm ?? ''}
                    onChange={(e) =>
                      updateOcclusion({
                        overjetMm: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                  <TextField
                    label="Overbite (%)"
                    name="overbite"
                    type="number"
                    value={occlusion.overbitePercent ?? ''}
                    onChange={(e) =>
                      updateOcclusion({
                        overbitePercent: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-ink">Clinical instructions</span>
                  <textarea
                    value={occlusion.clinicalInstructions}
                    onChange={(e) => updateOcclusion({ clinicalInstructions: e.target.value })}
                    rows={2}
                    className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-ink">Treatment approach</span>
                  <select
                    value={commercial.treatmentApproach}
                    onChange={(e) =>
                      updateCommercial({
                        treatmentApproach: e.target.value as typeof TREATMENT_APPROACHES.AESTHETIC | '',
                        treatmentSubCategory: '',
                      })
                    }
                    className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
                  >
                    <option value="">—</option>
                    {ALL_TREATMENT_APPROACHES.map((value) => (
                      <option key={value} value={value}>
                        {TREATMENT_APPROACH_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>
                {commercial.treatmentApproach ? (
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-ink">Sub-category</span>
                    <select
                      value={commercial.treatmentSubCategory}
                      onChange={(e) => updateCommercial({ treatmentSubCategory: e.target.value })}
                      className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
                    >
                      <option value="">—</option>
                      {(commercial.treatmentApproach === TREATMENT_APPROACHES.AESTHETIC
                        ? AESTHETIC_SUBCATEGORIES
                        : COMPLEX_SUBCATEGORIES
                      ).map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </>
            ) : null}

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Treatment plan</span>
              <select
                value={commercial.treatmentPlanId || ''}
                onChange={(e) => {
                  const plan = filteredPlans.find((p) => p.id === e.target.value);
                  updateCommercial({
                    treatmentPlanId: plan?.id ?? null,
                    treatmentPlanName: plan?.name ?? '',
                    unitPrice: plan?.price ?? null,
                    currency: plan?.currency ?? 'USD',
                    finalPayableAmount: plan?.price ?? null,
                    discountAmount: null,
                  });
                }}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
              >
                <option value="">Select plan…</option>
                {filteredPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} — {plan.currency} {plan.price.toFixed(2)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <TextField
                label="Discount code"
                name="discount"
                value={commercial.discountCode}
                onChange={(e) => updateCommercial({ discountCode: e.target.value })}
              />
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => void applyDiscount()}
                  className="rounded-xl border border-line px-4 py-3 text-sm font-semibold"
                >
                  Apply
                </button>
              </div>
            </div>
            <p className="text-sm text-muted">
              Payable:{' '}
              <span className="font-semibold text-ink">
                {commercial.currency}{' '}
                {(commercial.finalPayableAmount ?? commercial.unitPrice ?? 0).toFixed(2)}
              </span>
            </p>
          </div>
        ) : null}

        {step.id === 'files' ? (
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">File category</span>
              <select
                value={fileCategory}
                onChange={(e) => setFileCategory(e.target.value as FileCategory | '')}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
              >
                <option value="">Unspecified</option>
                {ALL_FILE_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {FILE_CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="file"
              multiple
              onChange={(e) => setPendingFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-sm"
            />
            {pendingFiles.length > 0 ? (
              <ul className="space-y-1 text-sm text-muted">
                {pendingFiles.map((file) => (
                  <li key={`${file.name}-${file.size}`}>
                    {file.name} · {formatBytes(file.size)}
                  </li>
                ))}
              </ul>
            ) : null}
            <TextField
              label="Initial note"
              name="note"
              value={form.initialNote || ''}
              onChange={(e) => update('initialNote', e.target.value)}
            />
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Submit starts the 15-minute cancel window and SLA clock. Save for Submission keeps the
              case as a draft.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={goBack}
            disabled={stepIndex === 0 || loading}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Back
          </button>
          <div className="flex flex-wrap gap-2">
            {step.id === 'files' ? (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void submit(true)}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-40"
                >
                  Save for Submission
                </button>
                <AuthButton type="button" loading={loading} onClick={() => void submit(false)}>
                  Submit case
                </AuthButton>
              </>
            ) : (
              <AuthButton type="button" onClick={goNext}>
                Continue
              </AuthButton>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
