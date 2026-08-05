import {
  ALL_REGISTRATION_STATUSES,
  type RegistrationStatus,
  type SystemMessages,
} from '@ayetis/shared';
import { z } from 'zod';

export const listRegistrationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  status: z
    .custom<RegistrationStatus>(
      (value): value is RegistrationStatus =>
        typeof value === 'string' &&
        (ALL_REGISTRATION_STATUSES as string[]).includes(value),
      { message: 'Invalid registration status' },
    )
    .optional(),
});

export const rejectRegistrationSchema = z.object({
  reason: z.string().trim().min(3, 'Rejection reason is required').max(1000),
});

export const updateMessagesSchema = z
  .object({
    registrationConfirmation: z.string().trim().min(1).max(2000).optional(),
    emailVerifiedPending: z.string().trim().min(1).max(2000).optional(),
    accountBlocked: z.string().trim().min(1).max(2000).optional(),
    accountSuspended: z.string().trim().min(1).max(2000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one message field is required',
  }) satisfies z.ZodType<Partial<SystemMessages>>;
