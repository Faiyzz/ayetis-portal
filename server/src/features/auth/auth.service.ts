import crypto from 'crypto';
import {
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  AUDIT_ACTIONS,
  REGISTRATION_STATUSES,
  canLogin,
} from '@ayetis/shared';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env';
import { signAccessToken } from '../../middleware/auth';
import { getSystemMessages } from '../../models/SystemConfig';
import { RegistrationRequest } from '../../models/RegistrationRequest';
import { User, type IUser } from '../../models/User';
import {
  emailVerificationTemplate,
  passwordResetTemplate,
  registrationPendingTemplate,
  sendTemplatedEmail,
  temporaryPasswordTemplate,
} from '../../services/email';
import { AppError } from '../../utils/AppError';
import {
  generateTemporaryPassword,
  pushPasswordHistory,
} from '../../utils/password';
import {
  getRequestAuditContext,
  recordActivity,
  type RequestAuditContext,
} from '../audit/audit.service';
import { toPublicUserAsync } from '../users/users.service';
import type {
  ChangePasswordInput,
  ConfirmPasswordResetInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  VerifyEmailInput,
} from './auth.schemas';

function actorFields(user: IUser) {
  return {
    actorId: user.id,
    actorEmail: user.email,
    actorName: `${user.firstName} ${user.lastName}`,
    actorRole: user.role,
  };
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function createRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function assertPasswordNotInHistory(
  plainPassword: string,
  currentHash: string | undefined,
  history: string[] | undefined,
): Promise<void> {
  if (currentHash && (await bcrypt.compare(plainPassword, currentHash))) {
    throw new AppError('New password must be different from the current password', 400);
  }

  for (const previous of history ?? []) {
    if (await bcrypt.compare(plainPassword, previous)) {
      throw new AppError(
        'You cannot reuse a recently used password. Please choose a different password.',
        400,
      );
    }
  }
}

async function buildAuthPayload(user: IUser) {
  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    user: await toPublicUserAsync(user),
    tokens: {
      accessToken,
      expiresIn: env.jwtExpiresIn,
    },
  };
}

