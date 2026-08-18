import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ACCOUNT_TYPES, PERMISSIONS, ROLES, THEMES } from '@ayetis/shared';
import { useAuthStore } from '@/features/auth/store';
import { useAdminOrgStore, useCorporateOrgId, useIsMainAdmin } from './orgContext';
import type { PublicUser } from '@ayetis/shared';

function user(role: PublicUser['role']): PublicUser {
  return {
    id: '1',
    email: 'a@test.com',
    firstName: 'Ada',
    lastName: 'L',
    role,
    roles: [role],
    primaryRole: role,
    accountType: ACCOUNT_TYPES.INDIVIDUAL,
    accountStatus: 'active',
    permissions: [PERMISSIONS.CASE_VIEW_OWN],
    themePreference: THEMES.LIGHT,
  } as PublicUser;
}

describe('admin org context', () => {
  it('only main admins send an organization query param', () => {
    useAdminOrgStore.getState().setOrganizationId('org-9');
    useAuthStore.setState({ user: user(ROLES.ADMIN), token: 't', isBootstrapping: false });
    const admin = renderHook(() => ({
      isAdmin: useIsMainAdmin(),
      orgId: useCorporateOrgId(),
    }));
    expect(admin.result.current.isAdmin).toBe(true);
    expect(admin.result.current.orgId).toBe('org-9');

    useAuthStore.setState({ user: user(ROLES.DOCTOR), token: 't', isBootstrapping: false });
    const doctor = renderHook(() => ({
      isAdmin: useIsMainAdmin(),
      orgId: useCorporateOrgId(),
    }));
    expect(doctor.result.current.isAdmin).toBe(false);
    expect(doctor.result.current.orgId).toBeUndefined();
  });
});
