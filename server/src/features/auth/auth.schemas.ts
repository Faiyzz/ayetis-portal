import {
  ACCOUNT_TYPES,
  ALL_ACCOUNT_TYPES,
  type AccountType,
} from '@ayetis/shared';
import { z } from 'zod';
import { passwordSchema } from '../../utils/passwordSchema';

export { passwordSchema };

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
    companyAddress: z
      .object({
        street: z.string().trim().max(200).optional(),
        city: z.string().trim().max(120).optional(),
        state: z.string().trim().max(120).optional(),
        country: z.string().trim().max(80).optional(),
        postalCode: z.string().trim().max(40).optional(),
      })
      .optional(),
    countryId: z.string().optional(),
    countryName: z.string().trim().max(120).optional(),
    otherCountryName: z.string().trim().max(120).optional(),
    mobileCountryCode: z.string().trim().max(12).optional(),
    mobileNumber: z.string().trim().max(40).optional(),
    gender: z.string().trim().max(80).optional(),
    language: z.string().trim().max(80).optional(),
    profession: z.string().trim().max(120).optional(),
    professionSpecialization: z.string().trim().max(160).optional(),
    academicTitle: z.string().trim().max(80).optional(),
    academicTitleOther: z.string().trim().max(120).optional(),
    privacyPolicyVersionAccepted: z.string().trim().max(40).optional(),
    preferredCurrency: z.string().trim().max(8).optional(),
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
      const addr = value.companyAddress;
      if (!addr?.street?.trim() || !addr?.city?.trim() || !addr?.country?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Company address (street, city, country) is required',
          path: ['companyAddress'],
        });
      }
    } else if (value.clinicName !== undefined && value.clinicName.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Clinic name cannot be empty',
        path: ['clinicName'],
      });
    }
    if (value.countryName === 'Other' && !value.otherCountryName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter your country name',
        path: ['otherCountryName'],
      });
    }
    if (!value.privacyPolicyVersionAccepted?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'You must accept the Privacy Notice',
        path: ['privacyPolicyVersionAccepted'],
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

export const updatePreferencesSchema = z
  .object({
    themePreference: z.enum(['light', 'dark']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one preference is required',
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ConfirmPasswordResetInput = z.infer<typeof confirmPasswordResetSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
