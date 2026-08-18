import { describe, expect, it } from 'vitest';
import {
  canLogin,
  canSubmitWork,
  canViewDoctorName,
  formatDoctorDisplay,
  isAccountActive,
  isAccountStatus,
  isAccountType,
  isRegistrationStatus,
} from './account';
import { ROLES, getRoleLabel, isBuiltInRole, isRole } from './roles';
import {
  PERMISSIONS,
  getPermissionCatalog,
  getPermissionsForRole,
  hasAnyPermission,
  hasPermission,
  isPermission,
  permissionsInclude,
  resolveEffectivePermissions,
} from './permissions';
import {
  QC_SCOPES,
  canQcCase,
  resolveQcScope,
  slugifyRoleKey,
  toRbacMatrixGroup,
} from './rbac';
import {
  getDashboardConfig,
  getDashboardPath,
  getRoleOptions,
  resolvePortalTemplate,
} from './portals';
import {
  formatCorporateCustomerId,
  formatEmployeeId,
  formatSubAccountId,
  isFacilityStatus,
} from './corporate';

describe('account login gates', () => {
  it('allows active and suspended login but blocks others from submitting', () => {
    expect(canLogin('active')).toBe(true);
    expect(canLogin('suspended')).toBe(true);
    expect(canLogin('blocked')).toBe(false);
    expect(canSubmitWork('active')).toBe(true);
    expect(canSubmitWork('suspended')).toBe(false);
    expect(isAccountActive('active')).toBe(true);
    expect(isAccountType('corporate')).toBe(true);
    expect(isAccountStatus('blocked')).toBe(true);
    expect(isRegistrationStatus('pending_approval')).toBe(true);
  });

  it('redacts doctor names for non-admin viewers', () => {
    expect(canViewDoctorName(ROLES.ADMIN, 'x', 'doc-1')).toBe(true);
    expect(canViewDoctorName(ROLES.DOCTOR, 'doc-1', 'doc-1')).toBe(true);
    expect(canViewDoctorName(ROLES.COORDINATOR, 'c1', 'doc-1')).toBe(false);
    expect(
      formatDoctorDisplay(ROLES.COORDINATOR, 'c1', {
        doctorUserId: 'doc-1',
        doctorName: 'Ada',
        doctorId: 'D-9',
      }),
    ).toBe('D-9');
  });
});

describe('URD RBAC matrix', () => {
  it('does not give doctors Settings or cancellation reports', () => {
    expect(hasPermission(ROLES.DOCTOR, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
    expect(hasPermission(ROLES.DOCTOR, PERMISSIONS.CANCELLATION_REPORT_VIEW)).toBe(false);
    expect(hasPermission(ROLES.DOCTOR, PERMISSIONS.CASE_CREATE)).toBe(true);
    expect(hasPermission(ROLES.CORPORATE_ADMIN, PERMISSIONS.CORPORATE_REPORT_VIEW)).toBe(true);
    expect(hasPermission(ROLES.CORPORATE_ADMIN, PERMISSIONS.CORPORATE_AUDIT_VIEW)).toBe(true);
    expect(hasPermission(ROLES.ADMIN, PERMISSIONS.SETTINGS_MANAGE)).toBe(true);
  });

  it('applies grant/deny overrides and keeps admin complete', () => {
    const granted = resolveEffectivePermissions({
      role: ROLES.DESIGNER,
      userOverrides: { grants: [PERMISSIONS.REPORT_VIEW] },
    });
    expect(granted).toContain(PERMISSIONS.REPORT_VIEW);
    expect(granted).toContain(PERMISSIONS.CASE_DESIGN);

    const denied = resolveEffectivePermissions({
      role: ROLES.COORDINATOR,
      userOverrides: { denies: [PERMISSIONS.CASE_ASSIGN] },
    });
    expect(denied).not.toContain(PERMISSIONS.CASE_ASSIGN);

    const admin = resolveEffectivePermissions({
      role: ROLES.ADMIN,
      userOverrides: { denies: [PERMISSIONS.SETTINGS_MANAGE] },
    });
    expect(admin).toEqual(expect.arrayContaining([PERMISSIONS.SETTINGS_MANAGE]));
    expect(permissionsInclude(granted, PERMISSIONS.REPORT_VIEW)).toBe(true);
    expect(hasAnyPermission(ROLES.ANALYTICS, [PERMISSIONS.REPORT_VIEW])).toBe(true);
    expect(isPermission(PERMISSIONS.CASE_CREATE)).toBe(true);
    expect(getPermissionCatalog().length).toBeGreaterThan(20);
    expect(getPermissionsForRole(ROLES.QC)).toContain(PERMISSIONS.CASE_QC_REVIEW);
  });

  it('enforces QC scope so operators cannot review the wrong cases', () => {
    expect(canQcCase(QC_SCOPES.NONE, { actorId: 'a', designerId: 'a' }).allowed).toBe(false);
    expect(canQcCase(QC_SCOPES.OWN_ONLY, { actorId: 'a', designerId: 'b' }).allowed).toBe(false);
    expect(canQcCase(QC_SCOPES.OWN_ONLY, { actorId: 'a', designerId: 'a' }).allowed).toBe(true);
    expect(canQcCase(QC_SCOPES.OTHERS_ONLY, { actorId: 'a', designerId: 'a' }).allowed).toBe(false);
    expect(canQcCase(QC_SCOPES.OTHERS_ONLY, { actorId: 'a', designerId: 'b' }).allowed).toBe(true);
    expect(canQcCase(QC_SCOPES.ALL, { actorId: 'a', designerId: 'a' }).allowed).toBe(true);
    expect(resolveQcScope([QC_SCOPES.OWN_ONLY])).toBe(QC_SCOPES.OWN_ONLY);
    expect(slugifyRoleKey(' Senior Designer ')).toBe('senior_designer');
    expect(toRbacMatrixGroup('Cases')).toBe('Case');
    expect(toRbacMatrixGroup('Settings')).toBe('Administrative');
  });
});

describe('portals and corporate ids', () => {
  it('routes each role to its dashboard path', () => {
    expect(getDashboardPath(ROLES.DOCTOR)).toBe('/app/doctor');
    expect(getDashboardPath(ROLES.ADMIN)).toBe('/app/admin');
    expect(getDashboardPath(ROLES.CORPORATE_ADMIN)).toBe('/app/corporate');
    expect(getDashboardPath(ROLES.ANALYTICS)).toBe('/app/analytics');
    expect(getDashboardConfig(ROLES.COORDINATOR).path).toBe('/app/coordinator');
    expect(resolvePortalTemplate(ROLES.QC)).toBe('qc');
    expect(getRoleOptions().some((o) => o.value === ROLES.DOCTOR)).toBe(true);
    expect(isRole('doctor')).toBe(true);
    expect(isBuiltInRole('doctor')).toBe(true);
    expect(getRoleLabel('doctor')).toBe('Doctor');
  });

  it('formats corporate, employee, and sub-account identifiers', () => {
    expect(formatCorporateCustomerId(134789)).toBe('C134789');
    expect(formatSubAccountId(1, 'C134789')).toBe('001_C134789');
    expect(formatEmployeeId(1)).toBe('EMP-00000001');
    expect(isFacilityStatus('active')).toBe(true);
  });
});
