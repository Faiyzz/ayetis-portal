import {
  ALL_CASE_PRIORITIES,
  ALL_CASE_STATUSES,
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  COUNTRIES,
  EMPTY_TREATMENT_INSTRUCTIONS,
  GENDER_OPTIONS,
  PERMISSIONS,
  isCaseDeliveryLocked,
  type CasePriority,
  type CaseStatus,
  type TreatmentInstructions,
  type UpdateCaseInput,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { SearchableSelect } from '@/components/SearchableSelect';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import { fetchCase, updateCase } from '@/features/cases/api';
import { TreatmentInstructionsFields } from '@/features/cases/components/TreatmentInstructionsPanel';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

const COUNTRY_OPTIONS = COUNTRIES.map((name) => ({ value: name, label: name }));

export function EditCasePage() {
  const { caseId = '' } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canSetPriority = can(PERMISSIONS.CASE_SET_PRIORITY);
  const [form, setForm] = useState<UpdateCaseInput | null>(null);
  const [treatmentInstructions, setTreatmentInstructions] = useState<TreatmentInstructions>({
    ...EMPTY_TREATMENT_INSTRUCTIONS,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);

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
        setForm({
          patientName: data.patientName,
          patientAge: data.patientAge,
          patientGender: data.patientGender,
          clinicName: data.clinicName,
          country: data.country,
          treatmentSummary: data.treatmentSummary,
          instructions: data.instructions,
          priority: data.priority,
          status: data.status,
        });
        setTreatmentInstructions({
          ...EMPTY_TREATMENT_INSTRUCTIONS,
          ...data.treatmentInstructions,
        });
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form || locked) return;
    setSaving(true);
    setError('');
    try {
      const payload: UpdateCaseInput = {
        ...form,
        treatmentInstructions: { ...treatmentInstructions },
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
      <div className="w-full max-w-3xl space-y-5">
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

  return (
    <div className="w-full max-w-3xl space-y-5">
      <PageHeader
        eyebrow={
          <Link to={`/app/cases/${caseId}`} className="hover:text-brand-700">
            ← Case detail
          </Link>
        }
        title="Edit case"
        subtitle={`Update case information for ${caseId}.`}
      />

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6"
      >
        {error ? <Alert>{error}</Alert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Patient name"
            required
            value={form.patientName ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev!, patientName: e.target.value }))}
          />
          <TextField
            label="Patient age"
            type="number"
            value={form.patientAge ?? ''}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev!,
                patientAge: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
          />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Gender</span>
            <select
              value={form.patientGender ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev!, patientGender: e.target.value }))}
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
            onChange={(e) => setForm((prev) => ({ ...prev!, clinicName: e.target.value }))}
          />
          <div className="sm:col-span-2">
            <SearchableSelect
              label="Country"
              value={form.country ?? ''}
              onChange={(next) => setForm((prev) => ({ ...prev!, country: next }))}
              options={COUNTRY_OPTIONS}
              placeholder="Search countries…"
              allowCustom
            />
          </div>
          {canSetPriority ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Priority</span>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev!, priority: e.target.value as CasePriority }))
                }
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              >
                {ALL_CASE_PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {CASE_PRIORITY_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-ink">Status</span>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({ ...prev!, status: e.target.value as CaseStatus }))
              }
              className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            >
              {ALL_CASE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {CASE_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Treatment summary</span>
          <textarea
            required
            rows={3}
            value={form.treatmentSummary ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev!, treatmentSummary: e.target.value }))}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          />
        </label>

        <div className="rounded-xl border border-line bg-surface/40 p-4">
          <p className="text-sm font-semibold text-ink">Clinical / treatment instructions</p>
          <p className="mt-1 text-sm text-muted">
            These structured fields are saved with the case.
          </p>
          <div className="mt-4">
            <TreatmentInstructionsFields
              value={treatmentInstructions}
              onChange={setTreatmentInstructions}
            />
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Free-text instructions</span>
          <textarea
            rows={4}
            value={form.instructions ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev!, instructions: e.target.value }))}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          />
        </label>

        <div className="max-w-xs">
          <AuthButton loading={saving}>Save changes</AuthButton>
        </div>
      </form>
    </div>
  );
}
