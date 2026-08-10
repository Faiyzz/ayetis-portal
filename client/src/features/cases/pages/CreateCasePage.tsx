import {
  ALL_FILE_CATEGORIES,
  CASE_CATEGORIES,
  CASE_CATEGORY_LABELS,
  CASE_PRIORITIES,
  CASE_TYPE_LABELS,
  EMPTY_CASE_COMMERCIAL,
  EMPTY_CLINICAL_PREFERENCES,
  EMPTY_OCCLUSION_GOALS,
  EMPTY_RECORDS_NUMBERING,
  EMPTY_TREATMENT_INSTRUCTIONS,
  FILE_CATEGORY_LABELS,
  ROLES,
  TOOTH_NUMBERING_SYSTEMS,
  firstFieldError,
  validateDigitalAlignerPart1,
  validateDigitalAlignerPart3,
  type CaseCategory,
  type CaseType,
  type CreateCaseInput,
  type DoctorAssigneeDto,
  type FieldErrors,
  type FileCategory,
  type TreatmentPlanDto,
} from '@ayetis/shared';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { useAuthStore } from '@/features/auth/store';
import { createCase, fetchDoctorAssignees, uploadCaseFiles } from '@/features/cases/api';
import {
  ClinicalPreferencesPart,
  OcclusionCommercialPart,
  RecordsNumberingPart,
} from '@/features/cases/components/treatment-form';
import { fetchTreatmentPlans, validateDiscountCode } from '@/features/commercial/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

const ALIGNER_STEPS = [
  { id: 'records', title: 'Part 1 — Records & Numbering', hint: 'Patient info and treatment parameters' },
  { id: 'clinical', title: 'Part 2 — Clinical Preferences', hint: 'Interactive tooth chart selections' },
  {
    id: 'occlusion_commercial',
    title: 'Part 3 — Occlusion & Commercial',
    hint: 'Goals, approach, plan, and pricing',
  },
  { id: 'files', title: 'Files & Submit', hint: 'Attach files, save or submit' },
] as const;

const OTHER_STEPS = [
  { id: 'records', title: 'Patient & Case', hint: 'Category, patient, and summary' },
  { id: 'files', title: 'Files & Submit', hint: 'Attach files, save or submit' },
] as const;

