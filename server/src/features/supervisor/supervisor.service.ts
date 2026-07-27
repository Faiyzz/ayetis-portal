import {
  ALL_DELAY_LEVELS,
  AUDIT_ACTIONS,
  CASE_STATUSES,
  DELAY_LEVELS,
  QC_REVIEW_OUTCOMES,
  ROLES,
  computeDelayLevel,
  labelForMonthKey,
  monthRangeUtc,
  permissionsInclude,
  quarterRangeUtc,
  recentMonthOptions,
  PERMISSIONS,
  type DelayLevel,
  type SupervisorDashboardDto,
  type SupervisorMemberPerformanceDto,
  type SupervisorPerformanceDto,
  type SupervisorQueueCaseDto,
  type SupervisorQueueCounts,
} from '@ayetis/shared';
import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError';
import { Case, type ICase } from '../../models/Case';
import { User } from '../../models/User';
import { recordActivity, type RequestAuditContext } from '../audit/audit.service';
import type { CaseActor } from '../cases/cases.service';

function actorName(actor: CaseActor) {
  return `${actor.firstName} ${actor.lastName}`.trim();
}

function assertCanViewTeam(actor: CaseActor) {
  if (
    !permissionsInclude(actor.permissions, PERMISSIONS.REPORT_VIEW_TEAM) &&
    !permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL) &&
    !permissionsInclude(actor.permissions, PERMISSIONS.REPORT_VIEW_ALL)
  ) {
    throw new AppError('You do not have permission to view team queues', 403);
  }
}

function delayHoursSince(reference: Date, now = new Date()) {
  return Math.max(0, (now.getTime() - reference.getTime()) / (1000 * 60 * 60));
}

function emptyCounts(): SupervisorQueueCounts {
  return { pending: 0, active: 0, completed: 0, returned: 0 };
}

function toQueueItem(caseDoc: ICase, assigneeName: string | null): SupervisorQueueCaseDto {
  const ref = caseDoc.submittedToQcAt ?? caseDoc.validatedAt ?? caseDoc.updatedAt ?? caseDoc.createdAt;
  return {
    id: caseDoc.id,
    caseId: caseDoc.caseId,
    patientName: caseDoc.patientName,
    doctorName: caseDoc.doctorName,
    status: caseDoc.status,
    priority: caseDoc.priority,
    treatmentSummary: caseDoc.treatmentSummary,
    assigneeName,
    delayLevel: computeDelayLevel(ref),
    delayHours: delayHoursSince(ref),
    updatedAt: caseDoc.updatedAt.toISOString(),
  };
}

function classifyDesigner(
  status: string,
  hasAssignee: boolean,
  productionStarted: boolean,
): keyof SupervisorQueueCounts | null {
  if (status === CASE_STATUSES.SENT_FOR_MODIFICATION) return 'returned';
  if (
    status === CASE_STATUSES.COMPLETED ||
    status === CASE_STATUSES.DELIVERED ||
    status === CASE_STATUSES.APPROVED
  ) {
    return hasAssignee ? 'completed' : null;
  }
  if (status === CASE_STATUSES.DESIGNER_WORKING) {
    return productionStarted ? 'active' : 'pending';
  }
  if (
    status === CASE_STATUSES.UNDER_VALIDATION ||
    status === CASE_STATUSES.QC_REVIEW
  ) {
    return hasAssignee ? (status === CASE_STATUSES.QC_REVIEW ? 'active' : 'pending') : null;
  }
  if (!hasAssignee && status === CASE_STATUSES.DESIGNER_WORKING) return 'pending';
  return null;
}

function classifyQc(status: string, hasRejection: boolean): keyof SupervisorQueueCounts | null {
  if (status === CASE_STATUSES.QC_REVIEW) return 'pending';
  if (status === CASE_STATUSES.ORTHODONTIST_REVIEW) return 'active';
  if (status === CASE_STATUSES.SENT_FOR_MODIFICATION && hasRejection) return 'returned';
  if (
    status === CASE_STATUSES.DELIVERED ||
    status === CASE_STATUSES.APPROVED ||
    status === CASE_STATUSES.COMPLETED
  ) {
    return 'completed';
  }
  return null;
}

