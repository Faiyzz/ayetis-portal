import {
  ACCOUNT_TYPES,
  ALL_ACCOUNT_TYPES,
  isPasswordComplex,
  PASSWORD_POLICY_DESCRIPTION,
  type AccountType,
} from '@ayetis/shared';
import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .refine((value) => isPasswordComplex(value), {
    message: PASSWORD_POLICY_DESCRIPTION,
  });

const accountTypeSchema = z.custom<AccountType>(
  (value): value is AccountType =>
    typeof value === 'string' && (ALL_ACCOUNT_TYPES as string[]).includes(value),
  { message: 'Account type must be individual or corporate' },
);

export const registerSchema = z
  .object({
    email: z.string().email('Enter a valid email address').toLowerCase().trim(),
    password: passwordSchema,
    firstName: z.string().trim().min(1, 'First name is required').max(80),
    lastName: z.string().trim().min(1, 'Last name is required').max(80),
    accountType: accountTypeSchema.default(ACCOUNT_TYPES.INDIVIDUAL),
    clinicName: z.string().trim().max(160).optional(),
    companyName: z.string().trim().max(160).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.accountType === ACCOUNT_TYPES.CORPORATE) {
      if (!value.companyName || value.companyName.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Company name is required for corporate accounts',
          path: ['companyName'],
        });
      }
    } else if (value.clinicName !== undefined && value.clinicName.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Clinic name cannot be empty',
        path: ['clinicName'],
      });
    }
  });

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
  accountType: accountTypeSchema,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address').toLowerCase().trim(),
});

export const confirmPasswordResetSchema = z.object({
  token: z.string().min(1, 'Confirmation token is required'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ConfirmPasswordResetInput = z.infer<typeof confirmPasswordResetSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
