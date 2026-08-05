import {
  ASSIGNMENT_MODES,
  CASE_STATUSES,
  CASE_STATUS_LABELS,
  CONSULTANT_INDICATOR_LABELS,
  CONSULTANT_INDICATORS,
  PERMISSIONS,
  QC_ERROR_CODE_LABELS,
  ALL_QC_ERROR_CODES,
  ROLES,
  labelForMonthKey,
  monthRangeUtc,
  permissionsInclude,
  quarterRangeUtc,
  recentMonthOptions,
  type AnalyticsDashboardDto,
  type CasePipelineReportDto,
  type ConsultantDeptReportDto,
  type ConsultantIndicator,
  type DepartmentComparisonReportDto,
  type DesignerDeptReportDto,
  type QcDeptReportDto,
  type QcErrorCode,
  type ReportPeriodDto,
  type SupervisorTeamReportDto,
} from '@ayetis/shared';
import { AppError } from '../../utils/AppError';
import { Case } from '../../models/Case';
import { User } from '../../models/User';

interface Actor {
  id: string;
  permissions: string[];
}

function assertCanReport(actor: Actor) {
  if (
    !permissionsInclude(actor.permissions as never, PERMISSIONS.REPORT_VIEW) &&
    !permissionsInclude(actor.permissions as never, PERMISSIONS.REPORT_VIEW_ALL) &&
    !permissionsInclude(actor.permissions as never, PERMISSIONS.CASE_VIEW_ALL)
  ) {
    throw new AppError('You do not have permission to view reports', 403);
  }
}

