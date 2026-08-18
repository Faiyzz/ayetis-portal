import { describe, expect, it, vi } from 'vitest';
import { ROLES } from '@ayetis/shared';
import { AppError } from '../../utils/AppError';

vi.mock('../../models/Organization', () => ({ Organization: { findById: vi.fn() } }));
vi.mock('../../models/Facility', () => ({ Facility: { find: vi.fn(), create: vi.fn() } }));
vi.mock('../../models/User', () => ({ User: { find: vi.fn(), create: vi.fn() } }));
vi.mock('../../models/Case', () => ({ Case: { find: vi.fn(), countDocuments: vi.fn() } }));
vi.mock('../../models/CorporateCounter', () => ({ generateCorporateCustomerId: vi.fn() }));
vi.mock('../../models/DoctorCounter', () => ({ generateDoctorId: vi.fn() }));
vi.mock('../audit/audit.service', () => ({ recordActivity: vi.fn() }));
vi.mock('../users/users.service', () => ({ toPublicUserAsync: vi.fn() }));
vi.mock('../../services/email', () => ({ sendCmsOrFallback: vi.fn() }));
vi.mock('../settings/geoResolve', () => ({
  resolveCountryGeo: vi.fn(),
  userGeoFromResolved: vi.fn(),
}));

import { resolveActorOrganizationId } from './corporate.service';

describe('corporate org scope', () => {
  it('requires a linked organization for non-admin actors', async () => {
    await expect(
      resolveActorOrganizationId({
        id: 'c1',
        email: 'c@test.com',
        role: ROLES.CORPORATE_ADMIN,
        permissions: [],
      }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      resolveActorOrganizationId({
        id: 'c1',
        email: 'c@test.com',
        role: ROLES.CORPORATE_ADMIN,
        permissions: [],
        organizationId: 'org-1',
      }),
    ).resolves.toBe('org-1');
  });
});
