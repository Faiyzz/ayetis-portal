/**
 * Password policy — shared between client validation hints and server Zod schemas.
 * Expiry days are configured via server env (PASSWORD_EXPIRY_DAYS); shared only
 * exposes the complexity rules and helper checks.
 */

export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: true,
  /** Default expiry window in days when server env is unset. */
  defaultExpiryDays: 90,
} as const;

export const PASSWORD_POLICY_DESCRIPTION =
  'At least 8 characters with uppercase, lowercase, a number, and a special character.';

export function validatePasswordComplexity(password: string): string[] {
  const errors: string[] = [];
  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters`);
  }
  if (password.length > PASSWORD_POLICY.maxLength) {
    errors.push(`Password must be at most ${PASSWORD_POLICY.maxLength} characters`);
  }
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must include an uppercase letter');
  }
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must include a lowercase letter');
  }
  if (PASSWORD_POLICY.requireDigit && !/[0-9]/.test(password)) {
    errors.push('Password must include a number');
  }
  if (PASSWORD_POLICY.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must include a special character');
  }
  return errors;
}

export function isPasswordComplex(password: string): boolean {
  return validatePasswordComplexity(password).length === 0;
}

export function passwordExpiresAt(
  passwordChangedAt: Date | string | null | undefined,
  expiryDays: number,
): Date | null {
  if (!expiryDays || expiryDays <= 0) return null;
  const changed = passwordChangedAt ? new Date(passwordChangedAt) : null;
  if (!changed || Number.isNaN(changed.getTime())) return null;
  return new Date(changed.getTime() + expiryDays * 24 * 60 * 60 * 1000);
}

export function isPasswordExpired(
  passwordChangedAt: Date | string | null | undefined,
  expiryDays: number,
  now = new Date(),
): boolean {
  const expires = passwordExpiresAt(passwordChangedAt, expiryDays);
  if (!expires) return false;
  return expires.getTime() <= now.getTime();
}
