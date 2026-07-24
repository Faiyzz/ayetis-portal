import crypto from 'crypto';
import type { PublicUser } from '@ayetis/shared';
import { ROLES } from '@ayetis/shared';
import { env } from '../../config/env';
import { signAccessToken } from '../../middleware/auth';
import { User, type IUser } from '../../models/User';
import { AppError } from '../../utils/AppError';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth.schemas';

function toPublicUser(user: IUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function buildAuthPayload(user: IUser) {
  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    user: toPublicUser(user),
    tokens: {
      accessToken,
      expiresIn: env.jwtExpiresIn,
    },
  };
}

export async function registerDoctor(input: RegisterInput) {
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
  });

  return buildAuthPayload(user);
}

export async function login(input: LoginInput) {
  const user = await User.findOne({ email: input.email }).select('+password');
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  if (!user.isActive) {
    throw new AppError('This account has been deactivated', 403);
  }

  const isMatch = await user.comparePassword(input.password);
  if (!isMatch) {
    throw new AppError('Invalid email or password', 401);
  }

  return buildAuthPayload(user);
}

export async function getMe(userId: string) {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw new AppError('User not found', 404);
  }

  return toPublicUser(user);
}

/**
 * Always returns a generic success message to avoid email enumeration.
 * In development the reset link is logged to the server console.
 */
export async function forgotPassword(input: ForgotPasswordInput) {
  const user = await User.findOne({ email: input.email });

  if (user && user.isActive) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${env.clientUrl}/reset-password?token=${rawToken}`;

    // Email provider will plug in here later. For now, surface the link in development.
    if (env.isDev) {
      console.log(`[password-reset] ${user.email} → ${resetUrl}`);
    } else {
      console.log(`[password-reset] token generated for ${user.email}`);
    }

    return {
      message: 'If an account exists for that email, a reset link has been sent.',
      ...(env.isDev ? { resetUrl } : {}),
    };
  }

  return {
    message: 'If an account exists for that email, a reset link has been sent.',
  };
}

export async function resetPassword(input: ResetPasswordInput) {
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

  return buildAuthPayload(user);
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
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

  return {
    message: 'Password updated successfully',
  };
}
