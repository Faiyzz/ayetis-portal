import {
  ALL_CASE_PRIORITIES,
  ALL_CASE_STATUSES,
  CASE_CATEGORIES,
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  EMPTY_CASE_COMMERCIAL,
  EMPTY_CLINICAL_PREFERENCES,
  EMPTY_IMPLANT_DETAILS,
  EMPTY_OCCLUSION_GOALS,
  EMPTY_PROSTHO_DETAILS,
  EMPTY_RECORDS_NUMBERING,
  EMPTY_TREATMENT_INSTRUCTIONS,
  PERMISSIONS,
  TOOTH_NUMBERING_SYSTEMS,
  firstFieldError,
  isCaseDeliveryLocked,
  validateDigitalAlignerPart1,
  validateDigitalAlignerPart3,
  validateImplantSubmit,
  validatePatientCore,
  validateProsthodonticSubmit,
  type CaseCategory,
  type CaseCommercial,
  type CasePriority,
  type CaseStatus,
  type ClinicalPreferences,
  type FieldErrors,
  type ImplantDetails,
  type OcclusionGoals,
  type ProsthoDetails,
  type RecordsNumbering,
  type TreatmentInstructions,
  type TreatmentPlanDto,
  type UpdateCaseInput,
} from '@ayetis/shared';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import { fetchCase, updateCase } from '@/features/cases/api';
import {
  ClinicalPreferencesPart,
  ImplantClinicalPart,
  OcclusionCommercialPart,
  ProsthodonticClinicalPart,
  RecordsNumberingPart,
} from '@/features/cases/components/treatment-form';
import { fetchTreatmentPlans, validateDiscountCode } from '@/features/commercial/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

