import {
  FACILITY_STATUSES,
  FACILITY_STATUS_LABELS,
  type FacilityDto,
  type FacilityStatus,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { AdminOrgPicker, SelectOrganizationEmpty } from '@/features/corporate/AdminOrgPicker';
import * as corporateApi from '@/features/corporate/api';
import { useCorporateOrgId, useIsMainAdmin } from '@/features/corporate/orgContext';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

const EMPTY = {
  name: '',
  country: '',
  state: '',
  city: '',
  address: '',
  timezone: 'UTC',
  contactPhone: '',
  contactEmail: '',
};

export function CorporateFacilitiesPage() {
  const isMainAdmin = useIsMainAdmin();
  const orgId = useCorporateOrgId();
  const [items, setItems] = useState<FacilityDto[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (isMainAdmin && !orgId) {
      setItems([]);
      return;
    }
    try {
      setItems(await corporateApi.fetchFacilities(orgId));
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load facilities'));
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
      await corporateApi.createFacility(
        {
          name: form.name,
          country: form.country,
          state: form.state || undefined,
          city: form.city || undefined,
          address: form.address || undefined,
          timezone: form.timezone || undefined,
          contactPhone: form.contactPhone || undefined,
          contactEmail: form.contactEmail || undefined,
        },
        orgId,
      );
      setForm(EMPTY);
      toast().success('Facility created');
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create facility'));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(facility: FacilityDto, status: FacilityStatus) {
    try {
      await corporateApi.updateFacility(facility.id, { status });
      toast().success(`${facility.name} → ${FACILITY_STATUS_LABELS[status]}`);
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to update facility'));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isMainAdmin ? 'Admin' : 'Corporate'}
        title="Facilities"
        subtitle={
          isMainAdmin
            ? 'Create and manage branches for this company.'
            : 'Create and manage branches for your organization.'
        }
      />
      {isMainAdmin ? <AdminOrgPicker /> : null}
      {error ? <Alert>{error}</Alert> : null}
      {isMainAdmin && !orgId ? <SelectOrganizationEmpty /> : null}

      <form
        onSubmit={onCreate}
        className="grid max-w-3xl gap-4 rounded-xl border border-line bg-white p-5 sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-base font-semibold text-ink">Add facility</h2>
        <TextField
          label="Name"
          name="name"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <TextField
          label="Country"
          name="country"
          required
          value={form.country}
          onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
        />
        <TextField
          label="City"
          name="city"
          value={form.city}
          onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
        />
        <TextField
          label="State"
          name="state"
          value={form.state}
          onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
        />
        <TextField
          label="Address"
          name="address"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />
        <TextField
          label="Timezone"
          name="timezone"
          value={form.timezone}
          onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
        />
        <TextField
          label="Contact phone"
          name="contactPhone"
          value={form.contactPhone}
          onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
        />
        <TextField
          label="Contact email"
          name="contactEmail"
          type="email"
          value={form.contactEmail}
          onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
        />
        <div className="sm:col-span-2">
          <AuthButton type="submit" disabled={saving || (isMainAdmin && !orgId)}>
            {saving ? 'Creating…' : 'Create facility'}
          </AuthButton>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((f) => (
              <tr key={f.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium text-ink">{f.name}</td>
                <td className="px-4 py-3 text-muted">
                  {[f.city, f.state, f.country].filter(Boolean).join(', ') || '—'}
                </td>
                <td className="px-4 py-3">{FACILITY_STATUS_LABELS[f.status]}</td>
                <td className="px-4 py-3">
                  {f.status === FACILITY_STATUSES.ACTIVE ? (
                    <button
                      type="button"
                      className="text-sm font-semibold text-muted hover:text-ink"
                      onClick={() => void setStatus(f, FACILITY_STATUSES.INACTIVE)}
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-sm font-semibold text-brand-600"
                      onClick={() => void setStatus(f, FACILITY_STATUSES.ACTIVE)}
                    >
                      Activate
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-muted">
                  No facilities yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
