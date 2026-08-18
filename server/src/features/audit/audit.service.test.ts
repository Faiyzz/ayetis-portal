import { describe, expect, it, vi } from 'vitest';
import { getRequestAuditContext, recordActivity } from './audit.service';

const { ActivityLog } = vi.hoisted(() => ({
  ActivityLog: {
    create: vi.fn(async (input: { action: string }) => input),
    find: vi.fn(),
  },
}));

vi.mock('../../models/ActivityLog', () => ({ ActivityLog }));

describe('audit helpers', () => {
  it('prefers x-forwarded-for for client IP', () => {
    const ctx = getRequestAuditContext({
      headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      get: () => 'Mozilla/5.0 Chrome/120 Linux',
    } as never);
    expect(ctx.ipAddress).toBe('203.0.113.9');
    expect(ctx.userAgent).toContain('Chrome');
  });

  it('records activity', async () => {
    await recordActivity({
      action: 'auth.login.success',
      summary: 'login',
      targetType: 'auth',
    });
    expect(ActivityLog.create).toHaveBeenCalled();
  });
});
