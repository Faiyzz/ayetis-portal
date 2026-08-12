import {
  ASSIGNMENT_MODES,
  CASE_STATUSES,
  CASE_STATUS_LABELS,
  CONSULTANT_INDICATOR_LABELS,
  CONSULTANT_INDICATORS,
  DOCTOR_DECISIONS,
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
  type DoctorPerformanceReportDto,
  type QcDeptReportDto,
  type QcErrorCode,
  type ReportFilterQuery,
  type ReportPeriodDto,
  type SupervisorTeamReportDto,
} from '@ayetis/shared';
import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError';
import { Case, type ICase } from '../../models/Case';
import { Complaint } from '../../models/Complaint';
import { User } from '../../models/User';
import { toPrintHtml, toSpreadsheetMl } from '../../utils/spreadsheet';

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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolvePeriod(query: ReportFilterQuery = {}): ReportPeriodDto & {
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
  let start = range.start;
  let end = range.end;
  let periodLabel = labelForMonthKey(periodKey);
  if (query.from) {
    const from = new Date(query.from);
    if (!Number.isNaN(from.getTime())) start = from;
  }
  if (query.to) {
    const to = new Date(query.to);
    if (!Number.isNaN(to.getTime())) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(query.to)) to.setUTCHours(23, 59, 59, 999);
      end = to;
    }
  }
  if (query.from || query.to) {
    periodLabel = `${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`;
  }
  return {
    view,
    periodKey,
    periodLabel,
    availableMonths,
    start,
    end,
  };
}

function nameClause(field: string, value?: string) {
  const term = value?.trim();
  if (!term) return null;
  return { [field]: { $regex: escapeRegex(term), $options: 'i' } };
}

function caseMatch(period: { start: Date; end: Date }, query: ReportFilterQuery = {}) {
  const and: Record<string, unknown>[] = [
    { isDeleted: false },
    {
      $or: [
        { createdAt: { $gte: period.start, $lt: period.end } },
        { submittedAt: { $gte: period.start, $lt: period.end } },
      ],
    },
  ];
  const doctor = query.doctor?.trim() || query.customer?.trim();
  if (doctor) {
    and.push({
      $or: [
        { doctorName: { $regex: escapeRegex(doctor), $options: 'i' } },
        { doctorDisplayId: { $regex: escapeRegex(doctor), $options: 'i' } },
        { doctorEmail: { $regex: escapeRegex(doctor), $options: 'i' } },
        ...(Types.ObjectId.isValid(doctor) ? [{ doctorId: doctor }] : []),
      ],
    });
  }
  if (query.designer?.trim()) {
    const designer = query.designer.trim();
    if (/^[a-fA-F0-9]{24}$/.test(designer)) {
      and.push({ assignedDesignerId: designer });
    } else {
      const clause = nameClause('assignedDesignerName', designer);
      if (clause) and.push(clause);
    }
  }
  const consultant = nameClause('assignedConsultantName', query.consultant);
  if (consultant) and.push(consultant);
  if (query.qc?.trim()) {
    const qc = query.qc.trim();
    and.push({
      $or: [
        { 'qcReviews.reviewerName': { $regex: escapeRegex(qc), $options: 'i' } },
        ...(Types.ObjectId.isValid(qc) ? [{ 'qcReviews.reviewerId': qc }] : []),
      ],
    });
  }
  if (query.priority) and.push({ priority: query.priority });
  if (query.status) and.push({ status: query.status });
  if (query.sla === 'breached') {
    and.push({
      slaDeadlineAt: { $lt: new Date() },
      status: { $nin: [CASE_STATUSES.APPROVED, CASE_STATUSES.CANCELLED] },
    });
  }
  if (query.sla === 'ok') {
    and.push({
      $or: [
        { slaDeadlineAt: { $gte: new Date() } },
        { slaDeadlineAt: { $exists: false } },
        { status: { $in: [CASE_STATUSES.APPROVED, CASE_STATUSES.CANCELLED] } },
      ],
    });
  }
  if (query.supervisor?.trim()) {
    and.push({
      $or: [
        { assignedDesignerName: { $regex: escapeRegex(query.supervisor.trim()), $options: 'i' } },
        { validatedByName: { $regex: escapeRegex(query.supervisor.trim()), $options: 'i' } },
      ],
    });
  }
  return { $and: and };
}