function classifyConsultant(status: string, escalated: boolean, hasRemarks: boolean): keyof SupervisorQueueCounts | null {
  if (escalated && !hasRemarks && status !== CASE_STATUSES.COMPLETED) return 'pending';
  if (status === CASE_STATUSES.ORTHODONTIST_REVIEW) return 'active';
  if (status === CASE_STATUSES.QC_REVIEW && escalated) return 'pending';
  if (status === CASE_STATUSES.SENT_FOR_MODIFICATION && escalated) return 'returned';
  if (
    (status === CASE_STATUSES.COMPLETED ||
      status === CASE_STATUSES.DELIVERED ||
      status === CASE_STATUSES.APPROVED) &&
    (escalated || hasRemarks)
  ) {
    return 'completed';
  }
  if (hasRemarks && status !== CASE_STATUSES.CANCELLED) return 'active';
  return null;
}

export async function getSupervisorDashboard(
  actor: CaseActor,
): Promise<SupervisorDashboardDto> {
  assertCanViewTeam(actor);

  const cases = await Case.find({
    isDeleted: false,
    status: { $ne: CASE_STATUSES.CANCELLED },
  }).sort({ updatedAt: -1 });

  const designer = { ...emptyCounts(), items: [] as SupervisorQueueCaseDto[] };
  const qc = { ...emptyCounts(), items: [] as SupervisorQueueCaseDto[] };
  const consultant = { ...emptyCounts(), items: [] as SupervisorQueueCaseDto[] };

  const delayBreakdown = Object.fromEntries(
    ALL_DELAY_LEVELS.map((level) => [level, 0]),
  ) as Record<DelayLevel, number>;

  const delayedCases: SupervisorQueueCaseDto[] = [];
  const escalatedCases: SupervisorQueueCaseDto[] = [];
  let urgentCount = 0;
  let totalOpen = 0;

  for (const caseDoc of cases) {
    const item = toQueueItem(
      caseDoc,
      caseDoc.assignedDesignerName ?? caseDoc.assignedConsultantName ?? null,
    );

    if (caseDoc.priority === 'urgent') urgentCount += 1;

    if (
      caseDoc.escalatedForOversight &&
      caseDoc.status !== CASE_STATUSES.COMPLETED &&
      caseDoc.status !== CASE_STATUSES.CANCELLED
    ) {
      escalatedCases.push(item);
    }

    const open =
      caseDoc.status !== CASE_STATUSES.COMPLETED &&
      caseDoc.status !== CASE_STATUSES.CANCELLED;
    if (open) {
      totalOpen += 1;
      delayBreakdown[item.delayLevel] += 1;
      if (
        item.delayLevel === DELAY_LEVELS.YELLOW ||
        item.delayLevel === DELAY_LEVELS.BLUE ||
        item.delayLevel === DELAY_LEVELS.RED
      ) {
        delayedCases.push(item);
      }
    }

    const dBucket = classifyDesigner(
      caseDoc.status,
      Boolean(caseDoc.assignedDesignerId),
      Boolean(caseDoc.productionStartedAt),
    );
    if (dBucket) {
      designer[dBucket] += 1;
      if (designer.items.length < 25) designer.items.push(item);
    }

    const qBucket = classifyQc(caseDoc.status, (caseDoc.qcRejectionCount ?? 0) > 0);
    if (qBucket) {
      qc[qBucket] += 1;
      if (qc.items.length < 25) qc.items.push(item);
    }

    const cBucket = classifyConsultant(
      caseDoc.status,
      Boolean(caseDoc.escalatedForOversight),
      (caseDoc.clinicalRemarks?.length ?? 0) > 0,
    );
    if (cBucket) {
      consultant[cBucket] += 1;
      if (consultant.items.length < 25) consultant.items.push(item);
    }
  }

  delayedCases.sort((a, b) => b.delayHours - a.delayHours);
  escalatedCases.sort((a, b) => b.delayHours - a.delayHours);

  return {
    generatedAt: new Date().toISOString(),
    queues: { designer, qc, consultant },
    workload: {
      totalOpen,
      urgentCount,
      delayedCount: delayedCases.length,
      delayBreakdown,
      delayedCases: delayedCases.slice(0, 40),
    },
    escalatedCases: escalatedCases.slice(0, 40),
  };
}

