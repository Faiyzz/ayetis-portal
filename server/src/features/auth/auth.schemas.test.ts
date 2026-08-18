import { describe, expect, it } from 'vitest';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  updatePreferencesSchema,
} from './auth.schemas';
import { ACCOUNT_TYPES } from '@ayetis/shared';

const validPassword = 'ValidPass1!';

describe('auth schemas', () => {
  it('requires privacy acceptance and corporate company fields', () => {
    const base = {
      email: 'doc@test.com',
      password: validPassword,
      firstName: 'Ada',
      lastName: 'Lovelace',
      accountType: ACCOUNT_TYPES.INDIVIDUAL,
    };
    expect(registerSchema.safeParse(base).success).toBe(false);
    expect(
      registerSchema.safeParse({ ...base, privacyPolicyVersionAccepted: 'v1' }).success,
    ).toBe(true);

    const corp = registerSchema.safeParse({
      ...base,
      accountType: ACCOUNT_TYPES.CORPORATE,
      privacyPolicyVersionAccepted: 'v1',
    });
    expect(corp.success).toBe(false);

    expect(
      registerSchema.safeParse({
        ...base,
        accountType: ACCOUNT_TYPES.CORPORATE,
        companyName: 'Ayetis Dental',
        companyAddress: { street: '1 Main', city: 'NYC', country: 'United States' },
        privacyPolicyVersionAccepted: 'v1',
      }).success,
    ).toBe(true);
  });

  it('validates login, password reset, and preferences', () => {
    expect(
      loginSchema.safeParse({
        email: 'ada@test.com',
        password: 'x',
        accountType: ACCOUNT_TYPES.INDIVIDUAL,
      }).success,
    ).toBe(true);
    expect(loginSchema.safeParse({ email: 'bad', password: 'x' }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: 'ada@test.com' }).success).toBe(true);
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'old',
        newPassword: validPassword,
      }).success,
    ).toBe(true);
    expect(changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'weak' }).success).toBe(
      false,
    );
    expect(updatePreferencesSchema.safeParse({}).success).toBe(false);
    expect(updatePreferencesSchema.safeParse({ themePreference: 'dark' }).success).toBe(true);
  });
});
