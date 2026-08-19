import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { ACCOUNT_TYPES, PERMISSIONS, ROLES, THEMES } from '@ayetis/shared';
import { GuestOnly, RequireAnyPermission, RequireAuth, RequirePermission } from './AppShell';
import { useAuthStore } from '@/features/auth/store';
import type { PublicUser } from '@ayetis/shared';

function doctor(overrides: Partial<PublicUser> = {}): PublicUser {
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
    clinicName: null,
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
    isAvailable: true,
    qcScope: 'none',
    permissionGrants: [],
    permissionDenies: [],
    permissions: [PERMISSIONS.CASE_CREATE, PERMISSIONS.CASE_VIEW_OWN],
    mustChangePassword: false,
    passwordExpired: false,
    passwordChangedAt: null,
    passwordExpiresAt: null,
    themePreference: THEMES.LIGHT,
    lockoutUntil: null,
    isLocked: false,
    lastLoginAt: null,
    lastLoginIp: null,
    lastLoginUserAgent: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function renderAt(ui: React.ReactElement, path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>login-page</div>} />
        <Route path="/app/doctor" element={<div>doctor-home</div>} />
        <Route path="/app/change-password" element={<div>change-password</div>} />
        <Route path="/app/settings" element={ui}>
          <Route index element={<div>settings-secret</div>} />
        </Route>
        <Route path="/app/cases" element={ui}>
          <Route index element={<div>cases-ok</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('route gates', () => {
  it('sends guests to login', () => {
    useAuthStore.setState({ user: null, token: null, isBootstrapping: false });
    renderAt(<RequireAuth />, '/app/cases');
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });

  it('forces a password change when required', () => {
    useAuthStore.setState({
      user: doctor({ mustChangePassword: true }),
      token: 't',
      isBootstrapping: false,
    });
    renderAt(<RequireAuth />, '/app/cases');
    expect(screen.getByText('change-password')).toBeInTheDocument();
  });

  it('redirects doctors away from Settings', () => {
    useAuthStore.setState({
      user: doctor(),
      token: 't',
      isBootstrapping: false,
    });
    renderAt(<RequirePermission permission={PERMISSIONS.SETTINGS_MANAGE} />, '/app/settings');
    expect(screen.getByText('doctor-home')).toBeInTheDocument();
  });

  it('redirects doctors away from Commercial admin', () => {
    useAuthStore.setState({
      user: doctor({
        permissions: [PERMISSIONS.INVOICE_VIEW, PERMISSIONS.CASE_VIEW_OWN],
      }),
      token: 't',
      isBootstrapping: false,
    });
    renderAt(
      <RequireAnyPermission
        permissions={[PERMISSIONS.INVOICE_MANAGE, PERMISSIONS.TREATMENT_PLAN_MANAGE]}
      />,
      '/app/settings',
    );
    expect(screen.getByText('doctor-home')).toBeInTheDocument();
  });

  it('sends authenticated users away from guest routes', () => {
    useAuthStore.setState({
      user: doctor(),
      token: 't',
      isBootstrapping: false,
    });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<GuestOnly />}>
            <Route index element={<div>login-form</div>} />
          </Route>
          <Route path="/app/doctor" element={<div>doctor-home</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('doctor-home')).toBeInTheDocument();
  });
});
