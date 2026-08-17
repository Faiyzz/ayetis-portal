import { type OrganizationDto } from '@ayetis/shared';
import { useEffect, useState } from 'react';
import * as corporateApi from '@/features/corporate/api';
import { useAdminOrgStore, useIsMainAdmin } from '@/features/corporate/orgContext';

export function AdminOrgPicker({ className }: { className?: string }) {
  const isMainAdmin = useIsMainAdmin();
  const organizationId = useAdminOrgStore((s) => s.organizationId);
  const setOrganizationId = useAdminOrgStore((s) => s.setOrganizationId);
  const [organizations, setOrganizations] = useState<OrganizationDto[]>([]);

  useEffect(() => {
    if (!isMainAdmin) return;
    let cancelled = false;
    void corporateApi
      .fetchOrganizations()
      .then((orgs) => {
        if (!cancelled) setOrganizations(orgs);
      })
      .catch(() => {
        if (!cancelled) setOrganizations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isMainAdmin]);

  if (!isMainAdmin) return null;

  return (
    <label className={className ?? 'block max-w-md text-sm'}>
      <span className="mb-1.5 block font-medium text-ink">Organization</span>
      <select
        className="w-full rounded-lg border border-line bg-white px-3 py-2"
        value={organizationId}
        onChange={(e) => setOrganizationId(e.target.value)}
      >
        <option value="">Select an organization</option>
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.companyName || 'Unnamed'} ({org.corporateCustomerId})
          </option>
        ))}
      </select>
    </label>
  );
}

export function SelectOrganizationEmpty() {
  return (
    <p className="rounded-xl border border-line bg-white px-5 py-8 text-sm text-muted">
      Select an organization to continue.
    </p>
  );
}