export async function register(input: RegisterInput, ctx: RequestAuditContext = {}) {
  const email = input.email.toLowerCase();
  const accountType = input.accountType ?? ACCOUNT_TYPES.INDIVIDUAL;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('An account with this email already exists', 409);
  }

  const openRequest = await RegistrationRequest.findOne({
    email,
    status: {
      $in: [
        REGISTRATION_STATUSES.PENDING_EMAIL_VERIFICATION,
        REGISTRATION_STATUSES.PENDING_APPROVAL,
        REGISTRATION_STATUSES.HELD,
      ],
    },
  });
  if (openRequest) {
    throw new AppError(
      'A registration request for this email is already in progress. Please check your email or contact support.',
      409,
    );
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const rawToken = createRawToken();
  const messages = await getSystemMessages();

  const request = await RegistrationRequest.create({
    email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    accountType,
    clinicName:
      accountType === ACCOUNT_TYPES.INDIVIDUAL ? input.clinicName || undefined : undefined,
    companyName:
      accountType === ACCOUNT_TYPES.CORPORATE ? input.companyName || undefined : undefined,
    companyAddress:
      accountType === ACCOUNT_TYPES.CORPORATE && input.companyAddress
        ? {
            street: input.companyAddress.street?.trim() || '',
            city: input.companyAddress.city?.trim() || '',
            state: input.companyAddress.state?.trim() || '',
            country: input.companyAddress.country?.trim() || '',
            postalCode: input.companyAddress.postalCode?.trim() || '',
          }
        : undefined,
    status: REGISTRATION_STATUSES.PENDING_EMAIL_VERIFICATION,
    verificationTokenHash: hashToken(rawToken),
    verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const verifyUrl = `${env.clientUrl}/verify-email?token=${rawToken}`;
  const name = `${input.firstName} ${input.lastName}`.trim();

  try {
    await sendTemplatedEmail(email, emailVerificationTemplate({ name, verifyUrl }));
  } catch (error) {
    console.error('[email] verification failed', error);
    if (env.isDev) {
      console.log(`[verify-email] ${email} → ${verifyUrl}`);
    }
  }

  await recordActivity({
    action: AUDIT_ACTIONS.AUTH_REGISTER,
    summary: `${email} submitted ${ACCOUNT_TYPE_LABELS[accountType]} registration`,
    actorEmail: email,
    actorName: name,
    targetType: 'registration',
    targetId: request.id,
    metadata: { accountType },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return {
    message: messages.registrationConfirmation,
    registrationId: request.id,
    ...(env.isDev ? { verifyUrl } : {}),
  };
}

export async function verifyEmail(input: VerifyEmailInput, ctx: RequestAuditContext = {}) {
  const hashedToken = hashToken(input.token);
  const request = await RegistrationRequest.findOne({
    verificationTokenHash: hashedToken,
    verificationExpires: { $gt: new Date() },
  }).select('+verificationTokenHash +verificationExpires +passwordHash');

  if (!request) {
    throw new AppError('Verification link is invalid or has expired', 400);
  }

  if (request.status !== REGISTRATION_STATUSES.PENDING_EMAIL_VERIFICATION) {
    throw new AppError('This registration has already been verified', 400);
  }

  const messages = await getSystemMessages();
  request.status = REGISTRATION_STATUSES.PENDING_APPROVAL;
  request.emailVerifiedAt = new Date();
  request.verificationTokenHash = undefined;
  request.verificationExpires = undefined;
  await request.save();

  const name = `${request.firstName} ${request.lastName}`.trim();

  try {
    await sendTemplatedEmail(
      request.email,
      registrationPendingTemplate({
        name,
        message: messages.emailVerifiedPending,
      }),
    );
  } catch (error) {
    console.error('[email] pending-review failed', error);
  }

  await recordActivity({
    action: AUDIT_ACTIONS.AUTH_EMAIL_VERIFY,
    summary: `${request.email} verified registration email`,
    actorEmail: request.email,
    actorName: name,
    targetType: 'registration',
    targetId: request.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return {
    message: messages.emailVerifiedPending,
    status: request.status,
  };
}

export async function login(input: LoginInput, ctx: RequestAuditContext = {}) {
  const messages = await getSystemMessages();
  const user = await User.findOne({ email: input.email }).select('+password');
  if (!user) {
    await recordActivity({
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
      summary: `Failed login attempt for ${input.email}`,
      actorEmail: input.email,
      targetType: 'auth',
      metadata: { reason: 'user_not_found' },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    throw new AppError('Invalid email or password', 401);
  }

  if (user.accountType !== input.accountType) {
    await recordActivity({
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
      summary: `Failed login for ${user.email}: account type mismatch`,
      ...actorFields(user),
      targetType: 'auth',
      targetId: user.id,
      metadata: {
        reason: 'account_type_mismatch',
        expected: user.accountType,
        provided: input.accountType,
      },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    throw new AppError(
      `This account is registered as ${ACCOUNT_TYPE_LABELS[user.accountType]}. Please use the correct login option.`,
      403,
    );
  }

  if (user.accountStatus === ACCOUNT_STATUSES.BLOCKED) {
    await recordActivity({
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
      summary: `Failed login for blocked account ${user.email}`,
      ...actorFields(user),
      targetType: 'auth',
      targetId: user.id,
      metadata: { reason: 'blocked' },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    throw new AppError(messages.accountBlocked, 403);
  }

  if (user.pendingEmailVerification) {
    await recordActivity({
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
      summary: `Failed login for ${user.email}: email not verified`,
      ...actorFields(user),
      targetType: 'auth',
      targetId: user.id,
      metadata: { reason: 'pending_email_verification' },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    throw new AppError('Please verify your email before signing in.', 403);
  }

  if (!canLogin(user.accountStatus)) {
    await recordActivity({
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
      summary: `Failed login for ${user.email}: status ${user.accountStatus}`,
      ...actorFields(user),
      targetType: 'auth',
      targetId: user.id,
      metadata: { reason: 'status', status: user.accountStatus },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    throw new AppError('This account cannot sign in', 403);
  }

  const isMatch = await user.comparePassword(input.password);
  if (!isMatch) {
    await recordActivity({
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
      summary: `Failed login attempt for ${user.email}`,
      ...actorFields(user),
      targetType: 'auth',
      targetId: user.id,
      metadata: { reason: 'bad_password' },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    throw new AppError('Invalid email or password', 401);
  }

  await recordActivity({
    action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
    summary: `${user.email} logged in`,
    ...actorFields(user),
    targetType: 'auth',
    targetId: user.id,
    metadata: { accountStatus: user.accountStatus },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return buildAuthPayload(user);
}

export async function logout(userId: string, ctx: RequestAuditContext = {}) {
  const user = await User.findById(userId);
  if (!user) {
    return { message: 'Logged out' };
  }

  await recordActivity({
    action: AUDIT_ACTIONS.AUTH_LOGOUT,
    summary: `${user.email} logged out`,
    ...actorFields(user),
    targetType: 'auth',
    targetId: user.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return { message: 'Logged out' };
}

export async function getMe(userId: string) {
  const user = await User.findById(userId);
  if (!user || user.accountStatus === ACCOUNT_STATUSES.BLOCKED) {
    throw new AppError('User not found', 404);
  }

  return toPublicUserAsync(user);
}

export async function forgotPassword(input: ForgotPasswordInput, ctx: RequestAuditContext = {}) {
  const generic = {
    message:
      'If an account exists for that email, a confirmation link has been sent. After confirming, you will receive a temporary password.',
  };

  const user = await User.findOne({ email: input.email });
  if (!user || !canLogin(user.accountStatus)) {
    return generic;
  }

  const rawToken = createRawToken();
  user.passwordResetToken = hashToken(rawToken);
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  const confirmUrl = `${env.clientUrl}/confirm-password-reset?token=${rawToken}`;

  try {
    await sendTemplatedEmail(
      user.email,
      passwordResetTemplate({
        name: `${user.firstName} ${user.lastName}`.trim(),
        resetUrl: confirmUrl,
      }),
    );
  } catch (error) {
    console.error('[email] password-reset-confirm failed', error);
    if (env.isDev) {
      console.log(`[confirm-password-reset] ${user.email} → ${confirmUrl}`);
    }
  }

  await recordActivity({
    action: AUDIT_ACTIONS.AUTH_PASSWORD_FORGOT,
    summary: `Password reset requested for ${user.email}`,
    ...actorFields(user),
    targetType: 'user',
    targetId: user.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return {
    ...generic,
    ...(env.isDev ? { confirmUrl } : {}),
  };
}

export async function confirmPasswordReset(
  input: ConfirmPasswordResetInput,
  ctx: RequestAuditContext = {},
) {
  const hashedToken = hashToken(input.token);
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() },
  }).select('+password +passwordResetToken +passwordResetExpires +passwordHistory');

  if (!user) {
    throw new AppError('Confirmation link is invalid or has expired', 400);
  }

  if (!canLogin(user.accountStatus)) {
    throw new AppError('This account cannot reset its password', 403);
  }

  const temporaryPassword = generateTemporaryPassword();
  pushPasswordHistory(user, user.password);
  user.password = temporaryPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.mustChangePassword = true;
  await user.save();

  const loginUrl = `${env.clientUrl}/login`;

  try {
    await sendTemplatedEmail(
      user.email,
      temporaryPasswordTemplate({
        name: `${user.firstName} ${user.lastName}`.trim(),
        temporaryPassword,
        loginUrl,
      }),
    );
  } catch (error) {
    console.error('[email] temporary-password failed', error);
    if (env.isDev) {
      console.log(`[temporary-password] ${user.email} → ${temporaryPassword}`);
    }
  }

  await recordActivity({
    action: AUDIT_ACTIONS.AUTH_PASSWORD_CONFIRM_RESET,
    summary: `Temporary password issued for ${user.email}`,
    ...actorFields(user),
    targetType: 'user',
    targetId: user.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return {
    message:
      'Your identity was confirmed. A temporary password has been sent to your email. Sign in and you will be required to set a new password.',
    ...(env.isDev ? { temporaryPassword } : {}),
  };
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  ctx: RequestAuditContext = {},
) {
  const user = await User.findById(userId).select('+password +passwordHistory');
  if (!user || user.accountStatus === ACCOUNT_STATUSES.BLOCKED) {
    throw new AppError('User not found', 404);
  }

  const isMatch = await user.comparePassword(input.currentPassword);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 400);
  }

  await assertPasswordNotInHistory(input.newPassword, user.password, user.passwordHistory);
  pushPasswordHistory(user, user.password);
  user.password = input.newPassword;
  user.mustChangePassword = false;
  await user.save();

  await recordActivity({
    action: AUDIT_ACTIONS.AUTH_PASSWORD_CHANGE,
    summary: `${user.email} changed their password`,
    ...actorFields(user),
    targetType: 'user',
    targetId: user.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return {
    message: 'Password updated successfully',
    user: await toPublicUserAsync(user),
  };
}

export { getRequestAuditContext };
