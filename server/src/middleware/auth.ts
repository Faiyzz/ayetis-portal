import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Permission, Role } from '@ayetis/shared';
import { hasPermission } from '@ayetis/shared';
import { env } from '../config/env';
import { User, type IUser } from '../models/User';
import { AppError } from '../utils/AppError';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  userDoc?: IUser;
}

interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export function signAccessToken(user: { id: string; email: string; role: Role }): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    } satisfies JwtPayload,
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] },
  );
}

export function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new AppError('Authentication required', 401));
    return;
  }

  const token = header.slice('Bearer '.length);

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}

export function requirePermission(...permissions: Permission[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401));
      return;
    }

    const allowed = permissions.every((permission) =>
      hasPermission(req.user!.role, permission),
    );

    if (!allowed) {
      next(new AppError('You do not have permission to perform this action', 403));
      return;
    }

    next();
  };
}

export async function loadUser(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next(new AppError('Authentication required', 401));
      return;
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.isActive) {
      next(new AppError('User not found or inactive', 401));
      return;
    }

    req.userDoc = user;
    next();
  } catch (error) {
    next(error);
  }
}
