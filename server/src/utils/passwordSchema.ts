import {
  isPasswordComplex,
  PASSWORD_POLICY_DESCRIPTION,
  validatePasswordComplexity,
} from '@ayetis/shared';
import { z } from 'zod';

/** Single friendly message — do not use .min(8) or Zod emits "String must contain at least 8 character(s)". */
export const passwordSchema = z.string().superRefine((value, ctx) => {
  if (isPasswordComplex(value)) return;
  const details = validatePasswordComplexity(value);
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: details[0] ?? PASSWORD_POLICY_DESCRIPTION,
  });
});
