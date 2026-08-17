import { ROLES } from '@ayetis/shared';
import { create } from 'zustand';
import { useAuthStore } from '@/features/auth/store';

const STORAGE_KEY = 'ayetis_admin_organization_id';

function readStoredOrgId(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

interface AdminOrgState {
  organizationId: string;
  setOrganizationId: (id: string) => void;
  clearOrganizationId: () => void;
}

export const useAdminOrgStore = create<AdminOrgState>((set) => ({
  organizationId: readStoredOrgId(),
  setOrganizationId: (id) => {
    try {
      if (id) sessionStorage.setItem(STORAGE_KEY, id);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    set({ organizationId: id });
  },
  clearOrganizationId: () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    set({ organizationId: '' });
  },
}));

export function useIsMainAdmin(): boolean {
  return useAuthStore((s) => s.user)?.role === ROLES.ADMIN;
}

/** Query param for corporate APIs. Only Main Admin must pass an organization. */
export function useCorporateOrgId(): string | undefined {
  const isMainAdmin = useIsMainAdmin();
  const organizationId = useAdminOrgStore((s) => s.organizationId);
  if (!isMainAdmin) return undefined;
  return organizationId || undefined;
}