export function EditCasePage() {
  const { caseId = '' } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canSetPriority = can(PERMISSIONS.CASE_SET_PRIORITY);
  const [form, setForm] = useState<UpdateCaseInput | null>(null);
  const [caseCategory, setCaseCategory] = useState<CaseCategory>(CASE_CATEGORIES.DIGITAL_ALIGNER);
  const [treatmentInstructions, setTreatmentInstructions] = useState<TreatmentInstructions>({
    ...EMPTY_TREATMENT_INSTRUCTIONS,
  });
  const [records, setRecords] = useState<RecordsNumbering>({ ...EMPTY_RECORDS_NUMBERING });
  const [clinical, setClinical] = useState<ClinicalPreferences>({
    ...EMPTY_CLINICAL_PREFERENCES,
  });
  const [occlusion, setOcclusion] = useState<OcclusionGoals>({ ...EMPTY_OCCLUSION_GOALS });
  const [prostho, setProstho] = useState<ProsthoDetails>({ ...EMPTY_PROSTHO_DETAILS });
  const [implant, setImplant] = useState<ImplantDetails>({ ...EMPTY_IMPLANT_DETAILS });
  const [commercial, setCommercial] = useState<CaseCommercial>({ ...EMPTY_CASE_COMMERCIAL });
  const [plans, setPlans] = useState<TreatmentPlanDto[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);

  const isAligner = caseCategory === CASE_CATEGORIES.DIGITAL_ALIGNER;
  const isProstho = caseCategory === CASE_CATEGORIES.PROSTHODONTIC;
  const isImplant = caseCategory === CASE_CATEGORIES.IMPLANT;

  const filteredPlans = useMemo(
    () => plans.filter((plan) => !plan.caseCategory || plan.caseCategory === caseCategory),
    [plans, caseCategory],
  );

  useEffect(() => {
    void fetchTreatmentPlans(true)
      .then(setPlans)
      .catch(() => setPlans([]));
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchCase(caseId);
        if (data.isDeleted || isCaseDeliveryLocked(data.status)) {
          setLocked(true);
          setError(
            data.isDeleted
              ? 'This case is deleted and cannot be edited.'
              : 'This case has been delivered and can no longer be edited.',
          );
          setForm(null);
          return;
        }
        setLocked(false);
        const category = (data.caseCategory || CASE_CATEGORIES.DIGITAL_ALIGNER) as CaseCategory;
        setCaseCategory(category);
        setForm({
          patientName: data.patientName,
          patientAge: data.patientAge,
          patientGender: data.patientGender,
          patientDateOfBirth: data.patientDateOfBirth,
          clinicName: data.clinicName,
          practiceName: data.practiceName || data.clinicName,
          country: data.country,
          chiefComplaint: data.chiefComplaint,
          caseCategory: category,
          caseType: data.caseType ?? undefined,
          treatmentSummary: data.treatmentSummary,
          instructions: data.instructions,
          priority: data.priority,
          status: data.status,
        });
        setTreatmentInstructions({
          ...EMPTY_TREATMENT_INSTRUCTIONS,
          ...data.treatmentInstructions,
        });
        setRecords({ ...EMPTY_RECORDS_NUMBERING, ...(data.recordsNumbering ?? {}) });
        setClinical({ ...EMPTY_CLINICAL_PREFERENCES, ...(data.clinicalPreferences ?? {}) });
        setOcclusion({ ...EMPTY_OCCLUSION_GOALS, ...(data.occlusionGoals ?? {}) });
        setProstho({ ...EMPTY_PROSTHO_DETAILS, ...(data.prosthoDetails ?? {}) });
        setImplant({ ...EMPTY_IMPLANT_DETAILS, ...(data.implantDetails ?? {}) });
        setCommercial({ ...EMPTY_CASE_COMMERCIAL, ...(data.commercial ?? {}) });
      } catch (err) {
        const message = getErrorMessage(err, 'Unable to load case');
        setError(message);
        toast().error(message);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [caseId]);

  function patientCore() {
    return {
      patientName: form?.patientName,
      practiceName: form?.practiceName,
      clinicName: form?.clinicName,
      chiefComplaint: form?.chiefComplaint,
      patientDateOfBirth: form?.patientDateOfBirth,
      caseCategory: form?.caseCategory ?? caseCategory,
      caseType: form?.caseType,
      recordsNumbering: records,
    };
  }

  function validateForm(): FieldErrors {
    if (isAligner) {
      return {
        ...validateDigitalAlignerPart1(patientCore()),
        ...validateDigitalAlignerPart3({ commercial }),
      };
    }
    if (isProstho) {
      return validateProsthodonticSubmit({
        patient: patientCore(),
        prosthoDetails: prostho,
        commercial,
      });
    }
    if (isImplant) {
      return validateImplantSubmit({
        patient: patientCore(),
        implantDetails: implant,
        commercial,
      });
    }
    const errors = validatePatientCore(patientCore());
    if (!commercial.treatmentPlanId) {
      errors['commercial.treatmentPlanId'] = 'Select a treatment plan';
    }
    return errors;
  }

  async function applyDiscount() {
    if (!commercial.discountCode.trim()) return;
    try {
      const result = await validateDiscountCode(commercial.discountCode.trim());
      const unit = commercial.unitPrice ?? 0;
      let discountAmount = 0;
      if (result.percentOff) discountAmount = (unit * result.percentOff) / 100;
      else if (result.amountOff) discountAmount = result.amountOff;
      setCommercial((prev) => ({
        ...prev,
        discountAmount,
        finalPayableAmount: Math.max(0, unit - discountAmount),
      }));
      toast().success('Discount applied');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Invalid discount code'));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form || locked) return;

    const errors = validateForm();
    setFieldErrors(errors);
    const message = firstFieldError(errors);
    if (message) {
      setError(message);
      toast().warning(message);
      return;
    }

    setSaving(true);
    setError('');
    setFieldErrors({});
    try {
      const payload: UpdateCaseInput = {
        ...form,
        practiceName: form.practiceName || form.clinicName,
        treatmentInstructions: { ...treatmentInstructions },
        recordsNumbering: records,
        clinicalPreferences: clinical,
        occlusionGoals: occlusion,
        prosthoDetails: prostho,
        implantDetails: implant,
        commercial,
      };
      if (!canSetPriority) {
        delete payload.priority;
      }
      const updated = await updateCase(caseId, payload);
      toast().success(`Case ${updated.caseId} updated`);
      navigate(`/app/cases/${updated.caseId}`, { replace: true });
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to update case');
      setError(message);
      toast().error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading case…</p>;
  }

  if (locked || !form) {
    return (
      <div className="w-full max-w-5xl space-y-5">
        <PageHeader
          eyebrow={
            <Link to={`/app/cases/${caseId}`} className="hover:text-brand-700">
              ← Case detail
            </Link>
          }
          title="Edit case"
          subtitle={`Case ${caseId}`}
        />
        <Alert>{error || 'This case cannot be edited.'}</Alert>
      </div>
    );
  }

  const subtitle = isAligner
    ? `Digital Treatment Planning form for ${caseId}`
    : isProstho
      ? `Prosthodontic planning for ${caseId}`
      : isImplant
        ? `Implant planning for ${caseId}`
        : `Update case information for ${caseId}.`;

  return (
    <div className="w-full max-w-5xl space-y-5">
      <PageHeader
        eyebrow={
          <Link to={`/app/cases/${caseId}`} className="hover:text-brand-700">
            ← Case detail
          </Link>
        }
        title="Edit case"
        subtitle={subtitle}
      />

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-line bg-white p-5 sm:p-6"
      >
        {error ? <Alert>{error}</Alert> : null}

        <RecordsNumberingPart
          form={{
            patientName: form.patientName ?? '',
            patientAge: form.patientAge ?? null,
            patientGender: form.patientGender ?? '',
            patientDateOfBirth: form.patientDateOfBirth ?? null,
            practiceName: form.practiceName ?? '',
            clinicName: form.clinicName ?? '',
            country: form.country ?? '',
            chiefComplaint: form.chiefComplaint ?? '',
            caseCategory: (form.caseCategory as CaseCategory) || caseCategory,
            caseType: form.caseType as UpdateCaseInput['caseType'],
            doctorId: undefined,
            treatmentSummary: form.treatmentSummary ?? '',
          }}
          records={records}
          errors={fieldErrors}
          doctors={[]}
          needsDoctorPicker={false}
          onFormChange={(key, value) => setForm((prev) => ({ ...prev!, [key]: value }))}
          onRecordsChange={(patch) => setRecords((prev) => ({ ...prev, ...patch }))}
          showAlignerParams={isAligner}
        />

        <div className="rounded-xl border border-line p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Part 2 — Clinical details
          </h3>
          {isProstho ? (
            <ProsthodonticClinicalPart
              details={prostho}
              numberingSystem={records.toothNumberingSystem || TOOTH_NUMBERING_SYSTEMS.FDI}
              errors={fieldErrors}
              onChange={(patch) => setProstho((prev) => ({ ...prev, ...patch }))}
            />
          ) : isImplant ? (
            <ImplantClinicalPart
              details={implant}
              numberingSystem={records.toothNumberingSystem || TOOTH_NUMBERING_SYSTEMS.FDI}
              errors={fieldErrors}
              onChange={(patch) => setImplant((prev) => ({ ...prev, ...patch }))}
            />
          ) : (
            <ClinicalPreferencesPart
              clinical={clinical}
              numberingSystem={records.toothNumberingSystem || TOOTH_NUMBERING_SYSTEMS.FDI}
              instructions={form.instructions}
              onClinicalChange={(patch) => setClinical((prev) => ({ ...prev, ...patch }))}
              onInstructionsChange={(value) =>
                setForm((prev) => ({ ...prev!, instructions: value }))
              }
            />
          )}
        </div>

        <OcclusionCommercialPart
          occlusion={occlusion}
          commercial={commercial}
          plans={filteredPlans}
          errors={fieldErrors}
          onOcclusionChange={(patch) => setOcclusion((prev) => ({ ...prev, ...patch }))}
          onCommercialChange={(patch) => setCommercial((prev) => ({ ...prev, ...patch }))}
          onApplyDiscount={() => void applyDiscount()}
          showOcclusion={isAligner}
          requireApproach={isAligner}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {canSetPriority ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Priority</span>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev!, priority: e.target.value as CasePriority }))
                }
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
              >
                {ALL_CASE_PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {CASE_PRIORITY_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Status</span>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({ ...prev!, status: e.target.value as CaseStatus }))
              }
              className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
            >
              {ALL_CASE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {CASE_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="max-w-xs">
          <AuthButton loading={saving}>Save changes</AuthButton>
        </div>
      </form>
    </div>
  );
}
