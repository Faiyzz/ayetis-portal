import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_TYPES, PERMISSIONS, ROLES, THEMES } from '@ayetis/shared';
import { useAuthStore } from './store';
import { renderHook } from '@testing-library/react';
import { userCan, usePermissions } from './permissions';
import type { PublicUser } from '@ayetis/shared';

vi.mock('@/features/auth/api', () => ({
  login: vi.fn(async () => ({
    user: { id: '1', email: 'd@test.com', role: 'doctor', permissions: ['case:create'] },
    tokens: { accessToken: 'tok', expiresIn: '7d' },
  })),
  logout: vi.fn(async () => undefined),
  fetchMe: vi.fn(async () => ({
    id: '1',
    email: 'd@test.com',
    role: 'doctor',
    permissions: ['case:create'],
  })),
}));

function user(overrides: Partial<PublicUser> = {}): PublicUser {
  return {
    id: '1',
    email: 'd@test.com',
    firstName: 'Ada',
    lastName: 'L',
    role: ROLES.DOCTOR,
    roles: [ROLES.DOCTOR],
    primaryRole: ROLES.DOCTOR,
    accountType: ACCOUNT_TYPES.INDIVIDUAL,
    accountStatus: 'active',
    doctorId: 'D-1',
    clinicName: 'C',
    companyName: null,
    companyAddress: null,
    organizationId: null,
    corporateCustomerId: null,
    facilityId: null,
    employeeId: null,
    subAccountId: null,
    assignedCountry: null,
    slaBusinessHours: 48,
    isActive: true,
    departmentId: null,
    departmentName: null,
    teamIds: [],
    experienceLevel: null,
    softwareExpertise: [],
    permissions: [PERMISSIONS.CASE_CREATE, PERMISSIONS.CASE_VIEW_OWN],
    themePreference: THEMES.LIGHT,
    mustChangePassword: false,
    passwordExpired: false,
    ...overrides,
  } as PublicUser;
}

describe('auth store and permissions', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: null, token: null, isBootstrapping: false });
  });

  it('stores a session token', () => {
    useAuthStore.getState().setSession(user(), 'abc');
    expect(localStorage.getItem('ayetis_token')).toBe('abc');
    expect(useAuthStore.getState().user?.email).toBe('d@test.com');
    useAuthStore.getState().clearSession();
    expect(localStorage.getItem('ayetis_token')).toBeNull();
  });

  it('logs in through the API', async () => {
    await useAuthStore.getState().login('d@test.com', 'pw', ACCOUNT_TYPES.INDIVIDUAL);
    expect(useAuthStore.getState().token).toBe('tok');
  });

  it('bootstraps from a stored token and logs out', async () => {
    localStorage.setItem('ayetis_token', 'tok');
    useAuthStore.setState({ user: null, token: 'tok', isBootstrapping: true });
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().isBootstrapping).toBe(false);
    useAuthStore.setState({ user: user(), token: 'tok' });
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('checks effective permissions', () => {
    expect(userCan(user(), PERMISSIONS.CASE_CREATE)).toBe(true);
    expect(userCan(user(), PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
    expect(userCan(null, PERMISSIONS.CASE_CREATE)).toBe(false);
    useAuthStore.setState({ user: user(), token: 't', isBootstrapping: false });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can(PERMISSIONS.CASE_CREATE)).toBe(true);
    expect(result.current.canAny(PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.CASE_CREATE)).toBe(true);
  });
});
