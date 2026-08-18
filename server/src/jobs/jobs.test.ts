import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CASE_STATUSES } from '@ayetis/shared';
import { mockQuery } from '../test/mocks';

const { Case, createNotificationsForUsers, getSlaConfig } = vi.hoisted(() => ({
  Case: {
    find: vi.fn(),
    findOne: vi.fn(),
  },
  createNotificationsForUsers: vi.fn(async () => undefined),
  getSlaConfig: vi.fn(async () => ({
    warningPercent: 90,
    hoursBySegment: { individual: 48, company: 48, sub_account: 48 },
    updatedAt: null,
  })),
}));

vi.mock('../models/Case', () => ({ Case }));
vi.mock('../models/User', () => ({
  User: {
    find: vi.fn(() => ({
      select: vi.fn(async () => []),
    })),
  },
}));
vi.mock('../features/audit/audit.service', () => ({ recordActivity: vi.fn() }));
vi.mock('../features/notifications/notifications.service', () => ({
  createNotificationsForUsers,
  createNotification: vi.fn(),
}));
vi.mock('../features/settings/settings.service', () => ({ getSlaConfig }));
vi.mock('../services/email', () => ({
  sendCmsOrFallback: vi.fn(),
  caseEventTemplate: vi.fn(() => ({ subject: 's', html: '' })),
}));

import { runCaseLifecycleSweep, startCaseLifecycleJobs } from './caseLifecycle.job';
import { runSlaMonitorSweep, startSlaMonitorJobs } from './slaMonitor.job';

describe('case lifecycle job', () => {
  beforeEach(() => vi.clearAllMocks());

  it('moves New Case to In Process after 15 minutes', async () => {
    const caseDoc = {
      caseId: 'AYT-1',
      status: CASE_STATUSES.NEW_CASE,
      history: [],
      save: vi.fn(async () => undefined),
    };
    Case.find.mockReturnValue(mockQuery([caseDoc]));
    const moved = await runCaseLifecycleSweep();
    expect(moved).toBe(1);
    expect(caseDoc.status).toBe(CASE_STATUSES.IN_PROCESS);
    expect(caseDoc.save).toHaveBeenCalled();
  });

  it('starts the lifecycle interval once', () => {
    vi.useFakeTimers();
    Case.find.mockReturnValue(mockQuery([]));
    startCaseLifecycleJobs();
    startCaseLifecycleJobs();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });
});

describe('SLA monitor job', () => {
  beforeEach(() => vi.clearAllMocks());

  it('notifies warning and breach once', async () => {
    const start = new Date(Date.now() - 40 * 60 * 60 * 1000);
    const warningCase = {
      caseId: 'AYT-W',
      submittedAt: start,
      slaDeadlineAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      slaWarningNotifiedAt: undefined,
      slaBreachNotifiedAt: undefined,
      doctorId: '507f1f77bcf86cd799439011',
      save: vi.fn(async () => undefined),
    };
    const breached = {
      caseId: 'AYT-B',
      submittedAt: new Date(Date.now() - 50 * 60 * 60 * 1000),
      slaDeadlineAt: new Date(Date.now() - 60 * 60 * 1000),
      slaWarningNotifiedAt: undefined,
      slaBreachNotifiedAt: undefined,
      doctorId: '507f1f77bcf86cd799439012',
      save: vi.fn(async () => undefined),
    };
    Case.find.mockReturnValue(mockQuery([warningCase, breached]));
    const result = await runSlaMonitorSweep();
    expect(result.breaches).toBe(1);
    expect(result.warnings).toBe(1);
    expect(createNotificationsForUsers).toHaveBeenCalledTimes(2);
  });

  it('starts the SLA interval once', () => {
    vi.useFakeTimers();
    Case.find.mockReturnValue(mockQuery([]));
    startSlaMonitorJobs();
    startSlaMonitorJobs();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });
});
