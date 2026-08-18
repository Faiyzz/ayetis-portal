import { describe, expect, it } from 'vitest';
import { AUDIT_ACTIONS, ROLES } from '@ayetis/shared';
import { listActivityQuerySchema } from './audit/audit.schemas';
import {
  createClarificationSchema,
  replyClarificationSchema,
} from './clarifications/clarifications.schemas';
import { createFacilitySchema, updateOrganizationSchema } from './corporate/corporate.schemas';
import { rejectRegistrationSchema } from './registrations/registrations.schemas';
import { createUserSchema } from './users/users.schemas';

describe('feature Zod schemas', () => {
  it('rejects registrations without a 3+ character reason', () => {
    expect(rejectRegistrationSchema.safeParse({ reason: 'no' }).success).toBe(false);
    expect(rejectRegistrationSchema.safeParse({ reason: 'incomplete docs' }).success).toBe(true);
  });

  it('requires clarification subject and reply body', () => {
    expect(
      createClarificationSchema.safeParse({
        subject: 'Need bite',
        requiredInfo: 'Please recapture the bite',
        clarificationType: 'records',
      }).success,
    ).toBe(true);
    expect(replyClarificationSchema.safeParse({ body: '' }).success).toBe(false);
    expect(replyClarificationSchema.safeParse({ body: 'Attached OPG' }).success).toBe(true);
  });

  it('validates corporate facilities and users', () => {
    expect(
      createFacilitySchema.safeParse({ name: 'Downtown', country: 'United States' }).success,
    ).toBe(true);
    expect(updateOrganizationSchema.safeParse({ companyName: 'Acme Dental' }).success).toBe(true);
    expect(
      createUserSchema.safeParse({
        email: 'staff@test.com',
        password: 'ValidPass1!',
        firstName: 'Pat',
        lastName: 'Lee',
        role: ROLES.COORDINATOR,
      }).success,
    ).toBe(true);
    expect(
      createUserSchema.safeParse({
        email: 'bad',
        password: 'weak',
        firstName: 'P',
        lastName: 'L',
        role: 'not-a-role',
      }).success,
    ).toBe(false);
  });

  it('filters audit log queries', () => {
    expect(listActivityQuerySchema.safeParse({ action: AUDIT_ACTIONS.CASE_CREATE }).success).toBe(
      true,
    );
    expect(listActivityQuerySchema.safeParse({ action: 'not-an-action' }).success).toBe(false);
    expect(listActivityQuerySchema.safeParse({ action: '', q: '', actorEmail: '' }).success).toBe(
      true,
    );
  });
});
