import { ALL_ROLES, type Role } from '@ayetis/shared';
import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[0-9]/, 'Password must include a number');

const permissionListSchema = z.array(z.string()).default([]);

const roleSchema = z.custom<Role>(
  (value): value is Role => typeof value === 'string' && (ALL_ROLES as string[]).includes(value),
  { message: 'Invalid role' },
);

export const createUserSchema = z.object({
  email: z.string().email('Enter a valid email address').toLowerCase().trim(),
  password: passwordSchema,
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Last name is required').max(80),
  role: roleSchema,
  permissionGrants: permissionListSchema.optional(),
  permissionDenies: permissionListSchema.optional(),
});

export const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    role: roleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const assignPermissionsSchema = z.object({
  grants: permissionListSchema,
  denies: permissionListSchema,
});