export async function getSupervisorPerformance(
  actor: CaseActor,
  query: { month?: string; view?: 'month' | 'quarter' } = {},
): Promise<SupervisorPerformanceDto> {
  assertCanViewTeam(actor);

  const availableMonths = recentMonthOptions(3);
  const periodKey =
    query.month && availableMonths.some((m) => m.key === query.month)
      ? query.month
      : availableMonths[0]!.key;
  const view = query.view === 'quarter' ? 'quarter' : 'month';
  const range =
    view === 'quarter'
      ? quarterRangeUtc(periodKey)
      : { ...monthRangeUtc(periodKey), label: labelForMonthKey(periodKey) };

  const teamRoles = [ROLES.DESIGNER, ROLES.QC, ROLES.ORTHODONTIST];
  const members = await User.find({ role: { $in: teamRoles }, isActive: true }).sort({
    role: 1,
    firstName: 1,
  });

  const cases = await Case.find({
    isDeleted: false,
    $or: [
      { updatedAt: { $gte: range.start, $lt: range.end } },
      { 'qcReviews.createdAt': { $gte: range.start, $lt: range.end } },
      { 'clinicalRemarks.createdAt': { $gte: range.start, $lt: range.end } },
      { history: { $elemMatch: { createdAt: { $gte: range.start, $lt: range.end } } } },
    ],
  }).select(
    'status assignedDesignerId assignedConsultantId qcReviews clinicalRemarks history qcRejectionCount',
  );

  const byUser = new Map<string, SupervisorMemberPerformanceDto>();
  for (const member of members) {
    byUser.set(member.id, {
      userId: member.id,
      name: `${member.firstName} ${member.lastName}`.trim(),
      email: member.email,
      role: member.role,
      totalCases: 0,
      completedCases: 0,
      modifications: 0,
      qcReviews: 0,
      qcReverted: 0,
      consultations: 0,
    });
  }

  let totalCases = 0;
  let modifications = 0;
  let qcCasesCount = 0;
  let qcRevertedCount = 0;
  let consultantReviewCount = 0;
  let consultantQcRevertedCount = 0;
  let consultantConsultationCount = 0;

  const countedCases = new Set<string>();

  for (const caseDoc of cases) {
    const designerId = caseDoc.assignedDesignerId
      ? String(caseDoc.assignedDesignerId)
      : null;
    if (designerId && byUser.has(designerId) && !countedCases.has(`${caseDoc.id}-${designerId}`)) {
      countedCases.add(`${caseDoc.id}-${designerId}`);
      const row = byUser.get(designerId)!;
      row.totalCases += 1;
      totalCases += 1;
      if (
        caseDoc.status === CASE_STATUSES.COMPLETED ||
        caseDoc.status === CASE_STATUSES.DELIVERED
      ) {
        row.completedCases += 1;
      }
    }

    for (const entry of caseDoc.history ?? []) {
      if (entry.createdAt < range.start || entry.createdAt >= range.end) continue;
      if (entry.action === 'qc_rejected' || entry.action === 'resubmitted_to_qc') {
        modifications += 1;
        if (designerId && byUser.has(designerId)) {
          byUser.get(designerId)!.modifications += 1;
        }
      }
    }

    for (const review of caseDoc.qcReviews ?? []) {
      if (review.createdAt < range.start || review.createdAt >= range.end) continue;
      const reviewerId = String(review.reviewerId);
      const row = byUser.get(reviewerId);
      qcCasesCount += 1;
      if (row) row.qcReviews += 1;
      if (review.outcome === QC_REVIEW_OUTCOMES.REJECTED) {
        qcRevertedCount += 1;
        if (row) row.qcReverted += 1;
        if (row?.role === ROLES.ORTHODONTIST) consultantQcRevertedCount += 1;
      }
      if (row?.role === ROLES.ORTHODONTIST) {
        consultantReviewCount += 1;
      }
    }

    for (const remark of caseDoc.clinicalRemarks ?? []) {
      if (remark.createdAt < range.start || remark.createdAt >= range.end) continue;
      consultantConsultationCount += 1;
      const authorId = String(remark.authorId);
      if (byUser.has(authorId)) {
        byUser.get(authorId)!.consultations += 1;
      }
    }
  }

  return {
    view,
    periodKey,
    periodLabel: range.label,
    availableMonths,
    team: {
      totalCases,
      modifications,
      qcCasesCount,
      qcRevertedCount,
      consultantReviewCount,
      consultantQcRevertedCount,
      consultantConsultationCount,
    },
    members: [...byUser.values()],
  };
}

