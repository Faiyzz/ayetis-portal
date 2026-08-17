import { useEffect, useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { AdminOrgPicker, SelectOrganizationEmpty } from '@/features/corporate/AdminOrgPicker';
import * as corporateApi from '@/features/corporate/api';
import { useCorporateOrgId, useIsMainAdmin } from '@/features/corporate/orgContext';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';
import type { OrganizationDto } from '@ayetis/shared';

export function CorporateProfilePage() {
  const isMainAdmin = useIsMainAdmin();
  const orgId = useCorporateOrgId();
  const [org, setOrg] = useState<OrganizationDto | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    companyName: '',
    street: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError('');
      setOrg(null);
      if (isMainAdmin && !orgId) return;
      try {
        const data = await corporateApi.fetchOrganization(orgId);
        if (cancelled) return;
        setOrg(data);
        setForm({
          companyName: data.companyName,
          street: data.address.street,
          city: data.address.city,
          state: data.address.state,
          country: data.address.country || data.country,
          postalCode: data.address.postalCode,
        });
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Unable to load organization'));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isMainAdmin, orgId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await corporateApi.updateOrganization(
        {
          companyName: form.companyName,
          country: form.country,
          address: {
            street: form.street,
            city: form.city,
            state: form.state,
            country: form.country,
            postalCode: form.postalCode,
          },
        },
        orgId,
      );
      setOrg(updated);
      setForm({
        companyName: updated.companyName,
        street: updated.address.street,
        city: updated.address.city,
        state: updated.address.state,
        country: updated.address.country || updated.country,
        postalCode: updated.address.postalCode,
      });
      toast().success('Organization profile saved');
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to save profile'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isMainAdmin ? 'Admin' : 'Corporate'}
        title="Company profile"
        subtitle={
          org
            ? `Customer ID ${org.corporateCustomerId}`
            : isMainAdmin
              ? 'Update company name and address for this organization.'
              : 'Update company name and address for your organization.'
        }
      />
      {isMainAdmin ? <AdminOrgPicker /> : null}
      {error ? <Alert>{error}</Alert> : null}
      {isMainAdmin && !orgId ? <SelectOrganizationEmpty /> : null}
      {isMainAdmin && !orgId ? null : (
      <form onSubmit={onSubmit} className="max-w-xl space-y-4 rounded-xl border border-line bg-white p-5">
        <TextField
          label="Company name"
          name="companyName"
          required
          value={form.companyName}
          onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
        />
        <TextField
          label="Street"
          name="street"
          value={form.street}
          onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="City"
            name="city"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          />
          <TextField
            label="State / Province"
            name="state"
            value={form.state}
            onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Country"
            name="country"
            required
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
          />
          <TextField
            label="Postal code"
            name="postalCode"
            value={form.postalCode}
            onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
          />
        </div>
        <AuthButton type="submit" disabled={saving || (isMainAdmin && !orgId)}>
          {saving ? 'Saving…' : 'Save profile'}
        </AuthButton>
      </form>
      )}
    </div>
  );
}
