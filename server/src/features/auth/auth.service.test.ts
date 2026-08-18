import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../utils/AppError';
import { mockQuery } from '../../test/mocks';

const {
  recordActivity,
  getSystemMessages,
  getBusinessConfig,
  toPublicUserAsync,
  sendCmsOrFallback,
  User,
  RegistrationRequest,
} = vi.hoisted(() => ({
  recordActivity: vi.fn(async () => undefined),
  getSystemMessages: vi.fn(async () => ({
    registrationConfirmation: 'check email',
    emailVerifiedPending: 'under review',
    accountBlocked: 'blocked',
    accountSuspended: 'suspended',
  })),
  getBusinessConfig: vi.fn(async () => ({
    loginMaxFailedAttempts: 5,
    loginLockoutMinutes: 15,
  })),
  toPublicUserAsync: vi.fn(async (user: { email: string }) => ({
    email: user.email,
    role: 'doctor',
  })),
  sendCmsOrFallback: vi.fn(async () => undefined),
  User: {
    findOne: vi.fn(),
    findById: vi.fn(),
  },
  RegistrationRequest: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../../models/User', () => ({ User }));
vi.mock('../../models/RegistrationRequest', () => ({ RegistrationRequest }));
vi.mock('../../models/SystemConfig', () => ({ getSystemMessages }));
vi.mock('../audit/audit.service', () => ({
  recordActivity,
  getRequestAuditContext: vi.fn(),
}));
vi.mock('../settings/settings.service', () => ({
  getBusinessConfig,
  createCountryRequest: vi.fn(),
}));
vi.mock('../users/users.service', () => ({ toPublicUserAsync }));
vi.mock('../../services/email', () => ({
  sendCmsOrFallback,
  sendTemplatedEmail: vi.fn(),
  emailVerificationTemplate: vi.fn(() => ({ subject: 'v', html: '' })),
  passwordResetTemplate: vi.fn(() => ({ subject: 'p', html: '' })),
  registrationPendingTemplate: vi.fn(() => ({ subject: 'r', html: '' })),
  temporaryPasswordTemplate: vi.fn(() => ({ subject: 't', html: '' })),
}));

import {
  changePassword,
  assertPasswordNotInHistory,
  forgotPassword,
  getMe,
  login,
  logout,
  register,
  updatePreferences,
  verifyEmail,
} from './auth.service';
import { ACCOUNT_STATUSES, ACCOUNT_TYPES, REGISTRATION_STATUSES } from '@ayetis/shared';
import bcrypt from 'bcryptjs';

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects duplicate registration emails', async () => {
    User.findOne.mockResolvedValue({ id: 'u1' });
    await expect(
      register({
        email: 'doc@test.com',
        password: 'ValidPass1!',
        firstName: 'Ada',
        lastName: 'L',
        accountType: ACCOUNT_TYPES.INDIVIDUAL,
        privacyPolicyVersionAccepted: 'v1',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('creates a pending email-verification registration', async () => {
    User.findOne.mockResolvedValue(null);
    RegistrationRequest.findOne.mockResolvedValue(null);
    RegistrationRequest.create.mockResolvedValue({
      id: 'reg-1',
      email: 'doc@test.com',
    });
    const result = await register({
      email: 'doc@test.com',
      password: 'ValidPass1!',
      firstName: 'Ada',
      lastName: 'Lovelace',
      accountType: ACCOUNT_TYPES.INDIVIDUAL,
      privacyPolicyVersionAccepted: 'v1',
    });
    expect(result.registrationId).toBe('reg-1');
    expect(RegistrationRequest.create).toHaveBeenCalled();
    expect(sendCmsOrFallback).toHaveBeenCalled();
  });

  it('blocks login for unknown, locked, mismatched, and blocked accounts', async () => {
    User.findOne.mockReturnValue(mockQuery(null));
    await expect(
      login({ email: 'x@y.com', password: 'p', accountType: ACCOUNT_TYPES.INDIVIDUAL }),
    ).rejects.toMatchObject({ statusCode: 401 });

    User.findOne.mockReturnValue(
      mockQuery({
        id: 'u1',
        email: 'x@y.com',
        firstName: 'A',
        lastName: 'B',
        role: 'doctor',
        lockoutUntil: new Date(Date.now() + 60_000),
        accountType: ACCOUNT_TYPES.INDIVIDUAL,
      }),
    );
    await expect(
      login({ email: 'x@y.com', password: 'p', accountType: ACCOUNT_TYPES.INDIVIDUAL }),
    ).rejects.toMatchObject({ statusCode: 423 });

    User.findOne.mockReturnValue(
      mockQuery({
        id: 'u1',
        email: 'x@y.com',
        firstName: 'A',
        lastName: 'B',
        role: 'doctor',
        lockoutUntil: null,
        accountType: ACCOUNT_TYPES.CORPORATE,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      }),
    );
    await expect(
      login({ email: 'x@y.com', password: 'p', accountType: ACCOUNT_TYPES.INDIVIDUAL }),
    ).rejects.toMatchObject({ statusCode: 403 });

    User.findOne.mockReturnValue(
      mockQuery({
        id: 'u1',
        email: 'x@y.com',
        firstName: 'A',
        lastName: 'B',
        role: 'doctor',
        lockoutUntil: null,
        accountType: ACCOUNT_TYPES.INDIVIDUAL,
        accountStatus: ACCOUNT_STATUSES.BLOCKED,
      }),
    );
    await expect(
      login({ email: 'x@y.com', password: 'p', accountType: ACCOUNT_TYPES.INDIVIDUAL }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('locks after too many failed passwords', async () => {
    const user = {
      id: 'u1',
      email: 'x@y.com',
      firstName: 'A',
      lastName: 'B',
      role: 'doctor',
      lockoutUntil: null,
      accountType: ACCOUNT_TYPES.INDIVIDUAL,
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
      pendingEmailVerification: false,
      failedLoginAttempts: 4,
      comparePassword: vi.fn(async () => false),
      save: vi.fn(async () => undefined),
    };
    User.findOne.mockReturnValue(mockQuery(user));
    await expect(
      login({ email: 'x@y.com', password: 'bad', accountType: ACCOUNT_TYPES.INDIVIDUAL }),
    ).rejects.toMatchObject({ statusCode: 423 });
    expect(user.lockoutUntil).toBeInstanceOf(Date);
  });

  it('returns tokens on successful login', async () => {
    const user = {
      id: '507f1f77bcf86cd799439011',
      email: 'x@y.com',
      firstName: 'A',
      lastName: 'B',
      role: 'doctor',
      lockoutUntil: null,
      accountType: ACCOUNT_TYPES.INDIVIDUAL,
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
      pendingEmailVerification: false,
      failedLoginAttempts: 1,
      comparePassword: vi.fn(async () => true),
      save: vi.fn(async () => undefined),
    };
    User.findOne.mockReturnValue(mockQuery(user));
    const payload = await login({
      email: 'x@y.com',
      password: 'ok',
      accountType: ACCOUNT_TYPES.INDIVIDUAL,
    });
    expect(payload.tokens.accessToken).toBeTruthy();
    expect(user.failedLoginAttempts).toBe(0);
  });

  it('blocks password reuse', async () => {
    const current = await bcrypt.hash('ValidPass1!', 4);
    await expect(assertPasswordNotInHistory('ValidPass1!', current, [])).rejects.toBeInstanceOf(
      AppError,
    );
    const old = await bcrypt.hash('OlderPass1!', 4);
    await expect(assertPasswordNotInHistory('OlderPass1!', 'other', [old])).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(assertPasswordNotInHistory('BrandNew1!', current, [old])).resolves.toBeUndefined();
  });

  it('moves verified registrations to pending approval', async () => {
    const request = {
      id: 'reg-1',
      email: 'doc@test.com',
      firstName: 'Ada',
      lastName: 'L',
      status: REGISTRATION_STATUSES.PENDING_EMAIL_VERIFICATION,
      save: vi.fn(async () => undefined),
    };
    RegistrationRequest.findOne.mockReturnValue(mockQuery(request));
    const result = await verifyEmail({ token: 'token-value' });
    expect(request.status).toBe(REGISTRATION_STATUSES.PENDING_APPROVAL);
    expect(result.status).toBe(REGISTRATION_STATUSES.PENDING_APPROVAL);
  });

  it('blocks login until the account is active', async () => {
    User.findOne.mockReturnValue(
      mockQuery({
        id: 'u1',
        email: 'x@y.com',
        firstName: 'A',
        lastName: 'B',
        role: 'doctor',
        lockoutUntil: null,
        accountType: ACCOUNT_TYPES.INDIVIDUAL,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        pendingEmailVerification: true,
        comparePassword: vi.fn(async () => true),
        save: vi.fn(async () => undefined),
      }),
    );
    await expect(
      login({ email: 'x@y.com', password: 'ok', accountType: ACCOUNT_TYPES.INDIVIDUAL }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('loads the current user, logs out, and updates theme', async () => {
    const user = {
      id: '507f1f77bcf86cd799439011',
      email: 'x@y.com',
      firstName: 'A',
      lastName: 'B',
      role: 'doctor',
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
      themePreference: 'light',
      save: vi.fn(async () => undefined),
    };
    User.findById.mockResolvedValue(user);
    await expect(getMe(user.id)).resolves.toMatchObject({ email: 'x@y.com' });
    await expect(logout(user.id)).resolves.toEqual({ message: 'Logged out' });
    await expect(updatePreferences(user.id, { themePreference: 'dark' })).resolves.toMatchObject({
      email: 'x@y.com',
    });
    expect(user.themePreference).toBe('dark');
  });

  it('sends a forgot-password confirmation when the account can log in', async () => {
    const user = {
      id: '507f1f77bcf86cd799439011',
      email: 'x@y.com',
      firstName: 'A',
      lastName: 'B',
      role: 'doctor',
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
      save: vi.fn(async () => undefined),
    };
    User.findOne.mockResolvedValue(user);
    const result = await forgotPassword({ email: 'x@y.com' });
    expect(result.message).toMatch(/confirmation link/i);
    expect(user.save).toHaveBeenCalled();
  });

  it('changes password when the current password matches', async () => {
    const user = {
      id: '507f1f77bcf86cd799439011',
      email: 'x@y.com',
      firstName: 'A',
      lastName: 'B',
      role: 'doctor',
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
      password: await bcrypt.hash('ValidPass1!', 4),
      passwordHistory: [],
      comparePassword: vi.fn(async () => true),
      save: vi.fn(async () => undefined),
    };
    User.findById.mockReturnValue(mockQuery(user));
    await expect(
      changePassword(user.id, { currentPassword: 'ValidPass1!', newPassword: 'BrandNew1!' }),
    ).resolves.toMatchObject({ message: 'Password updated successfully' });
  });
});
