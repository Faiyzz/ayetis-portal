import {
  ALL_ACCOUNT_STATUSES,
  ALL_ACCOUNT_TYPES,
  ALL_ROLES,
  isPasswordComplex,
  PASSWORD_POLICY_DESCRIPTION,
  type AccountStatus,
  type AccountType,
  type Role,
} from '@ayetis/shared';
import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .refine((value) => isPasswordComplex(value), {
    message: PASSWORD_POLICY_DESCRIPTION,
  });

const permissionListSchema = z.array(z.string()).default([]);

const roleSchema = z.custom<Role>(
  (value): value is Role => typeof value === 'string' && (ALL_ROLES as string[]).includes(value),
  { message: 'Invalid role' },
);

const accountTypeSchema = z.custom<AccountType>(
  (value): value is AccountType =>
    typeof value === 'string' && (ALL_ACCOUNT_TYPES as string[]).includes(value),
  { message: 'Invalid account type' },
);

const accountStatusSchema = z.custom<AccountStatus>(
  (value): value is AccountStatus =>
    typeof value === 'string' && (ALL_ACCOUNT_STATUSES as string[]).includes(value),
  { message: 'Invalid account status' },
);

export const createUserSchema = z.object({
  email: z.string().email('Enter a valid email address').toLowerCase().trim(),
  password: passwordSchema,
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Last name is required').max(80),
  role: roleSchema,
  accountType: accountTypeSchema.optional(),
  clinicName: z.string().trim().max(160).nullable().optional(),
  companyName: z.string().trim().max(160).nullable().optional(),
  departmentId: z.string().trim().nullable().optional(),
  permissionGrants: permissionListSchema.optional(),
  permissionDenies: permissionListSchema.optional(),
});

export const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    role: roleSchema.optional(),
    isActive: z.boolean().optional(),
    accountStatus: accountStatusSchema.optional(),
    clinicName: z.string().trim().max(160).nullable().optional(),
    companyName: z.string().trim().max(160).nullable().optional(),
    departmentId: z.string().trim().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const assignPermissionsSchema = z.object({
  grants: permissionListSchema,
  denies: permissionListSchema,
});
