import {
  ALL_CASE_PRIORITIES,
  CASE_PRIORITIES,
  CASE_PRIORITY_LABELS,
  type CasePriority,
  type CreateCaseInput,
} from '@ayetis/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { createCase } from '@/features/cases/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

const INITIAL: CreateCaseInput = {
  patientName: '',
  patientAge: null,
  patientGender: '',
  clinicName: '',
  country: '',
  treatmentSummary: '',
  instructions: '',
  priority: CASE_PRIORITIES.NORMAL,
  initialNote: '',
};

export function CreateCasePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<CreateCaseInput>(INITIAL);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update<K extends keyof CreateCaseInput>(key: K, value: CreateCaseInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const created = await createCase({
        ...form,
        patientAge:
          form.patientAge === null || form.patientAge === undefined || Number.isNaN(form.patientAge)
            ? null
            : Number(form.patientAge),
      });
      toast().success(`Case ${created.caseId} created`);
      navigate(`/app/cases/${created.caseId}`, { replace: true });
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to create case');
      setError(message);
      toast().error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-3xl space-y-5">
      <div>
        <Link to="/app/cases" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          ← Cases
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">Create case</h1>
        <p className="mt-1.5 text-[15px] text-muted">
          Submit a patient treatment request. A unique Case ID is generated automatically.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6"
      >
        {error ? <Alert>{error}</Alert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
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
          <TextField
            label="Gender"
            value={form.patientGender ?? ''}
            onChange={(e) => update('patientGender', e.target.value)}
          />
          <TextField
            label="Clinic"
            value={form.clinicName ?? ''}
            onChange={(e) => update('clinicName', e.target.value)}
          />
          <TextField
            label="Country"
            value={form.country ?? ''}
            onChange={(e) => update('country', e.target.value)}
          />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Priority</span>
            <select
              value={form.priority ?? CASE_PRIORITIES.NORMAL}
              onChange={(e) => update('priority', e.target.value as CasePriority)}
              className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            >
              {ALL_CASE_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {CASE_PRIORITY_LABELS[value]}
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
            value={form.treatmentSummary}
            onChange={(e) => update('treatmentSummary', e.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Instructions</span>
          <textarea
            rows={4}
            value={form.instructions ?? ''}
            onChange={(e) => update('instructions', e.target.value)}
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

        <div className="max-w-xs">
          <AuthButton loading={loading}>Submit case</AuthButton>
        </div>
      </form>
    </div>
  );
}
