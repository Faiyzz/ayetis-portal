import crypto from 'crypto';
import { AUDIT_ACTIONS, ROLES } from '@ayetis/shared';
import { env } from '../../config/env';
import { signAccessToken } from '../../middleware/auth';
import { User, type IUser } from '../../models/User';
import { AppError } from '../../utils/AppError';
import {
  getRequestAuditContext,
  recordActivity,
  type RequestAuditContext,
} from '../audit/audit.service';
import { toPublicUserAsync } from '../users/users.service';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth.schemas';

function actorFields(user: IUser) {
  return {
    actorId: user.id,
    actorEmail: user.email,
    actorName: `${user.firstName} ${user.lastName}`,
    actorRole: user.role,
  };
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

export async function registerDoctor(input: RegisterInput, ctx: RequestAuditContext = {}) {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  const user = await User.create({
    email: input.email,
    password: input.password,
    firstName: input.firstName,
    lastName: input.lastName,
    role: ROLES.DOCTOR,
    permissionGrants: [],
    permissionDenies: [],
  });

  await recordActivity({
    action: AUDIT_ACTIONS.AUTH_REGISTER,
    summary: `${user.email} registered as doctor`,
    ...actorFields(user),
    targetType: 'user',
    targetId: user.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return buildAuthPayload(user);
}

export async function login(input: LoginInput, ctx: RequestAuditContext = {}) {
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

  if (!user.isActive) {
    await recordActivity({
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
      summary: `Failed login for deactivated account ${user.email}`,
      ...actorFields(user),
      targetType: 'auth',
      targetId: user.id,
      metadata: { reason: 'inactive' },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    throw new AppError('This account has been deactivated', 403);
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
  if (!user || !user.isActive) {
    throw new AppError('User not found', 404);
  }

  return toPublicUserAsync(user);
}

export async function forgotPassword(input: ForgotPasswordInput, ctx: RequestAuditContext = {}) {
  const user = await User.findOne({ email: input.email });

  if (user && user.isActive) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${env.clientUrl}/reset-password?token=${rawToken}`;

    if (env.isDev) {
      console.log(`[password-reset] ${user.email} → ${resetUrl}`);
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
      message: 'If an account exists for that email, a reset link has been sent.',
      ...(env.isDev ? { resetUrl } : {}),
    };
  }

  return {
    message: 'If an account exists for that email, a reset link has been sent.',
  };
}

export async function resetPassword(input: ResetPasswordInput, ctx: RequestAuditContext = {}) {
  const hashedToken = crypto.createHash('sha256').update(input.token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() },
  }).select('+password +passwordResetToken +passwordResetExpires');

  if (!user) {
    throw new AppError('Reset token is invalid or has expired', 400);
  }

  user.password = input.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  await recordActivity({
    action: AUDIT_ACTIONS.AUTH_PASSWORD_RESET,
    summary: `${user.email} reset their password`,
    ...actorFields(user),
    targetType: 'user',
    targetId: user.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return buildAuthPayload(user);
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  ctx: RequestAuditContext = {},
) {
  const user = await User.findById(userId).select('+password');
  if (!user || !user.isActive) {
    throw new AppError('User not found', 404);
  }

  const isMatch = await user.comparePassword(input.currentPassword);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 400);
  }

  if (input.currentPassword === input.newPassword) {
    throw new AppError('New password must be different from the current password', 400);
  }

  user.password = input.newPassword;
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
  };
}

export { getRequestAuditContext };