function resolvePeriod(query: { month?: string; view?: 'month' | 'quarter' }): ReportPeriodDto & {
  start: Date;
  end: Date;
} {
  const availableMonths = recentMonthOptions(6);
  const periodKey =
    query.month && availableMonths.some((m) => m.key === query.month)
      ? query.month
      : availableMonths[availableMonths.length - 1]?.key ||
        `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
  const view = query.view === 'quarter' ? 'quarter' : 'month';
  if (view === 'quarter') {
    const range = quarterRangeUtc(periodKey);
    return {
      view,
      periodKey,
      periodLabel: range.label,
      availableMonths,
      start: range.start,
      end: range.end,
    };
  }
  const range = monthRangeUtc(periodKey);
  return {
    view,
    periodKey,
    periodLabel: labelForMonthKey(periodKey),
    availableMonths,
    start: range.start,
    end: range.end,
  };
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
}

function rate(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Number(((part / total) * 100).toFixed(1));
}

export async function getPipelineReport(
  actor: Actor,
  query: { month?: string; view?: 'month' | 'quarter' } = {},
): Promise<CasePipelineReportDto> {
  assertCanReport(actor);
  const period = resolvePeriod(query);

  const cases = await Case.find({
    isDeleted: false,
    createdAt: { $gte: period.start, $lt: period.end },
  }).select('status assignmentMode assignedDesignerId validatedAt');

  const openCases = await Case.find({
    isDeleted: false,
    status: { $nin: [CASE_STATUSES.APPROVED, CASE_STATUSES.CANCELLED] },
  }).select('status assignmentMode assignedDesignerId');

  const byStatusMap = new Map<string, number>();
  for (const c of cases) {
    byStatusMap.set(c.status, (byStatusMap.get(c.status) ?? 0) + 1);
  }

  let unassigned = 0;
  let assigned = 0;
  let inProduction = 0;
  let qcPending = 0;
  let qcRunning = 0;
  let qcRejected = 0;
  let completed = 0;
  let cancelled = 0;
  let delivered = 0;

  for (const c of openCases) {
    if (c.status === CASE_STATUSES.WAITING_FOR_APPROVAL || c.status === CASE_STATUSES.APPROVED) {
      delivered += 1;
      continue;
    }
    if (c.status !== CASE_STATUSES.IN_PROCESS && c.status !== CASE_STATUSES.NEW_CASE) {
      continue;
    }
    if (c.status === CASE_STATUSES.IN_PROCESS && c.submittedToQcAt) {
      if ((c.qcRejectionCount ?? 0) > 0 && !c.submittedToQcAt) {
        qcRejected += 1;
      } else {
        qcPending += 1;
        qcRunning += 1;
      }
      if (c.assignedDesignerId || c.assignmentMode === ASSIGNMENT_MODES.AUTO_QUEUE) assigned += 1;
      else unassigned += 1;
      continue;
    }
    if (c.status === CASE_STATUSES.IN_PROCESS && c.productionStartedAt) {
      inProduction += 1;
      assigned += 1;
      continue;
    }
    if (!c.assignedDesignerId && c.assignmentMode !== ASSIGNMENT_MODES.AUTO_QUEUE) unassigned += 1;
    else assigned += 1;
  }

  for (const c of cases) {
    if (c.status === CASE_STATUSES.APPROVED) completed += 1;
    if (c.status === CASE_STATUSES.CANCELLED) cancelled += 1;
  }

  return {
    view: period.view,
    periodKey: period.periodKey,
    periodLabel: period.periodLabel,
    availableMonths: period.availableMonths,
    total: cases.length,
    newlySubmitted: cases.filter((c) => c.status !== CASE_STATUSES.CANCELLED).length,
    unassigned,
    assigned,
    inProduction,
    qcPending,
    qcRunning,
    qcRejected,
    completed,
    cancelled,
    delivered,
    byStatus: [...byStatusMap.entries()]
      .map(([status, count]) => ({
        status,
        label: CASE_STATUS_LABELS[status as keyof typeof CASE_STATUS_LABELS] ?? status,
        count,
      }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function getDesignerDeptReport(
  actor: Actor,
  query: { month?: string; view?: 'month' | 'quarter' } = {},
): Promise<DesignerDeptReportDto> {
  assertCanReport(actor);
  const period = resolvePeriod(query);
  const designers = await User.find({ role: ROLES.DESIGNER, isActive: { $ne: false } });
  const cases = await Case.find({
    isDeleted: false,
    assignedDesignerId: { $exists: true, $ne: null },
    $or: [
      { createdAt: { $gte: period.start, $lt: period.end } },
      { updatedAt: { $gte: period.start, $lt: period.end } },
    ],
  }).select(
    'assignedDesignerId assignedDesignerName status productionStartedAt doctorDecisionAt history qcRejectionCount createdAt updatedAt',
  );

  const members = designers.map((designer) => {
    const mine = cases.filter((c) => String(c.assignedDesignerId) === designer.id);
    const completed = mine.filter(
      (c) =>
        c.status === CASE_STATUSES.APPROVED ||
        c.status === CASE_STATUSES.WAITING_FOR_APPROVAL,
    );
    const hours = completed
      .map((c) => {
        const start = c.productionStartedAt || c.createdAt;
        const end = c.doctorDecisionAt || c.updatedAt;
        if (!start || !end) return null;
        return (end.getTime() - start.getTime()) / 36e5;
      })
      .filter((v): v is number => v != null && v >= 0);
    return {
      userId: designer.id,
      name: `${designer.firstName} ${designer.lastName}`.trim(),
      email: designer.email,
      assigned: mine.length,
      completed: completed.length,
      revisions: mine.reduce((sum, c) => sum + (c.qcRejectionCount ?? 0), 0),
      averageCompletionHours: avg(hours),
    };
  });

  const totalsAssigned = members.reduce((s, m) => s + m.assigned, 0);
  const totalsCompleted = members.reduce((s, m) => s + m.completed, 0);
  const totalsRevisions = members.reduce((s, m) => s + m.revisions, 0);
  const completionHours = members
    .map((m) => m.averageCompletionHours)
    .filter((v): v is number => v != null);

  return {
    view: period.view,
    periodKey: period.periodKey,
    periodLabel: period.periodLabel,
    availableMonths: period.availableMonths,
    members: members.sort((a, b) => b.completed - a.completed),
    totals: {
      assigned: totalsAssigned,
      completed: totalsCompleted,
      revisions: totalsRevisions,
      averageCompletionHours: avg(completionHours),
    },
  };
}

export async function getQcDeptReport(
  actor: Actor,
  query: { month?: string; view?: 'month' | 'quarter' } = {},
): Promise<QcDeptReportDto> {
  assertCanReport(actor);
  const period = resolvePeriod(query);
  const reviewers = await User.find({ role: ROLES.QC, isActive: { $ne: false } });
  const cases = await Case.find({
    isDeleted: false,
    'qcReviews.0': { $exists: true },
  }).select('qcReviews');

  const errorCounts = new Map<QcErrorCode, number>();
  const memberStats = new Map<string, { name: string; reviewed: number; rejected: number; approved: number }>();

  for (const reviewer of reviewers) {
    memberStats.set(reviewer.id, {
      name: `${reviewer.firstName} ${reviewer.lastName}`.trim(),
      reviewed: 0,
      rejected: 0,
      approved: 0,
    });
  }

  let reviewed = 0;
  let rejected = 0;
  let approved = 0;

  for (const caseDoc of cases) {
    for (const review of caseDoc.qcReviews ?? []) {
      if (review.createdAt < period.start || review.createdAt >= period.end) continue;
      reviewed += 1;
      const reviewerId = String(review.reviewerId);
      const mutable = memberStats.get(reviewerId) ?? {
        name: review.reviewerName || 'Unknown',
        reviewed: 0,
        rejected: 0,
        approved: 0,
      };
      mutable.reviewed += 1;
      if (review.outcome === 'rejected') {
        rejected += 1;
        mutable.rejected += 1;
        if (review.errorCode) {
          errorCounts.set(review.errorCode, (errorCounts.get(review.errorCode) ?? 0) + 1);
        }
      }
      if (review.outcome === 'approved') {
        approved += 1;
        mutable.approved += 1;
      }
      memberStats.set(reviewerId, mutable);
    }
  }

  return {
    view: period.view,
    periodKey: period.periodKey,
    periodLabel: period.periodLabel,
    availableMonths: period.availableMonths,
    reviewed,
    rejected,
    approved,
    errorTrends: ALL_QC_ERROR_CODES.map((code) => ({
      code,
      label: QC_ERROR_CODE_LABELS[code],
      count: errorCounts.get(code) ?? 0,
    }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count),
    members: [...memberStats.entries()]
      .map(([userId, row]) => ({ userId, ...row }))
      .sort((a, b) => b.reviewed - a.reviewed),
  };
}

export async function getConsultantDeptReport(
  actor: Actor,
  query: { month?: string; view?: 'month' | 'quarter' } = {},
): Promise<ConsultantDeptReportDto> {
  assertCanReport(actor);
  const period = resolvePeriod(query);
  const consultants = await User.find({ role: ROLES.ORTHODONTIST, isActive: { $ne: false } });
  const cases = await Case.find({
    isDeleted: false,
    $or: [{ 'clinicalRemarks.0': { $exists: true } }, { 'qcReviews.0': { $exists: true } }],
  }).select('clinicalRemarks qcReviews escalatedForOversight');

  const colorCounts = new Map<ConsultantIndicator, number>();
  const errorCounts = new Map<QcErrorCode, number>();
  const memberStats = new Map<string, { name: string; reviewed: number; remarks: number }>();

  for (const user of consultants) {
    memberStats.set(user.id, {
      name: `${user.firstName} ${user.lastName}`.trim(),
      reviewed: 0,
      remarks: 0,
    });
  }

  let reviewed = 0;
  let rejected = 0;
  let remarksCount = 0;

  for (const caseDoc of cases) {
    for (const remark of caseDoc.clinicalRemarks ?? []) {
      if (remark.createdAt < period.start || remark.createdAt >= period.end) continue;
      remarksCount += 1;
      reviewed += 1;
      colorCounts.set(remark.indicator, (colorCounts.get(remark.indicator) ?? 0) + 1);
      const id = String(remark.authorId);
      const row = memberStats.get(id) ?? {
        name: remark.authorName || 'Unknown',
        reviewed: 0,
        remarks: 0,
      };
      row.reviewed += 1;
      row.remarks += 1;
      memberStats.set(id, row);
    }
    for (const review of caseDoc.qcReviews ?? []) {
      if (review.createdAt < period.start || review.createdAt >= period.end) continue;
      // Count QC rejections on escalated cases as consultant-context rejected trend.
      if (caseDoc.escalatedForOversight && review.outcome === 'rejected') {
        rejected += 1;
        if (review.errorCode) {
          errorCounts.set(review.errorCode, (errorCounts.get(review.errorCode) ?? 0) + 1);
        }
      }
    }
  }

  return {
    view: period.view,
    periodKey: period.periodKey,
    periodLabel: period.periodLabel,
    availableMonths: period.availableMonths,
    reviewed,
    rejected,
    remarksCount,
    errorTrends: ALL_QC_ERROR_CODES.map((code) => ({
      code,
      label: QC_ERROR_CODE_LABELS[code],
      count: errorCounts.get(code) ?? 0,
    }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count),
    remarksByColor: Object.values(CONSULTANT_INDICATORS).map((indicator) => ({
      indicator,
      label: CONSULTANT_INDICATOR_LABELS[indicator],
      count: colorCounts.get(indicator) ?? 0,
    })),
    members: [...memberStats.entries()]
      .map(([userId, row]) => ({ userId, ...row }))
      .sort((a, b) => b.reviewed - a.reviewed),
  };
}

export async function getSupervisorTeamReport(
  actor: Actor,
  query: { month?: string; view?: 'month' | 'quarter' } = {},
): Promise<SupervisorTeamReportDto> {
  assertCanReport(actor);
  const period = resolvePeriod(query);
  const supervisors = await User.find({ role: ROLES.SUPERVISOR, isActive: { $ne: false } });
  const [designer, qc, consultant] = await Promise.all([
    getDesignerDeptReport(actor, query),
    getQcDeptReport(actor, query),
    getConsultantDeptReport(actor, query),
  ]);

  // Without explicit supervisor→member mapping, present one combined team view per supervisor.
  const combinedMembers = [
    ...designer.members.map((m) => ({
      userId: m.userId,
      name: m.name,
      role: ROLES.DESIGNER,
      casesHandled: m.assigned,
    })),
    ...qc.members.map((m) => ({
      userId: m.userId,
      name: m.name,
      role: ROLES.QC,
      casesHandled: m.reviewed,
    })),
    ...consultant.members.map((m) => ({
      userId: m.userId,
      name: m.name,
      role: ROLES.ORTHODONTIST,
      casesHandled: m.reviewed,
    })),
  ];

  const teams =
    supervisors.length === 0
      ? [
          {
            supervisorId: 'unassigned',
            supervisorName: 'All teams',
            designerCompleted: designer.totals.completed,
            qcReviewed: qc.reviewed,
            qcRejected: qc.rejected,
            consultantReviewed: consultant.reviewed,
            members: combinedMembers,
          },
        ]
      : supervisors.map((supervisor) => ({
          supervisorId: supervisor.id,
          supervisorName: `${supervisor.firstName} ${supervisor.lastName}`.trim(),
          designerCompleted: designer.totals.completed,
          qcReviewed: qc.reviewed,
          qcRejected: qc.rejected,
          consultantReviewed: consultant.reviewed,
          members: combinedMembers,
        }));

  return {
    view: period.view,
    periodKey: period.periodKey,
    periodLabel: period.periodLabel,
    availableMonths: period.availableMonths,
    teams,
  };
}

export async function getDepartmentComparison(
  actor: Actor,
  query: { month?: string; view?: 'month' | 'quarter' } = {},
): Promise<DepartmentComparisonReportDto> {
  assertCanReport(actor);
  const period = resolvePeriod(query);
  const [designer, qc, consultant, supervisors] = await Promise.all([
    getDesignerDeptReport(actor, query),
    getQcDeptReport(actor, query),
    getConsultantDeptReport(actor, query),
    User.countDocuments({ role: ROLES.SUPERVISOR, isActive: { $ne: false } }),
  ]);

  return {
    view: period.view,
    periodKey: period.periodKey,
    periodLabel: period.periodLabel,
    availableMonths: period.availableMonths,
    rows: [
      {
        department: 'designers',
        label: 'Designers',
        headcount: designer.members.length,
        volume: designer.totals.assigned,
        completedOrReviewed: designer.totals.completed,
        rejectionOrRevisionRate: rate(designer.totals.revisions, designer.totals.assigned),
      },
      {
        department: 'qc',
        label: 'QC',
        headcount: qc.members.length,
        volume: qc.reviewed,
        completedOrReviewed: qc.approved,
        rejectionOrRevisionRate: rate(qc.rejected, qc.reviewed),
      },
      {
        department: 'consultants',
        label: 'Consultants',
        headcount: consultant.members.length,
        volume: consultant.reviewed,
        completedOrReviewed: consultant.remarksCount,
        rejectionOrRevisionRate: rate(consultant.rejected, consultant.reviewed),
      },
      {
        department: 'supervisors',
        label: 'Supervisors',
        headcount: supervisors,
        volume:
          designer.totals.assigned + qc.reviewed + consultant.reviewed,
        completedOrReviewed:
          designer.totals.completed + qc.approved + consultant.remarksCount,
        rejectionOrRevisionRate: rate(
          designer.totals.revisions + qc.rejected + consultant.rejected,
          designer.totals.assigned + qc.reviewed + consultant.reviewed,
        ),
      },
    ],
  };
}

export async function getAnalyticsDashboard(
  actor: Actor,
  query: { month?: string; view?: 'month' | 'quarter' } = {},
): Promise<AnalyticsDashboardDto> {
  assertCanReport(actor);
  const [pipeline, designer, qc, consultant, supervisor, comparison] = await Promise.all([
    getPipelineReport(actor, query),
    getDesignerDeptReport(actor, query),
    getQcDeptReport(actor, query),
    getConsultantDeptReport(actor, query),
    getSupervisorTeamReport(actor, query),
    getDepartmentComparison(actor, query),
  ]);

  return {
    period: {
      view: pipeline.view,
      periodKey: pipeline.periodKey,
      periodLabel: pipeline.periodLabel,
      availableMonths: pipeline.availableMonths,
    },
    pipeline,
    designer,
    qc,
    consultant,
    supervisor,
    comparison,
  };
}

export function toCsv(rows: Array<Record<string, string | number | null | undefined>>): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number | null | undefined) => {
    const text = value == null ? '' : String(value);
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join(
    '\n',
  );
}

export async function exportReportCsv(
  actor: Actor,
  report: string,
  query: { month?: string; view?: 'month' | 'quarter' } = {},
): Promise<{ filename: string; csv: string }> {
  assertCanReport(actor);
  const period = resolvePeriod(query);
  const suffix = `${period.periodKey}-${period.view}`;

  if (report === 'pipeline') {
    const data = await getPipelineReport(actor, query);
    return {
      filename: `pipeline-${suffix}.csv`,
      csv: toCsv([
        {
          total: data.total,
          new: data.newlySubmitted,
          unassigned: data.unassigned,
          assigned: data.assigned,
          inProduction: data.inProduction,
          qcPending: data.qcPending,
          qcRejected: data.qcRejected,
          completed: data.completed,
          delivered: data.delivered,
        },
        ...data.byStatus.map((row) => ({
          status: row.label,
          count: row.count,
        })),
      ]),
    };
  }

  if (report === 'designer') {
    const data = await getDesignerDeptReport(actor, query);
    return {
      filename: `designer-${suffix}.csv`,
      csv: toCsv(
        data.members.map((m) => ({
          name: m.name,
          email: m.email,
          assigned: m.assigned,
          completed: m.completed,
          revisions: m.revisions,
          avgHours: m.averageCompletionHours,
        })),
      ),
    };
  }

  if (report === 'qc') {
    const data = await getQcDeptReport(actor, query);
    return {
      filename: `qc-${suffix}.csv`,
      csv: toCsv([
        ...data.members.map((m) => ({
          name: m.name,
          reviewed: m.reviewed,
          approved: m.approved,
          rejected: m.rejected,
        })),
        ...data.errorTrends.map((e) => ({
          error: e.label,
          count: e.count,
        })),
      ]),
    };
  }

  if (report === 'consultant') {
    const data = await getConsultantDeptReport(actor, query);
    return {
      filename: `consultant-${suffix}.csv`,
      csv: toCsv([
        ...data.members.map((m) => ({
          name: m.name,
          reviewed: m.reviewed,
          remarks: m.remarks,
        })),
        ...data.remarksByColor.map((r) => ({
          indicator: r.label,
          count: r.count,
        })),
      ]),
    };
  }

  if (report === 'comparison') {
    const data = await getDepartmentComparison(actor, query);
    return {
      filename: `comparison-${suffix}.csv`,
      csv: toCsv(
        data.rows.map((r) => ({
          department: r.label,
          headcount: r.headcount,
          volume: r.volume,
          completedOrReviewed: r.completedOrReviewed,
          rejectionOrRevisionRate: r.rejectionOrRevisionRate,
        })),
      ),
    };
  }

  if (report === 'supervisor') {
    const data = await getSupervisorTeamReport(actor, query);
    return {
      filename: `supervisor-${suffix}.csv`,
      csv: toCsv(
        data.teams.flatMap((team) =>
          team.members.map((m) => ({
            supervisor: team.supervisorName,
            member: m.name,
            role: m.role,
            casesHandled: m.casesHandled,
            designerCompleted: team.designerCompleted,
            qcReviewed: team.qcReviewed,
            qcRejected: team.qcRejected,
            consultantReviewed: team.consultantReviewed,
          })),
        ),
      ),
    };
  }

  throw new AppError('Unknown report type', 400);
}