export async function createTeamMember(
  actor: CaseActor,
  input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
  },
  audit?: RequestAuditContext,
) {
  if (
    !permissionsInclude(actor.permissions, PERMISSIONS.TEAM_MANAGE) &&
    !permissionsInclude(actor.permissions, PERMISSIONS.USER_CREATE)
  ) {
    throw new AppError('You do not have permission to manage team members', 403);
  }

  const allowed = [ROLES.DESIGNER, ROLES.QC, ROLES.ORTHODONTIST] as string[];
  if (!allowed.includes(input.role)) {
    throw new AppError('Supervisors can only add Designer, QC, or Consultant users', 400);
  }

  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) throw new AppError('Email is already registered', 409);

  const user = await User.create({
    email: input.email.toLowerCase().trim(),
    password: input.password,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    role: input.role,
    isActive: true,
    mustChangePassword: true,
    passwordChangedAt: new Date(),
  });

  await recordActivity({
    action: AUDIT_ACTIONS.USER_CREATE,
    summary: `${actor.email} added team member ${user.email} (${input.role})`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'user',
    targetId: user.id,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
  };
}

export async function deactivateTeamMember(
  actor: CaseActor,
  userId: string,
  audit?: RequestAuditContext,
) {
  if (
    !permissionsInclude(actor.permissions, PERMISSIONS.TEAM_MANAGE) &&
    !permissionsInclude(actor.permissions, PERMISSIONS.USER_UPDATE)
  ) {
    throw new AppError('You do not have permission to manage team members', 403);
  }

  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);

  const allowed = [ROLES.DESIGNER, ROLES.QC, ROLES.ORTHODONTIST] as string[];
  if (!allowed.includes(user.role)) {
    throw new AppError('Only Designer, QC, or Consultant members can be removed here', 400);
  }

  user.isActive = false;
  await user.save();

  await recordActivity({
    action: AUDIT_ACTIONS.USER_UPDATE,
    summary: `${actor.email} deactivated team member ${user.email}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'user',
    targetId: user.id,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return { id: user.id, isActive: user.isActive };
}

export async function listTeamMembers(actor: CaseActor) {
  if (
    !permissionsInclude(actor.permissions, PERMISSIONS.TEAM_MANAGE) &&
    !permissionsInclude(actor.permissions, PERMISSIONS.USER_LIST)
  ) {
    throw new AppError('You do not have permission to list team members', 403);
  }

  const users = await User.find({
    role: { $in: [ROLES.DESIGNER, ROLES.QC, ROLES.ORTHODONTIST] },
  }).sort({ role: 1, firstName: 1 });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    departmentId: user.departmentId ? String(user.departmentId) : null,
    departmentName: user.departmentName ?? null,
  }));
}