function isSlaBreached(caseDoc: ICase, now = new Date()): boolean {
  if (!caseDoc.slaDeadlineAt) return false;
  if (
    caseDoc.status === CASE_STATUSES.APPROVED ||
    caseDoc.status === CASE_STATUSES.CANCELLED
  ) {
    return false;
  }
  return caseDoc.slaDeadlineAt < now;
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
  query: ReportFilterQuery = {},
): Promise<CasePipelineReportDto> {
  assertCanReport(actor);
  const period = resolvePeriod(query);

  const cases = await Case.find(caseMatch(period, query)).select(
    'status assignmentMode assignedDesignerId validatedAt slaDeadlineAt submittedToQcAt productionStartedAt qcRejectionCount',
  );

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
    slaBreached: cases.filter((c) => isSlaBreached(c)).length,
    onHold: cases.filter((c) => c.status === CASE_STATUSES.SAVED_FOR_SUBMISSION).length,
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
  query: ReportFilterQuery = {},
): Promise<DesignerDeptReportDto> {
  assertCanReport(actor);
  const period = resolvePeriod(query);
  const designers = await User.find({ role: ROLES.DESIGNER, isActive: { $ne: false } });
  const cases = await Case.find({
    ...caseMatch(period, query),
    assignedDesignerId: { $exists: true, $ne: null },
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
  query: ReportFilterQuery = {},
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
  query: ReportFilterQuery = {},
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
  query: ReportFilterQuery = {},
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
  query: ReportFilterQuery = {},
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

export async function getDoctorPerformanceReport(
  actor: Actor,
  query: ReportFilterQuery = {},
): Promise<DoctorPerformanceReportDto> {
  assertCanReport(actor);
  const period = resolvePeriod(query);
  const cases = await Case.find(caseMatch(period, query)).select(
    'doctorId doctorName doctorDisplayId doctorDecision doctorEngagement status',
  );
  const ratings = await Complaint.find({
    doctorId: { $exists: true },
    rating: { $gte: 1 },
  }).select('doctorId rating');

  const ratingMap = new Map<string, { sum: number; count: number; complaints: number }>();
  for (const row of ratings) {
    const id = String(row.doctorId);
    const current = ratingMap.get(id) ?? { sum: 0, count: 0, complaints: 0 };
    current.complaints += 1;
    if (typeof row.rating === 'number') {
      current.sum += row.rating;
      current.count += 1;
    }
    ratingMap.set(id, current);
  }

  const members = new Map<
    string,
    {
      doctorName: string;
      doctorDisplayId: string | null;
      viewed: number;
      approved: number;
      modifications: number;
      reviewHours: number[];
    }
  >();

  for (const caseDoc of cases) {
    const id = String(caseDoc.doctorId);
    const row = members.get(id) ?? {
      doctorName: caseDoc.doctorName,
      doctorDisplayId: caseDoc.doctorDisplayId ?? null,
      viewed: 0,
      approved: 0,
      modifications: 0,
      reviewHours: [],
    };
    const eng = caseDoc.doctorEngagement;
    const viewed = Boolean(eng?.openedAt || eng?.lastViewedAt || eng?.videoViewedAt);
    if (viewed) row.viewed += 1;
    if (caseDoc.doctorDecision === DOCTOR_DECISIONS.APPROVE) row.approved += 1;
    if (caseDoc.doctorDecision === DOCTOR_DECISIONS.REQUEST_MODIFICATION) row.modifications += 1;
    if (eng?.openedAt && eng?.respondedAt) {
      const hours = (eng.respondedAt.getTime() - eng.openedAt.getTime()) / 36e5;
      if (hours >= 0) row.reviewHours.push(hours);
    }
    members.set(id, row);
  }

  const list = [...members.entries()].map(([doctorId, row]) => {
    const rating = ratingMap.get(doctorId);
    return {
      doctorId,
      doctorName: row.doctorName,
      doctorDisplayId: row.doctorDisplayId,
      viewed: row.viewed,
      approved: row.approved,
      modifications: row.modifications,
      approvalRate: rate(row.approved, row.viewed),
      modificationRate: rate(row.modifications, row.viewed),
      averageReviewHours: avg(row.reviewHours),
      satisfactionScore: rating && rating.count > 0 ? Number((rating.sum / rating.count).toFixed(2)) : null,
      complaintsCount: rating?.complaints ?? 0,
    };
  });

  const viewed = list.reduce((s, m) => s + m.viewed, 0);
  const approved = list.reduce((s, m) => s + m.approved, 0);
  const modifications = list.reduce((s, m) => s + m.modifications, 0);
  const reviewHours = list
    .map((m) => m.averageReviewHours)
    .filter((v): v is number => v != null);

  return {
    view: period.view,
    periodKey: period.periodKey,
    periodLabel: period.periodLabel,
    availableMonths: period.availableMonths,
    members: list.sort((a, b) => b.viewed - a.viewed),
    totals: {
      viewed,
      approved,
      modifications,
      approvalRate: rate(approved, viewed),
      modificationRate: rate(modifications, viewed),
      averageReviewHours: avg(reviewHours),
    },
  };
}

export async function getAnalyticsDashboard(
  actor: Actor,
  query: ReportFilterQuery = {},
): Promise<AnalyticsDashboardDto> {
  assertCanReport(actor);
  const { getClarificationReport } = await import('../clarifications/clarifications.service');
  const [pipeline, designer, qc, consultant, supervisor, comparison, clarifications, doctors] =
    await Promise.all([
      getPipelineReport(actor, query),
      getDesignerDeptReport(actor, query),
      getQcDeptReport(actor, query),
      getConsultantDeptReport(actor, query),
      getSupervisorTeamReport(actor, query),
      getDepartmentComparison(actor, query),
      getClarificationReport(),
      getDoctorPerformanceReport(actor, query),
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
    clarifications,
    doctors,
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
  query: ReportFilterQuery = {},
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
          slaBreached: data.slaBreached,
          onHold: data.onHold,
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

  if (report === 'clarifications') {
    const { getClarificationReport } = await import('../clarifications/clarifications.service');
    const data = await getClarificationReport();
    return {
      filename: `clarifications-${suffix}.csv`,
      csv: toCsv(
        data.items.map((row) => ({
          caseId: row.caseId,
          subject: row.subject,
          senderRole: row.senderRole,
          type: row.clarificationType,
          priority: row.priority,
          status: row.status,
          escalation: row.escalationStatus,
          doctorRead: row.doctorRead ? 'yes' : 'no',
          teamRead: row.teamRead ? 'yes' : 'no',
          createdBy: row.createdByName,
          createdAt: row.createdAt,
          resolvedAt: row.resolvedAt,
        })),
      ),
    };
  }

  if (report === 'doctors' || report === 'doctor') {
    const data = await getDoctorPerformanceReport(actor, query);
    return {
      filename: `doctors-${suffix}.csv`,
      csv: toCsv(
        data.members.map((m) => ({
          doctor: m.doctorName,
          doctorId: m.doctorDisplayId,
          viewed: m.viewed,
          approved: m.approved,
          modifications: m.modifications,
          approvalRate: m.approvalRate,
          modificationRate: m.modificationRate,
          avgReviewHours: m.averageReviewHours,
          satisfaction: m.satisfactionScore,
          complaints: m.complaintsCount,
        })),
      ),
    };
  }

  throw new AppError('Unknown report type', 400);
}

async function reportMatrix(
  actor: Actor,
  report: string,
  query: ReportFilterQuery,
): Promise<{ title: string; headers: string[]; rows: Array<Array<string | number | null>> }> {
  const csv = await exportReportCsv(actor, report, query);
  const lines = csv.csv.split('\n').filter(Boolean);
  const headers = lines[0]?.split(',') ?? ['value'];
  const rows = lines.slice(1).map((line) => line.split(','));
  return { title: csv.filename.replace(/\.[^.]+$/, ''), headers, rows };
}

export async function exportReportExcel(
  actor: Actor,
  report: string,
  query: ReportFilterQuery = {},
): Promise<{ filename: string; xml: string }> {
  const matrix = await reportMatrix(actor, report, query);
  return {
    filename: `${matrix.title}.xls`,
    xml: toSpreadsheetMl(report, matrix.headers, matrix.rows),
  };
}

export async function exportReportHtml(
  actor: Actor,
  report: string,
  query: ReportFilterQuery = {},
): Promise<{ filename: string; html: string }> {
  const matrix = await reportMatrix(actor, report, query);
  const period = resolvePeriod(query);
  return {
    filename: `${matrix.title}.html`,
    html: toPrintHtml({
      title: `Ayetis report — ${report}`,
      subtitle: `${period.periodLabel} · generated ${new Date().toISOString()}`,
      headers: matrix.headers,
      rows: matrix.rows,
    }),
  };
}
