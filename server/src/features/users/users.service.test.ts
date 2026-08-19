import { describe, expect, it, vi } from 'vitest';
import { ACCOUNT_STATUSES, PERMISSIONS, ROLES } from '@ayetis/shared';
import { AppError } from '../../utils/AppError';

const { User } = vi.hoisted(() => ({
  User: { findById: vi.fn() },
}));
vi.mock('../../models/User', () => ({ User }));
vi.mock('../../models/DoctorCounter', () => ({ generateDoctorId: vi.fn() }));
vi.mock('../../models/SystemConfig', () => ({
  getSystemMessages: vi.fn(async () => ({ accountSuspended: 'suspended' })),
}));
vi.mock('../audit/audit.service', () => ({ recordActivity: vi.fn() }));
vi.mock('../../services/email', () => ({
  sendTemplatedEmail: vi.fn(),
  temporaryPasswordTemplate: vi.fn(),
}));
vi.mock('../rbac/rbac.service', () => ({
  getLegacyRolePermissionConfig: vi.fn(),
  listLegacyRolePermissionConfigs: vi.fn(),
  patchRolePermissions: vi.fn(),
  resolvePermissionsForUser: vi.fn(async () => []),
  resolveUserQcScope: vi.fn(async () => 'none'),
  resolveUserRoleKeys: vi.fn(() => ['doctor']),
}));
vi.mock('../settings/geoResolve', () => ({
  resolveCountryGeo: vi.fn(),
  userGeoFromResolved: vi.fn(),
}));

import {
  assertCanSubmitWork,
  describeRolePermissions,
  userHasEffectivePermission,
} from './users.service';

describe('users.service helpers', () => {
  it('describes role defaults', () => {
    const doctor = describeRolePermissions(ROLES.DOCTOR);
    expect(doctor.defaults).not.toContain(PERMISSIONS.SETTINGS_MANAGE);
    expect(doctor.defaults).not.toContain(PERMISSIONS.CASE_VIEW_FACILITY);
    expect(userHasEffectivePermission(doctor.defaults, PERMISSIONS.CASE_CREATE)).toBe(true);
    expect(userHasEffectivePermission(doctor.defaults, PERMISSIONS.CASE_VIEW_OWN)).toBe(true);
  });

  it('blocks suspended accounts from submitting work', async () => {
    User.findById.mockResolvedValue(null);
    await expect(assertCanSubmitWork('x')).rejects.toBeInstanceOf(AppError);
    User.findById.mockResolvedValue({ accountStatus: ACCOUNT_STATUSES.SUSPENDED });
    await expect(assertCanSubmitWork('x')).rejects.toMatchObject({ statusCode: 403 });
    User.findById.mockResolvedValue({ accountStatus: ACCOUNT_STATUSES.ACTIVE, id: 'u' });
    await expect(assertCanSubmitWork('x')).resolves.toMatchObject({ id: 'u' });
  });
});
