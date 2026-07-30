import {
  ALL_COMPLAINT_TYPES,
  COMPLAINT_TYPE_LABELS,
  ROLE_LABELS,
  ROLES,
  type ComplaintStaffOptionDto,
  type CreateComplaintInput,
} from '@ayetis/shared';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AuthButton, TextField } from '@/features/auth/components/AuthUI';
import * as complaintsApi from '@/features/complaints/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

function staffLabel(user: ComplaintStaffOptionDto) {
  const role = ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role;
  return `${user.firstName} ${user.lastName} (${role})`;
}

function StaffSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ComplaintStaffOptionDto[];
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-ink">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-line px-3 py-2.5"
      >
        <option value="">— None —</option>
        {options.map((user) => (
          <option key={user.id} value={user.id}>
            {staffLabel(user)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function LogComplaintForm({
  onCreated,
  inDialog = false,
}: {
  onCreated?: () => void;
  inDialog?: boolean;
}) {
  const [staff, setStaff] = useState<ComplaintStaffOptionDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    details: '',
    caseId: '',
    type: 'quality',
    rating: '',
    responsibleEmployeeId: '',
    responsibleQcId: '',
    responsibleConsultantId: '',
    responsibleSupervisorId: '',
    additionalComments: '',
  });

  useEffect(() => {
    void complaintsApi
      .listComplaintStaff()
      .then(setStaff)
      .catch((err) => toast().error(getErrorMessage(err, 'Unable to load staff list')));
  }, []);

  const byRole = useMemo(() => {
    const designers = staff.filter((u) => u.role === ROLES.DESIGNER || u.role === ROLES.COORDINATOR);
    const qc = staff.filter((u) => u.role === ROLES.QC);
    const consultants = staff.filter((u) => u.role === ROLES.ORTHODONTIST);
    const supervisors = staff.filter((u) => u.role === ROLES.SUPERVISOR);
    return { designers, qc, consultants, supervisors };
  }, [staff]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload: CreateComplaintInput = {
        details: form.details,
        caseId: form.caseId.trim() || undefined,
        type: form.type as CreateComplaintInput['type'],
        rating: form.rating ? Number(form.rating) : null,
        responsibleEmployeeId: form.responsibleEmployeeId || null,
        responsibleQcId: form.responsibleQcId || null,
        responsibleConsultantId: form.responsibleConsultantId || null,
        responsibleSupervisorId: form.responsibleSupervisorId || null,
        additionalComments: form.additionalComments.trim() || undefined,
      };
      const created = await complaintsApi.createComplaint(payload);
      toast().success(`Complaint ${created.complaintCode} logged`);
      setForm({
        details: '',
        caseId: '',
        type: 'quality',
        rating: '',
        responsibleEmployeeId: '',
        responsibleQcId: '',
        responsibleConsultantId: '',
        responsibleSupervisorId: '',
        additionalComments: '',
      });
      onCreated?.();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to file complaint'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        inDialog ? 'space-y-3' : 'space-y-3 rounded-xl border border-line bg-white p-5'
      }
    >
      {!inDialog ? (
        <div>
          <h2 className="text-sm font-semibold text-ink">Log a complaint</h2>
          <p className="mt-1 text-sm text-muted">
            Code is assigned automatically. Link a Case ID when possible so doctor and assignees can
            be inferred.
          </p>
        </div>
      ) : null}
      <TextField
        label="Case ID"
        value={form.caseId}
        onChange={(e) => setForm((s) => ({ ...s, caseId: e.target.value }))}
        placeholder="e.g. AYE-2026-0001"
      />
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium text-ink">Type</span>
        <select
          value={form.type}
          onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}
          className="w-full rounded-xl border border-line px-3 py-2.5"
        >
          {ALL_COMPLAINT_TYPES.map((type) => (
            <option key={type} value={type}>
              {COMPLAINT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>
      <TextField
        label="Rating 1–5 (optional)"
        value={form.rating}
        onChange={(e) => setForm((s) => ({ ...s, rating: e.target.value }))}
        placeholder="Only if an explicit rating was given"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <StaffSelect
          label="Responsible employee / designer"
          value={form.responsibleEmployeeId}
          onChange={(value) => setForm((s) => ({ ...s, responsibleEmployeeId: value }))}
          options={byRole.designers}
        />
        <StaffSelect
          label="Responsible QC"
          value={form.responsibleQcId}
          onChange={(value) => setForm((s) => ({ ...s, responsibleQcId: value }))}
          options={byRole.qc}
        />
        <StaffSelect
          label="Responsible consultant"
          value={form.responsibleConsultantId}
          onChange={(value) => setForm((s) => ({ ...s, responsibleConsultantId: value }))}
          options={byRole.consultants}
        />
        <StaffSelect
          label="Responsible supervisor"
          value={form.responsibleSupervisorId}
          onChange={(value) => setForm((s) => ({ ...s, responsibleSupervisorId: value }))}
          options={byRole.supervisors}
        />
      </div>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium text-ink">Details</span>
        <textarea
          required
          rows={3}
          value={form.details}
          onChange={(e) => setForm((s) => ({ ...s, details: e.target.value }))}
          className="w-full rounded-xl border border-line px-3 py-2.5"
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium text-ink">Additional notes (optional)</span>
        <textarea
          rows={2}
          value={form.additionalComments}
          onChange={(e) => setForm((s) => ({ ...s, additionalComments: e.target.value }))}
          className="w-full rounded-xl border border-line px-3 py-2.5"
        />
      </label>
      <AuthButton loading={busy}>Submit complaint</AuthButton>
    </form>
  );
}
