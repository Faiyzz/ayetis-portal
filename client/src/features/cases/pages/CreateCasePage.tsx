import {
  ALL_FILE_CATEGORIES,
  CASE_CATEGORIES,
  CASE_CATEGORY_LABELS,
  CASE_PRIORITIES,
  CASE_TYPE_LABELS,
  DEMO_CASE_MESSAGES,
  EMPTY_CASE_COMMERCIAL,
  EMPTY_CLINICAL_PREFERENCES,
  EMPTY_IMPLANT_DETAILS,
  EMPTY_OCCLUSION_GOALS,
  EMPTY_PROSTHO_DETAILS,
  EMPTY_RECORDS_NUMBERING,
  EMPTY_TREATMENT_INSTRUCTIONS,
  FILE_CATEGORY_LABELS,
  ROLES,
  TOOTH_NUMBERING_SYSTEMS,
  firstFieldError,
  validateDigitalAlignerPart1,
  validateDigitalAlignerPart3,
  validateImplantSubmit,
  validatePatientCore,
  validateProsthodonticSubmit,
  validateRequiredCaseFiles,
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
import {
  createCase,
  fetchDoctorAssignees,
  uploadCaseFiles,
} from '@/features/cases/api';
import {
  ClinicalPreferencesPart,
  ImplantClinicalPart,
  OcclusionCommercialPart,
  ProsthodonticClinicalPart,
  RecordsNumberingPart,
} from '@/features/cases/components/treatment-form';
import {
  checkCreateEligibility,
  createPaymentSession,
  fetchTreatmentPlans,
  resolvePricing,
} from '@/features/commercial/api';
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

const CLINICAL_STEPS = [
  { id: 'records', title: 'Part 1 — Patient & records', hint: 'Category, patient, and impressions' },
  { id: 'clinical', title: 'Part 2 — Clinical details', hint: 'Tooth chart and restoration / implant plan' },
  {
    id: 'occlusion_commercial',
    title: 'Part 3 — Commercial',
    hint: 'Treatment plan, discount, and pricing',
  },
  { id: 'files', title: 'Files & Submit', hint: 'Required scans/photos and submit' },
] as const;

type StepId =
  | (typeof ALIGNER_STEPS)[number]['id']
  | (typeof CLINICAL_STEPS)[number]['id'];

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
    prosthoDetails: { ...EMPTY_PROSTHO_DETAILS },
    implantDetails: { ...EMPTY_IMPLANT_DETAILS },
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
  const isProstho = category === CASE_CATEGORIES.PROSTHODONTIC;
  const isImplant = category === CASE_CATEGORIES.IMPLANT;
  const steps = isAligner ? ALIGNER_STEPS : CLINICAL_STEPS;
  const step = steps[Math.min(stepIndex, steps.length - 1)]!;
  const progress = useMemo(
    () => ((Math.min(stepIndex, steps.length - 1) + 1) / steps.length) * 100,
    [stepIndex, steps.length],
  );

  const records = { ...EMPTY_RECORDS_NUMBERING, ...(form.recordsNumbering ?? {}) };
  const clinical = { ...EMPTY_CLINICAL_PREFERENCES, ...(form.clinicalPreferences ?? {}) };
  const occlusion = { ...EMPTY_OCCLUSION_GOALS, ...(form.occlusionGoals ?? {}) };
  const prostho = { ...EMPTY_PROSTHO_DETAILS, ...(form.prosthoDetails ?? {}) };
  const implant = { ...EMPTY_IMPLANT_DETAILS, ...(form.implantDetails ?? {}) };
  const commercial = { ...EMPTY_CASE_COMMERCIAL, ...(form.commercial ?? {}) };

  useEffect(() => {
    setStepIndex(0);
  }, [category]);

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

  function patientCore() {
    return {
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
    };
  }

  function validateStep(id: StepId): FieldErrors {
    if (id === 'records') {
      if (isAligner) return validateDigitalAlignerPart1(patientCore());
      return validatePatientCore(patientCore());
    }
    if (id === 'clinical') {
      if (isProstho) {
        const errors = validateProsthodonticSubmit({
          patient: patientCore(),
          prosthoDetails: prostho,
          commercial: { treatmentPlanId: commercial.treatmentPlanId || 'pending' },
        });
        delete errors['commercial.treatmentPlanId'];
        return errors;
      }
      if (isImplant) {
        const errors = validateImplantSubmit({
          patient: patientCore(),
          implantDetails: implant,
          commercial: { treatmentPlanId: commercial.treatmentPlanId || 'pending' },
        });
        delete errors['commercial.treatmentPlanId'];
        return errors;
      }
      return {};
    }
    if (id === 'occlusion_commercial') {
      if (isAligner) return validateDigitalAlignerPart3({ commercial });
      if (!commercial.treatmentPlanId) {
        return { 'commercial.treatmentPlanId': 'Select a treatment plan' };
      }
    }
    if (id === 'files') {
      return validateRequiredCaseFiles(
        category,
        pendingFiles.map((file) => ({ name: file.name, category: fileCategory })),
      );
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
    if (!commercial.discountCode.trim() || !commercial.treatmentPlanId) return;
    try {
      const pricing = await resolvePricing({
        treatmentPlanId: commercial.treatmentPlanId,
        discountCode: commercial.discountCode.trim(),
        caseCategory: category,
      });
      updateCommercial({
        unitPrice: pricing.unitPrice,
        discountAmount: pricing.discountAmount,
        finalPayableAmount: pricing.finalPayableAmount,
        currency: pricing.currency,
        treatmentPlanName: pricing.treatmentPlanName,
        discountCode: pricing.discountCode ?? commercial.discountCode,
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
        ...validateStep('clinical'),
        ...validateStep('occlusion_commercial'),
        ...validateStep('files'),
      };
      setFieldErrors(allErrors);
      const message = firstFieldError(allErrors);
      if (message) {
        setError(message);
        toast().warning(message);
        return;
      }
    }

    const summary =
      form.treatmentSummary.trim() ||
      form.chiefComplaint?.trim() ||
      (asDraft
        ? ''
        : `${CASE_CATEGORY_LABELS[category]} — ${CASE_TYPE_LABELS[form.caseType as CaseType]}`);

    const payload: CreateCaseInput = {
      ...form,
      practiceName: form.practiceName || form.clinicName || '',
      treatmentSummary: summary,
      doctorId: form.doctorId?.trim() || undefined,
      facilityId: form.facilityId?.trim() || undefined,
      asDraft,
    };

    setLoading(true);
    setError('');
    try {
      if (!asDraft && commercial.treatmentPlanId) {
        const eligibility = await checkCreateEligibility({
          treatmentPlanId: commercial.treatmentPlanId,
          discountCode: commercial.discountCode || null,
          isDemo: Boolean(form.isDemo),
          caseCategory: category,
        });
        updateCommercial({
          unitPrice: eligibility.pricing.unitPrice,
          discountAmount: eligibility.pricing.discountAmount,
          finalPayableAmount: eligibility.pricing.finalPayableAmount,
          currency: eligibility.pricing.currency,
          treatmentPlanName: eligibility.pricing.treatmentPlanName,
        });
        if (eligibility.pricing.isFreeDemoPlan) {
          payload.isDemo = true;
        }
        if (!eligibility.allowedWithoutPayment) {
          const session = await createPaymentSession({
            ...payload,
            commercial: {
              ...commercial,
              unitPrice: eligibility.pricing.unitPrice,
              discountAmount: eligibility.pricing.discountAmount,
              finalPayableAmount: eligibility.pricing.finalPayableAmount,
              currency: eligibility.pricing.currency,
              treatmentPlanName: eligibility.pricing.treatmentPlanName,
            },
          });
          toast().info(eligibility.message || 'Payment required');
          navigate(`/app/pay/${session.id}`);
          return;
        }
        if (eligibility.reason === 'demo' || payload.isDemo) {
          toast().success(DEMO_CASE_MESSAGES.confirmation);
        }
      }

      const created = await createCase(payload);
      if (pendingFiles.length > 0) {
        await uploadCaseFiles(created.caseId, pendingFiles, {
          category: fileCategory || undefined,
        });
      }
      toast().success(
        asDraft
          ? 'Draft saved — you can continue this case later from the cases list'
          : payload.isDemo
            ? 'Demo case submitted'
            : 'Case submitted',
      );
      navigate(asDraft ? '/app/cases' : `/app/cases/${created.caseId}`);
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
    <div className="w-full space-y-5">
      <PageHeader
        eyebrow="Cases"
        title="Digital Treatment Planning"
        subtitle={
          isAligner
            ? 'Clinical case submission engine — Records, Clinical Preferences, Occlusion & Commercial.'
            : isProstho
              ? 'Prosthodontic planning — patient records, restoration chart, plan, and files.'
              : isImplant
                ? 'Implant planning — patient records, implant sites, plan, and CBCT/scans.'
                : 'Create a case with patient details, clinical information, and files.'
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
          <RecordsNumberingPart
            form={form}
            records={records}
            errors={fieldErrors}
            doctors={doctors}
            needsDoctorPicker={needsDoctorPicker}
            onFormChange={update}
            onRecordsChange={updateRecords}
            showAlignerParams={isAligner}
          />
        ) : null}

        {step.id === 'clinical' ? (
          isProstho ? (
            <ProsthodonticClinicalPart
              details={prostho}
              numberingSystem={records.toothNumberingSystem || TOOTH_NUMBERING_SYSTEMS.FDI}
              errors={fieldErrors}
              onChange={(patch) => update('prosthoDetails', { ...prostho, ...patch })}
            />
          ) : isImplant ? (
            <ImplantClinicalPart
              details={implant}
              numberingSystem={records.toothNumberingSystem || TOOTH_NUMBERING_SYSTEMS.FDI}
              errors={fieldErrors}
              onChange={(patch) => update('implantDetails', { ...implant, ...patch })}
            />
          ) : (
            <ClinicalPreferencesPart
              clinical={clinical}
              numberingSystem={records.toothNumberingSystem || TOOTH_NUMBERING_SYSTEMS.FDI}
              instructions={form.instructions}
              onClinicalChange={updateClinical}
              onInstructionsChange={(value) => update('instructions', value)}
            />
          )
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
            showOcclusion={isAligner}
            requireApproach={isAligner}
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
            {fieldErrors.files ? <p className="text-sm text-red-600">{fieldErrors.files}</p> : null}
            <TextField
              label="Initial note"
              name="note"
              value={form.initialNote || ''}
              onChange={(e) => update('initialNote', e.target.value)}
            />
            <label className="flex items-start gap-2 rounded-lg border border-line px-3 py-3 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(form.isDemo)}
                onChange={(e) => update('isDemo', e.target.checked)}
              />
              <span>
                <span className="font-semibold">Demo Case</span>
                <span className="mt-0.5 block text-xs text-muted">
                  We will contact you within 8 working hours. A demo plan is ready within 2 working
                  days after successful submission.
                </span>
              </span>
            </label>
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Submit starts the 15-minute cancel window and SLA clock. Save as draft keeps what you
              have filled so far with no validation. Payable cases without prepaid/invoice billing
              require payment first.
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
            <button
              type="button"
              disabled={loading}
              onClick={() => void submit(true)}
              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Save as draft
            </button>
            {step.id === 'files' ? (
              <AuthButton type="button" loading={loading} onClick={() => void submit(false)}>
                Submit case
              </AuthButton>
            ) : (
              <AuthButton type="button" loading={loading} onClick={goNext}>
                Continue
              </AuthButton>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
