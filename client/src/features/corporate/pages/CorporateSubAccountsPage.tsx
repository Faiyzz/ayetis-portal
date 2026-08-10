import {
  ACCOUNT_STATUS_LABELS,
  ROLES,
  type FacilityDto,
  type OrganizationDto,
  type PublicUser,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { useAuthStore } from '@/features/auth/store';
import * as corporateApi from '@/features/corporate/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

export function CorporateSubAccountsPage() {
  const user = useAuthStore((s) => s.user);
  const isMainAdmin = user?.role === ROLES.ADMIN;
  const [items, setItems] = useState<PublicUser[]>([]);
  const [facilities, setFacilities] = useState<FacilityDto[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationDto[]>([]);
  const [orgId, setOrgId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    country: '',
    mobile: '',
    practiceName: '',
    remarks: '',
    facilityId: '',
  });

  async function load(selectedOrg?: string) {
    try {
      if (isMainAdmin) {
        const orgs = await corporateApi.fetchOrganizations();
        setOrganizations(orgs);
        const useOrg = selectedOrg || orgId || orgs[0]?.id || '';
        if (!orgId && useOrg) setOrgId(useOrg);
        if (!useOrg) {
          setItems([]);
          setFacilities([]);
          return;
        }
        const [subs, facs] = await Promise.all([
          corporateApi.fetchSubAccounts(useOrg),
          corporateApi.fetchFacilities(useOrg),
        ]);
        setItems(subs);
        setFacilities(facs);
      } else {
        const [subs, facs] = await Promise.all([
          corporateApi.fetchSubAccounts(),
          corporateApi.fetchFacilities(),
        ]);
        setItems(subs);
        setFacilities(facs);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load sub-accounts'));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await corporateApi.createSubAccount({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        country: form.country,
        mobile: form.mobile || undefined,
        practiceName: form.practiceName || undefined,
        remarks: form.remarks || undefined,
        facilityId: form.facilityId || undefined,
        organizationId: isMainAdmin ? orgId : undefined,
      });
      toast().success(
        'Sub-account created. Verification email sent.',
        result.verifyUrl,
      );
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        country: '',
        mobile: '',
        practiceName: '',
        remarks: '',
        facilityId: '',
      });
      await load(orgId);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create sub-account'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isMainAdmin ? 'Admin' : 'Corporate'}
        title="Sub-accounts"
        subtitle="Create doctor sub-accounts with IDs like 001_C134789. Email verification issues a temporary password."
      />
      {error ? <Alert>{error}</Alert> : null}

      {isMainAdmin ? (
        <label className="block max-w-md text-sm">
          <span className="mb-1.5 block font-medium text-ink">Organization</span>
          <select
            className="w-full rounded-lg border border-line bg-white px-3 py-2"
            value={orgId}
            onChange={(e) => {
              const next = e.target.value;
              setOrgId(next);
              void load(next);
            }}
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.companyName} ({o.corporateCustomerId})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <form
        onSubmit={onCreate}
        className="grid max-w-3xl gap-4 rounded-xl border border-line bg-white p-5 sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-base font-semibold text-ink">Create sub-account</h2>
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
          label="Country"
          name="country"
          required
          value={form.country}
          onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
        />
        <TextField
          label="Mobile"
          name="mobile"
          value={form.mobile}
          onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
        />
        <TextField
          label="Practice / doctor name"
          name="practiceName"
          value={form.practiceName}
          onChange={(e) => setForm((f) => ({ ...f, practiceName: e.target.value }))}
        />
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1.5 block font-medium text-ink">Facility (optional)</span>
          <select
            className="w-full rounded-lg border border-line bg-white px-3 py-2"
            value={form.facilityId}
            onChange={(e) => setForm((f) => ({ ...f, facilityId: e.target.value }))}
          >
            <option value="">Unassigned</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-2">
          <TextField
            label="Remarks"
            name="remarks"
            value={form.remarks}
            onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-2">
          <AuthButton type="submit" disabled={saving || (isMainAdmin && !orgId)}>
            {saving ? 'Creating…' : 'Create sub-account'}
          </AuthButton>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Doctor</th>
              <th className="px-4 py-3">Sub-account ID</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">
                    {u.firstName} {u.lastName}
                  </p>
                  <p className="text-xs text-muted">{u.email}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{u.subAccountId || '—'}</td>
                <td className="px-4 py-3 text-muted">{u.assignedCountry || '—'}</td>
                <td className="px-4 py-3">
                  {u.pendingEmailVerification
                    ? 'Pending email verification'
                    : ACCOUNT_STATUS_LABELS[u.accountStatus]}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-muted">
                  No sub-accounts yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
