import { ALL_AUDIT_ACTIONS, isAuditAction, type AuditAction } from '@ayetis/shared';
import { z } from 'zod';

export const listActivityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  action: z
    .string()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .refine((value): value is AuditAction | undefined => !value || isAuditAction(value), {
      message: `action must be one of: ${ALL_AUDIT_ACTIONS.join(', ')}`,
    }),
  actorEmail: z
    .string()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .pipe(z.string().email().optional()),
  q: z
    .string()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  from: z
    .string()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  to: z
    .string()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});
