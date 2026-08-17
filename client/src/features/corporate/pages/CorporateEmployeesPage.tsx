import {
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUSES,
  ROLE_LABELS,
  type FacilityDto,
  type PublicUser,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { AdminOrgPicker, SelectOrganizationEmpty } from '@/features/corporate/AdminOrgPicker';
import * as corporateApi from '@/features/corporate/api';
import { useCorporateOrgId, useIsMainAdmin } from '@/features/corporate/orgContext';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

export function CorporateEmployeesPage() {
  const isMainAdmin = useIsMainAdmin();
  const orgId = useCorporateOrgId();
  const [employees, setEmployees] = useState<PublicUser[]>([]);
  const [facilities, setFacilities] = useState<FacilityDto[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    country: '',
    facilityId: '',
    role: 'doctor' as 'doctor' | 'facility_admin',
  });

  async function load() {
    if (isMainAdmin && !orgId) {
      setEmployees([]);
      setFacilities([]);
      return;
    }
    try {
      const [emps, facs] = await Promise.all([
        corporateApi.fetchEmployees(orgId),
        corporateApi.fetchFacilities(orgId),
      ]);
      setEmployees(emps);
      setFacilities(facs);
      if (!form.facilityId && facs[0]) {
        setForm((f) => ({ ...f, facilityId: facs[0]!.id }));
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load employees'));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await corporateApi.createEmployee(
        {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          mobile: form.mobile || undefined,
          country: form.country || undefined,
          facilityId: form.facilityId,
          role: form.role,
        },
        orgId,
      );
      toast().success(
        'Employee created. Temporary password emailed.',
        result.temporaryPassword,
      );
      setForm((f) => ({
        ...f,
        firstName: '',
        lastName: '',
        email: '',
        mobile: '',
        country: '',
      }));
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create employee'));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(user: PublicUser, accountStatus: 'active' | 'suspended') {
    try {
      await corporateApi.setEmployeeStatus(user.id, accountStatus);
      toast().success(`${user.email} → ${ACCOUNT_STATUS_LABELS[accountStatus]}`);
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to update employee'));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isMainAdmin ? 'Admin' : 'Corporate'}
        title="Employees"
        subtitle="Create facility employees with auto Employee IDs and temporary passwords."
      />
      {isMainAdmin ? <AdminOrgPicker /> : null}
      {error ? <Alert>{error}</Alert> : null}
      {isMainAdmin && !orgId ? <SelectOrganizationEmpty /> : null}

      <form
        onSubmit={onCreate}
        className="grid max-w-3xl gap-4 rounded-xl border border-line bg-white p-5 sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-base font-semibold text-ink">Add employee</h2>
        <TextField
          label="First name"
          name="firstName"
          required
          value={form.firstName}
          onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
        />
        <TextField
          label="Last name"
          name="lastName"
          required
          value={form.lastName}
          onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <TextField
          label="Mobile"
          name="mobile"
          value={form.mobile}
          onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
        />
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ink">Facility</span>
          <select
            required
            className="w-full rounded-lg border border-line bg-white px-3 py-2"
            value={form.facilityId}
            onChange={(e) => setForm((f) => ({ ...f, facilityId: e.target.value }))}
          >
            <option value="">Select facility</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ink">Role</span>
          <select
            className="w-full rounded-lg border border-line bg-white px-3 py-2"
            value={form.role}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                role: e.target.value as 'doctor' | 'facility_admin',
              }))
            }
          >
            <option value="doctor">Doctor</option>
            <option value="facility_admin">Facility Admin</option>
          </select>
        </label>
        <TextField
          label="Country"
          name="country"
          value={form.country}
          onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
        />
        <div className="sm:col-span-2">
          <AuthButton type="submit" disabled={saving || facilities.length === 0 || (isMainAdmin && !orgId)}>
            {saving ? 'Creating…' : 'Create employee'}
          </AuthButton>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">ID / Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">
                    {u.firstName} {u.lastName}
                  </p>
                  <p className="text-xs text-muted">{u.email}</p>
                </td>
                <td className="px-4 py-3 text-muted">
                  {u.employeeId || '—'} · {ROLE_LABELS[u.role]}
                </td>
                <td className="px-4 py-3">{ACCOUNT_STATUS_LABELS[u.accountStatus]}</td>
                <td className="px-4 py-3">
                  {u.accountStatus === ACCOUNT_STATUSES.ACTIVE ? (
                    <button
                      type="button"
                      className="text-sm font-semibold text-muted hover:text-ink"
                      onClick={() => void setStatus(u, ACCOUNT_STATUSES.SUSPENDED)}
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-sm font-semibold text-brand-600"
                      onClick={() => void setStatus(u, ACCOUNT_STATUSES.ACTIVE)}
                    >
                      Activate
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {employees.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-muted">
                  No employees yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
