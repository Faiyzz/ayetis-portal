import { describe, expect, it, vi } from 'vitest';
import { REGISTRATION_STATUSES } from '@ayetis/shared';
import { AppError } from '../../utils/AppError';

const { RegistrationRequest } = vi.hoisted(() => ({
  RegistrationRequest: {
    findById: vi.fn(),
  },
}));

vi.mock('../../models/RegistrationRequest', () => ({ RegistrationRequest }));
vi.mock('../../models/User', () => ({ User: { findOne: vi.fn(), create: vi.fn() } }));
vi.mock('../../models/Organization', () => ({ Organization: { create: vi.fn() } }));
vi.mock('../../models/CorporateCounter', () => ({ generateCorporateCustomerId: vi.fn() }));
vi.mock('../../models/DoctorCounter', () => ({ generateDoctorId: vi.fn() }));
vi.mock('../../models/SystemConfig', () => ({
  getSystemMessages: vi.fn(),
  updateSystemMessages: vi.fn(),
}));
vi.mock('../audit/audit.service', () => ({ recordActivity: vi.fn() }));
vi.mock('../../services/email', () => ({
  sendCmsOrFallback: vi.fn(),
  registrationRejectedTemplate: vi.fn(() => ({ subject: 'r', html: '' })),
}));
vi.mock('../users/users.service', () => ({ toPublicUserAsync: vi.fn() }));
vi.mock('../settings/geoResolve', () => ({
  resolveCountryGeo: vi.fn(),
  userGeoFromResolved: vi.fn(() => ({})),
}));

import { getRegistration, rejectRegistration } from './registrations.service';

describe('registrations', () => {
  it('rejects with a reason of at least 3 characters', async () => {
    RegistrationRequest.findById.mockResolvedValue(null);
    await expect(getRegistration('x')).rejects.toBeInstanceOf(AppError);

    const request = {
      id: 'r1',
      email: 'doc@test.com',
      firstName: 'Ada',
      lastName: 'L',
      accountType: 'individual',
      status: REGISTRATION_STATUSES.PENDING_APPROVAL,
      createdAt: new Date(),
      updatedAt: new Date(),
      save: vi.fn(async () => undefined),
    };
    RegistrationRequest.findById.mockResolvedValue(request);
    await expect(
      rejectRegistration('r1', 'no', { id: 'a', email: 'admin@x.com', role: 'admin' }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await rejectRegistration('r1', 'Incomplete clinic details', {
      id: 'a',
      email: 'admin@x.com',
      role: 'admin',
    });
    expect(request.status).toBe(REGISTRATION_STATUSES.REJECTED);
  });
});
