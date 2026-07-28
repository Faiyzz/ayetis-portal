import {
  ALL_FILE_CATEGORIES,
  CASE_PRIORITIES,
  COUNTRIES,
  EMPTY_TREATMENT_INSTRUCTIONS,
  FILE_CATEGORIES,
  FILE_CATEGORY_LABELS,
  GENDER_OPTIONS,
  ROLES,
  type CreateCaseInput,
  type DoctorAssigneeDto,
  type FileCategory,
  type TreatmentInstructions,
} from '@ayetis/shared';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { SearchableSelect } from '@/components/SearchableSelect';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { useAuthStore } from '@/features/auth/store';
import { createCase, fetchDoctorAssignees, uploadCaseFiles } from '@/features/cases/api';
import { TreatmentInstructionsFields } from '@/features/cases/components/TreatmentInstructionsPanel';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

const STEPS = [
  { id: 'patient', title: 'Patient', hint: 'Who is this case for?' },
  { id: 'treatment', title: 'Treatment', hint: 'Summary and structured instructions' },
  { id: 'files', title: 'Files', hint: 'Attach STL, scans, photos, or x-rays' },
  { id: 'review', title: 'Review', hint: 'Confirm and submit' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

const INITIAL: CreateCaseInput = {
  patientName: '',
  patientAge: null,
  patientGender: '',
  clinicName: '',
  country: '',
  treatmentSummary: '',
  instructions: '',
  treatmentInstructions: { ...EMPTY_TREATMENT_INSTRUCTIONS },
  priority: CASE_PRIORITIES.NORMAL,
  initialNote: '',
  doctorId: '',
};

const COUNTRY_OPTIONS = COUNTRIES.map((name) => ({ value: name, label: name }));

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tiSummary(ti: Partial<TreatmentInstructions> | undefined) {
  if (!ti) return [];
  return [
    ['Arches', ti.arches || '—'],
    ['Appliance', ti.applianceType || '—'],
    ['Goal', ti.treatmentGoal || '—'],
    ['Bite', ti.biteDetails || '—'],
    ['Retainers', ti.retainers || '—'],
    ['Special', ti.specialRequirements || '—'],
  ] as const;
}

export function CreateCasePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isDoctor = user?.role === ROLES.DOCTOR;
  const needsDoctorPicker = Boolean(user && !isDoctor);

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<CreateCaseInput>(() => ({
    ...INITIAL,
    doctorId: isDoctor ? user?.id : '',
  }));
  const [doctors, setDoctors] = useState<DoctorAssigneeDto[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileCategory, setFileCategory] = useState<FileCategory | ''>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const step = STEPS[stepIndex]!;
  const progress = useMemo(
    () => ((stepIndex + 1) / STEPS.length) * 100,
    [stepIndex],
  );

  const treatmentInstructions: TreatmentInstructions = {
    ...EMPTY_TREATMENT_INSTRUCTIONS,
    ...(form.treatmentInstructions ?? {}),
  };

  useEffect(() => {
    if (!needsDoctorPicker) return;
    void fetchDoctorAssignees()
      .then(setDoctors)
      .catch(() => {
        setDoctors([]);
        toast().error('Unable to load doctor list');
      });
  }, [needsDoctorPicker]);

  function update<K extends keyof CreateCaseInput>(key: K, value: CreateCaseInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateStep(id: StepId): string | null {
    if (id === 'patient') {
      if (!form.patientName.trim()) return 'Patient name is required';
      if (needsDoctorPicker && !form.doctorId) return 'Select the treating doctor';
      return null;
    }
    if (id === 'treatment') {
      if (!form.treatmentSummary.trim()) return 'Treatment summary is required';
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const patientError = validateStep('patient');
    const treatmentError = validateStep('treatment');
    if (patientError || treatmentError) {
      const message = patientError || treatmentError || 'Please complete required fields';
      setError(message);
      toast().warning(message);
      return;
    }

    setError('');
    setLoading(true);
    try {
      const created = await createCase({
        ...form,
        doctorId: needsDoctorPicker ? form.doctorId : undefined,
        priority: CASE_PRIORITIES.NORMAL,
        treatmentInstructions: { ...treatmentInstructions },
        patientAge:
          form.patientAge === null || form.patientAge === undefined || Number.isNaN(form.patientAge)
            ? null
            : Number(form.patientAge),
      });

      if (pendingFiles.length > 0) {
        try {
          await uploadCaseFiles(created.caseId, pendingFiles, {
            category: fileCategory || FILE_CATEGORIES.OTHER,
          });
        } catch (uploadErr) {
          toast().warning(
            getErrorMessage(uploadErr, 'Case created, but some files failed to upload'),
          );
        }
      }

      toast().success(`Case ${created.caseId} submitted`);
      navigate(`/app/cases/${created.caseId}`, { replace: true });
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to create case');
      setError(message);
      toast().error(message);
    } finally {
      setLoading(false);
    }
  }

  const selectedDoctor = doctors.find((d) => d.id === form.doctorId);

  return (
    <div className="w-full max-w-3xl space-y-5">
      <PageHeader
        eyebrow={
          <Link to="/app/cases" className="hover:text-brand-700">
            ← Cases
          </Link>
        }
        title="Submit a new case"
        subtitle="Guided form for sending a patient case to Ayetis for processing."
      />

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {STEPS.map((item, index) => {
            const active = index === stepIndex;
            const done = index < stepIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (index <= stepIndex) {
                    setError('');
                    setStepIndex(index);
                  }
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-brand-600 text-white'
                    : done
                      ? 'bg-brand-50 text-brand-700'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                {index + 1}. {item.title}
              </button>
            );
          })}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-muted">{step.hint}</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6"
      >
        {error ? <Alert>{error}</Alert> : null}

        {step.id === 'patient' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {needsDoctorPicker ? (
              <div className="sm:col-span-2">
                <SearchableSelect
                  label="Treating doctor"
                  required
                  value={form.doctorId ?? ''}
                  onChange={(next) => update('doctorId', next)}
                  placeholder="Search doctors…"
                  options={doctors.map((doctor) => ({
                    value: doctor.id,
                    label: `${doctor.firstName} ${doctor.lastName}`,
                    meta: doctor.email,
                  }))}
                />
                <p className="mt-1.5 text-xs text-muted">
                  Cases must belong to a doctor account — not the admin creating them.
                </p>
              </div>
            ) : null}
            <TextField
              label="Patient name"
              required
              value={form.patientName}
              onChange={(e) => update('patientName', e.target.value)}
            />
            <TextField
              label="Patient age"
              type="number"
              min={0}
              max={120}
              value={form.patientAge ?? ''}
              onChange={(e) =>
                update('patientAge', e.target.value === '' ? null : Number(e.target.value))
              }
            />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Gender</span>
              <select
                value={form.patientGender ?? ''}
                onChange={(e) => update('patientGender', e.target.value)}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              >
                <option value="">Select gender</option>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="Clinic"
              value={form.clinicName ?? ''}
              onChange={(e) => update('clinicName', e.target.value)}
            />
            <div className="sm:col-span-2">
              <SearchableSelect
                label="Country"
                value={form.country ?? ''}
                onChange={(next) => update('country', next)}
                options={COUNTRY_OPTIONS}
                placeholder="Search countries…"
                allowCustom
              />
            </div>
          </div>
        ) : null}

        {step.id === 'treatment' ? (
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Treatment summary</span>
              <textarea
                required
                rows={3}
                value={form.treatmentSummary}
                onChange={(e) => update('treatmentSummary', e.target.value)}
                placeholder="Brief description of the requested treatment…"
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              />
            </label>

            <div className="rounded-xl border border-line bg-surface/40 p-4">
              <p className="text-sm font-semibold text-ink">Treatment instructions form</p>
              <p className="mt-1 text-sm text-muted">
                Document arches, appliance, goals, and special requirements.
              </p>
              <div className="mt-4">
                <TreatmentInstructionsFields
                  value={treatmentInstructions}
                  onChange={(next) => update('treatmentInstructions', next)}
                />
              </div>
            </div>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Free-text instructions</span>
              <textarea
                rows={3}
                value={form.instructions ?? ''}
                onChange={(e) => update('instructions', e.target.value)}
                placeholder="Any extra free-text instructions for the Ayetis team…"
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Initial note (optional)</span>
              <textarea
                rows={3}
                value={form.initialNote ?? ''}
                onChange={(e) => update('initialNote', e.target.value)}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              />
            </label>
          </div>
        ) : null}

        {step.id === 'files' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Upload now or skip and add files later from the case page.
            </p>
            <input
              type="file"
              multiple
              accept=".stl,.dcm,.dicom,image/*,.pdf,.zip,.ply,.obj"
              onChange={(e) => setPendingFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700"
            />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">File category</span>
              <select
                value={fileCategory}
                onChange={(e) => setFileCategory(e.target.value as FileCategory | '')}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              >
                <option value="">Other / mixed</option>
                {ALL_FILE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {FILE_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>
            {pendingFiles.length > 0 ? (
              <ul className="space-y-1 text-sm text-muted">
                {pendingFiles.map((file) => (
                  <li key={`${file.name}-${file.size}`}>
                    {file.name} · {formatBytes(file.size)}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {step.id === 'review' ? (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-3 sm:grid-cols-2">
              {needsDoctorPicker ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">Doctor</dt>
                  <dd className="mt-1 text-ink">
                    {selectedDoctor
                      ? `${selectedDoctor.firstName} ${selectedDoctor.lastName} (${selectedDoctor.email})`
                      : '—'}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Patient</dt>
                <dd className="mt-1 text-ink">{form.patientName || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  Age / gender
                </dt>
                <dd className="mt-1 text-ink">
                  {form.patientAge ?? '—'} · {form.patientGender || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Clinic</dt>
                <dd className="mt-1 text-ink">{form.clinicName || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Country</dt>
                <dd className="mt-1 text-ink">{form.country || '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Summary</dt>
                <dd className="mt-1 whitespace-pre-wrap text-ink">
                  {form.treatmentSummary || '—'}
                </dd>
              </div>
            </dl>

            <div className="rounded-xl border border-line bg-surface/40 p-4">
              <p className="text-sm font-semibold text-ink">Clinical instructions</p>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                {tiSummary(treatmentInstructions).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {label}
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <p className="text-muted">
              {pendingFiles.length} file{pendingFiles.length === 1 ? '' : 's'} ready to upload after
              submit.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 pt-2">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand-300"
            >
              Back
            </button>
          ) : null}
          {stepIndex < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Continue
            </button>
          ) : (
            <div className="max-w-xs">
              <AuthButton loading={loading}>Submit case</AuthButton>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