type AlignerStepId = (typeof ALIGNER_STEPS)[number]['id'];
type OtherStepId = (typeof OTHER_STEPS)[number]['id'];
type StepId = AlignerStepId | OtherStepId;

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
    practiceName: user?.clinicName || user?.companyName || '',
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
  const [doctors, setDoctors] = useState<DoctorAssigneeDto[]>([]);
  const [plans, setPlans] = useState<TreatmentPlanDto[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileCategory, setFileCategory] = useState<FileCategory | ''>('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const category = (form.caseCategory || CASE_CATEGORIES.DIGITAL_ALIGNER) as CaseCategory;
  const isAligner = category === CASE_CATEGORIES.DIGITAL_ALIGNER;
  const steps = isAligner ? ALIGNER_STEPS : OTHER_STEPS;
  const step = steps[Math.min(stepIndex, steps.length - 1)]!;
  const progress = useMemo(
    () => ((Math.min(stepIndex, steps.length - 1) + 1) / steps.length) * 100,
    [stepIndex, steps.length],
  );

  const records = { ...EMPTY_RECORDS_NUMBERING, ...(form.recordsNumbering ?? {}) };
  const clinical = { ...EMPTY_CLINICAL_PREFERENCES, ...(form.clinicalPreferences ?? {}) };
  const occlusion = { ...EMPTY_OCCLUSION_GOALS, ...(form.occlusionGoals ?? {}) };
  const commercial = { ...EMPTY_CASE_COMMERCIAL, ...(form.commercial ?? {}) };

  useEffect(() => {
    setStepIndex(0);
  }, [isAligner]);

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
    () => plans.filter((plan) => !plan.caseCategory || plan.caseCategory === category),
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

  function validateStep(id: StepId): FieldErrors {
    if (id === 'records') {
      if (isAligner) {
        return validateDigitalAlignerPart1({
          patientName: form.patientName,
          practiceName: form.practiceName,
          clinicName: form.clinicName,
          chiefComplaint: form.chiefComplaint,
          patientDateOfBirth: form.patientDateOfBirth,
          caseCategory: form.caseCategory,
          caseType: form.caseType,
          doctorId: form.doctorId,
          needsDoctorPicker,
          recordsNumbering: records,
        });
      }
      const errors: FieldErrors = {};
      if (!form.caseCategory) errors.caseCategory = 'Select a case category';
      if (!form.caseType) errors.caseType = 'Select a case type';
      if (!form.patientName.trim()) errors.patientName = 'Patient name is required';
      if (!form.treatmentSummary.trim() && !form.chiefComplaint?.trim()) {
        errors.chiefComplaint = 'Chief complaint or treatment summary is required';
      }
      if (needsDoctorPicker && !form.doctorId) errors.doctorId = 'Select the treating doctor';
      return errors;
    }
    if (id === 'occlusion_commercial' && isAligner) {
      return validateDigitalAlignerPart3({ commercial });
    }
    return {};
  }

  function goNext() {
    const errors = validateStep(step.id as StepId);
    setFieldErrors(errors);
    const message = firstFieldError(errors);
    if (message) {
      setError(message);
      toast().warning(message);
      return;
    }
    setError('');
    setFieldErrors({});
    setStepIndex((index) => Math.min(index + 1, steps.length - 1));
  }

  function goBack() {
    setError('');
    setFieldErrors({});
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
    if (!asDraft) {
      const allErrors: FieldErrors = {
        ...validateStep('records'),
        ...(isAligner ? validateStep('occlusion_commercial') : {}),
      };
      setFieldErrors(allErrors);
      const message = firstFieldError(allErrors);
      if (message) {
        setError(message);
        toast().warning(message);
        return;
      }
    } else if (!form.patientName.trim()) {
      setError('Patient name is required to save a draft');
      toast().warning('Patient name is required to save a draft');
      return;
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
        practiceName: form.practiceName || form.clinicName || '',
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
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        eyebrow="Cases"
        title="Digital Treatment Planning"
        subtitle={
          isAligner
            ? 'Clinical case submission engine — Records, Clinical Preferences, Occlusion & Commercial.'
            : 'Create a case with patient details, summary, and files.'
        }
      >
        <Link to="/app/cases" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          Back to cases
        </Link>
      </PageHeader>

      <div className="rounded-xl border border-line bg-white p-4">
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <ol className="flex flex-wrap gap-2">
          {steps.map((s, index) => (
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

        {step.id === 'records' ? (
          isAligner ? (
            <RecordsNumberingPart
              form={form}
              records={records}
              errors={fieldErrors}
              doctors={doctors}
              needsDoctorPicker={needsDoctorPicker}
              onFormChange={update}
              onRecordsChange={updateRecords}
            />
          ) : (
            <RecordsNumberingPart
              form={form}
              records={records}
              errors={fieldErrors}
              doctors={doctors}
              needsDoctorPicker={needsDoctorPicker}
              onFormChange={update}
              onRecordsChange={updateRecords}
            />
          )
        ) : null}

        {step.id === 'clinical' ? (
          <ClinicalPreferencesPart
            clinical={clinical}
            numberingSystem={records.toothNumberingSystem || TOOTH_NUMBERING_SYSTEMS.FDI}
            instructions={form.instructions}
            onClinicalChange={updateClinical}
            onInstructionsChange={(value) => update('instructions', value)}
          />
        ) : null}

        {step.id === 'occlusion_commercial' ? (
          <OcclusionCommercialPart
            occlusion={occlusion}
            commercial={commercial}
            plans={filteredPlans}
            errors={fieldErrors}
            onOcclusionChange={updateOcclusion}
            onCommercialChange={updateCommercial}
            onApplyDiscount={() => void applyDiscount()}
          />
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
              accept=".stl,.obj,.ply,.dcm,.dicom,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tif,.tiff,.pdf,.zip,.rar,.7z,.mp4,.mov,.webm,.avi,.mkv,.wmv,.html,.htm,.txt,.csv,image/*,video/*"
              onChange={(e) => setPendingFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-sm"
            />
            <p className="text-xs text-muted">
              Archives (ZIP/RAR/7Z) are extracted after submit; STL members are classified as scans.
            </p>
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
