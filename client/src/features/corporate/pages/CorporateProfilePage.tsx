import { useEffect, useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import * as corporateApi from '@/features/corporate/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';
import type { OrganizationDto } from '@ayetis/shared';

export function CorporateProfilePage() {
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
      try {
        const data = await corporateApi.fetchOrganization();
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
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await corporateApi.updateOrganization({
        companyName: form.companyName,
        country: form.country,
        address: {
          street: form.street,
          city: form.city,
          state: form.state,
          country: form.country,
          postalCode: form.postalCode,
        },
      });
      setOrg(updated);
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
        eyebrow="Corporate"
        title="Company profile"
        subtitle={
          org
            ? `Customer ID ${org.corporateCustomerId}`
            : 'Update company name and address for your organization.'
        }
      />
      {error ? <Alert>{error}</Alert> : null}
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
        <AuthButton type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save profile'}
        </AuthButton>
      </form>
    </div>
  );
}
