import { isPasswordComplex, PASSWORD_POLICY_DESCRIPTION } from '@ayetis/shared';
import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .refine((value) => isPasswordComplex(value), {
    message: PASSWORD_POLICY_DESCRIPTION,
  });

export const registerSchema = z.object({
  email: z.string().email('Enter a valid email address').toLowerCase().trim(),
  password: passwordSchema,
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Last name is required').max(80),
});

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address').toLowerCase().trim(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
