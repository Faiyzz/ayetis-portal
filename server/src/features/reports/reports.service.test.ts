import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CASE_STATUSES, DOCTOR_DECISIONS, PERMISSIONS, ROLES } from '@ayetis/shared';
import { mockQuery } from '../../test/mocks';

const { Case, Complaint } = vi.hoisted(() => ({
  Case: { find: vi.fn() },
  Complaint: { find: vi.fn() },
}));

vi.mock('../../models/Case', () => ({ Case }));
vi.mock('../../models/Complaint', () => ({ Complaint }));
vi.mock('../../models/User', () => ({ User: { countDocuments: vi.fn(async () => 0) } }));

import { getDoctorPerformanceReport, getPipelineReport } from './reports.service';

const analyst = {
  id: 'a1',
  role: ROLES.ANALYTICS,
  permissions: [PERMISSIONS.REPORT_VIEW],
};

describe('doctor performance report', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires report permission', async () => {
    await expect(
      getDoctorPerformanceReport({ id: 'd', role: ROLES.DOCTOR, permissions: [] }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('computes approval and modification rates against viewed cases', async () => {
    const opened = new Date('2026-01-01T00:00:00.000Z');
    const responded = new Date('2026-01-01T02:00:00.000Z');
    Case.find.mockReturnValue(
      mockQuery([
        {
          doctorId: 'doc-1',
          doctorName: 'Ada',
          doctorDisplayId: 'D-1',
          doctorDecision: DOCTOR_DECISIONS.APPROVE,
          doctorEngagement: { openedAt: opened, lastViewedAt: opened, respondedAt: responded },
        },
        {
          doctorId: 'doc-1',
          doctorName: 'Ada',
          doctorDisplayId: 'D-1',
          doctorDecision: DOCTOR_DECISIONS.REQUEST_MODIFICATION,
          doctorEngagement: { openedAt: opened, lastViewedAt: opened },
        },
        {
          doctorId: 'doc-1',
          doctorName: 'Ada',
          doctorDisplayId: 'D-1',
          doctorDecision: null,
          doctorEngagement: {},
        },
      ]),
    );
    Complaint.find.mockReturnValue(
      mockQuery([{ doctorId: 'doc-1', rating: 4 }]),
    );

    const report = await getDoctorPerformanceReport(analyst);
    expect(report.members[0]?.viewed).toBe(2);
    expect(report.members[0]?.approved).toBe(1);
    expect(report.members[0]?.modifications).toBe(1);
    expect(report.members[0]?.approvalRate).toBe(50);
    expect(report.members[0]?.modificationRate).toBe(50);
    expect(report.totals.approvalRate).toBe(50);
  });

  it('aggregates pipeline counts by status', async () => {
    Case.find.mockReturnValue(
      mockQuery([
        { status: CASE_STATUSES.NEW_CASE, assignmentMode: 'none' },
        { status: CASE_STATUSES.APPROVED, assignmentMode: 'designer', assignedDesignerId: 'd1' },
      ]),
    );
    const report = await getPipelineReport(analyst);
    expect(report.completed).toBeGreaterThanOrEqual(0);
    expect(report.total).toBe(2);
  });
});
