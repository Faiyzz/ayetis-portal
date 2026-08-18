import { describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { PERMISSIONS, ROLES } from '@ayetis/shared';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { authenticate, loadUser, requireAnyPermission, requirePermission, signAccessToken } from './auth';
import { notFoundHandler, errorHandler } from './errorHandler';
import { validate } from './validate';
import { z } from 'zod';

vi.mock('../features/users/users.service', () => ({
  resolvePermissionsForUserId: vi.fn(async (id: string) => {
    if (id === 'admin-1') return [PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.CASE_VIEW_ALL];
    if (id === 'doctor-1') return [PERMISSIONS.CASE_CREATE, PERMISSIONS.CASE_VIEW_OWN];
    throw new AppError('User not found or inactive', 401);
  }),
}));

vi.mock('../models/User', () => ({
  User: {
    findById: vi.fn(async (id: string) => {
      if (id === 'missing') return null;
      if (id === 'blocked') return { id, accountStatus: 'blocked' };
      return { id, accountStatus: 'active' };
    }),
  },
}));

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('JWT auth middleware', () => {
  it('signs and authenticates a valid token', () => {
    const token = signAccessToken({
      id: 'user-1',
      email: 'a@b.com',
      role: ROLES.DOCTOR,
    });
    const req = { headers: { authorization: `Bearer ${token}` }, user: undefined };
    const next = vi.fn();
    authenticate(req as never, {} as never, next);
    expect(req.user).toMatchObject({ id: 'user-1', email: 'a@b.com', role: ROLES.DOCTOR });
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects missing or invalid tokens', () => {
    const next = vi.fn();
    authenticate({ headers: {} } as never, {} as never, next);
    expect(next.mock.calls[0][0]).toBeInstanceOf(AppError);
    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(401);

    const next2 = vi.fn();
    authenticate(
      { headers: { authorization: 'Bearer not-a-token' } } as never,
      {} as never,
      next2,
    );
    expect((next2.mock.calls[0][0] as AppError).statusCode).toBe(401);
  });

  it('enforces requirePermission and requireAnyPermission', async () => {
    const nextOk = vi.fn();
    await requirePermission(PERMISSIONS.SETTINGS_MANAGE)(
      { user: { id: 'admin-1', email: 'a', role: ROLES.ADMIN } } as never,
      {} as never,
      nextOk,
    );
    expect(nextOk).toHaveBeenCalledWith();

    const nextDenied = vi.fn();
    await requirePermission(PERMISSIONS.SETTINGS_MANAGE)(
      { user: { id: 'doctor-1', email: 'd', role: ROLES.DOCTOR } } as never,
      {} as never,
      nextDenied,
    );
    expect((nextDenied.mock.calls[0][0] as AppError).statusCode).toBe(403);

    const nextAny = vi.fn();
    await requireAnyPermission(PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.CASE_CREATE)(
      { user: { id: 'doctor-1', email: 'd', role: ROLES.DOCTOR } } as never,
      {} as never,
      nextAny,
    );
    expect(nextAny).toHaveBeenCalledWith();

    const nextUnauth = vi.fn();
    await requirePermission(PERMISSIONS.CASE_CREATE)({} as never, {} as never, nextUnauth);
    expect((nextUnauth.mock.calls[0][0] as AppError).statusCode).toBe(401);
  });

  it('loads the user document', async () => {
    const req = { user: { id: 'ok' } } as { user?: { id: string }; userDoc?: unknown };
    const next = vi.fn();
    await loadUser(req as never, {} as never, next);
    expect(req.userDoc).toBeTruthy();
    expect(next).toHaveBeenCalledWith();

    const blocked = { user: { id: 'blocked' } };
    const nextBlocked = vi.fn();
    await loadUser(blocked as never, {} as never, nextBlocked);
    expect((nextBlocked.mock.calls[0][0] as AppError).statusCode).toBe(401);
  });
});

describe('error and validate middleware', () => {
  it('maps AppError and ZodError', () => {
    const res = mockRes();
    errorHandler(new AppError('nope', 409), {} as never, res as never, vi.fn());
    expect(res.statusCode).toBe(409);

    const zodRes = mockRes();
    try {
      z.object({ password: z.string().min(8) }).parse({ password: 'x' });
    } catch (err) {
      errorHandler(err, {} as never, zodRes as never, vi.fn());
    }
    expect(zodRes.statusCode).toBe(400);

    const nf = mockRes();
    notFoundHandler({} as never, nf as never);
    expect(nf.statusCode).toBe(404);

    const boom = mockRes();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    errorHandler(new Error('secret'), {} as never, boom as never, vi.fn());
    spy.mockRestore();
    expect(boom.statusCode).toBe(500);
  });

  it('parses request parts', () => {
    const schema = z.object({ email: z.string().email() });
    const req = { body: { email: 'ada@ayetis.com' } };
    const next = vi.fn();
    validate(schema)(req as never, {} as never, next);
    expect(next).toHaveBeenCalledWith();
    expect(jwt.verify(signAccessToken({ id: '1', email: 'a@b.c', role: 'doctor' }), env.jwtSecret)).toBeTruthy();
  });
});
