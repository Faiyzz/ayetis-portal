import {
  ALL_COMPLAINT_TYPES,
  ALL_COMPLAINT_STATUSES,
  AUDIT_ACTIONS,
  COMPLAINT_STATUSES,
  COMPLAINT_TYPES,
  DOCTOR_DECISIONS,
  PERMISSIONS,
  ROLES,
  formatDoctorDisplay,
  permissionsInclude,
  type ComplaintDto,
  type ComplaintReportsDto,
  type ComplaintStaffOptionDto,
  type ComplaintTrendMonthDto,
  type ComplaintType,
  type CreateComplaintInput,
  type DoctorComplaintMetricsDto,
  type RatingsOverviewDto,
  type UpdateComplaintInput,
} from '@ayetis/shared';
import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError';
import { Case } from '../../models/Case';
import { Complaint } from '../../models/Complaint';
import { User } from '../../models/User';
import { recordActivity, type RequestAuditContext } from '../audit/audit.service';

interface Actor {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  roles?: string[];
  permissions: string[];
}

function actorName(actor: Actor) {
  return `${actor.firstName} ${actor.lastName}`.trim();
}

function canViewComplaints(actor: Actor) {
  return (
    permissionsInclude(actor.permissions as never, PERMISSIONS.COMPLAINT_VIEW) ||
    permissionsInclude(actor.permissions as never, PERMISSIONS.COMPLAINT_MANAGE) ||
    permissionsInclude(actor.permissions as never, PERMISSIONS.CASE_VIEW_ALL) ||
    permissionsInclude(actor.permissions as never, PERMISSIONS.REPORT_VIEW_ALL)
  );
}

function canCreateComplaint(actor: Actor) {
  return (
    permissionsInclude(actor.permissions as never, PERMISSIONS.COMPLAINT_CREATE) ||
    permissionsInclude(actor.permissions as never, PERMISSIONS.COMPLAINT_MANAGE)
  );
}

function emptyByType(): Record<ComplaintType, number> {
  return Object.fromEntries(ALL_COMPLAINT_TYPES.map((type) => [type, 0])) as Record<
    ComplaintType,
    number
  >;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function recentMonthKeys(count: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(monthKey(d));
  }
  return keys.reverse();
}

function rate(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Number(((part / total) * 100).toFixed(1));
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Number((sum / values.length).toFixed(2));
}

function doctorLabel(
  actor: Actor,
  doctorUserId: string | null | undefined,
  doctorName: string | null | undefined,
  doctorDisplayId?: string | null,
) {
  if (!doctorUserId) return doctorName ?? null;
  return formatDoctorDisplay(
    actor.role as never,
    actor.id,
    {
      doctorUserId,
      doctorName: doctorName || '',
      doctorId: doctorDisplayId ?? null,
    },
    actor.roles,
  );
}

async function doctorDisplayIdMap(
  userIds: Array<Types.ObjectId | string | null | undefined>,
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean).map((id) => String(id)))];
  if (!ids.length) return new Map();
  const users = await User.find({ _id: { $in: ids } }).select('doctorId');
  const map = new Map<string, string>();
  for (const user of users) {
    if (user.doctorId) map.set(user.id, user.doctorId);
  }
  return map;
}

function toDto(
  doc: InstanceType<typeof Complaint>,
  actor: Actor,
  doctorDisplayId?: string | null,
): ComplaintDto {
  return {
    id: doc.id,
    complaintCode: doc.complaintCode,
    details: doc.details,
    caseId: doc.caseId ?? null,
    doctorId: doc.doctorId ? String(doc.doctorId) : null,
    doctorName: doctorLabel(
      actor,
      doc.doctorId ? String(doc.doctorId) : null,
      doc.doctorName ?? null,
      doctorDisplayId,
    ),
    responsibleEmployeeId: doc.responsibleEmployeeId
      ? String(doc.responsibleEmployeeId)
      : null,
    responsibleEmployeeName: doc.responsibleEmployeeName ?? null,
    responsibleQcId: doc.responsibleQcId ? String(doc.responsibleQcId) : null,
    responsibleQcName: doc.responsibleQcName ?? null,
    responsibleConsultantId: doc.responsibleConsultantId
      ? String(doc.responsibleConsultantId)
      : null,
    responsibleConsultantName: doc.responsibleConsultantName ?? null,
    responsibleSupervisorId: doc.responsibleSupervisorId
      ? String(doc.responsibleSupervisorId)
      : null,
    responsibleSupervisorName: doc.responsibleSupervisorName ?? null,
    type: doc.type,
    status: doc.status,
    rating: doc.rating ?? null,
    additionalComments: doc.additionalComments || '',
    comments: (doc.comments ?? []).map((comment) => ({
      id: String(comment._id),
      text: comment.text,
      authorId: String(comment.authorId),
      authorName: comment.authorName,
      createdAt: comment.createdAt.toISOString(),
    })),
    createdById: String(doc.createdById),
    createdByName: doc.createdByName,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function resolveUserName(userId?: string | null) {
  if (!userId) return { id: undefined, name: undefined };
  const user = await User.findById(userId);
  if (!user) throw new AppError('Referenced user not found', 404);
  return {
    id: user._id as Types.ObjectId,
    name: `${user.firstName} ${user.lastName}`.trim(),
  };
}

async function nextComplaintCode() {
  const count = await Complaint.countDocuments();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `CMP-${stamp}-${String(count + 1).padStart(4, '0')}`;
}

function computeOverview(
  rated: Array<{ rating?: number }>,
  decisions: Array<{ doctorDecision?: string | null }>,
  complaintsOpen: number,
  complaintsTotal: number,
): RatingsOverviewDto {
  const ratingValues = rated
    .map((item) => item.rating)
    .filter((value): value is number => typeof value === 'number' && value >= 1);
  const decided = decisions.filter((c) => Boolean(c.doctorDecision));
  const approved = decided.filter((c) => c.doctorDecision === DOCTOR_DECISIONS.APPROVE).length;
  const modifications = decided.filter(
    (c) => c.doctorDecision === DOCTOR_DECISIONS.REQUEST_MODIFICATION,
  ).length;

  return {
    totalRatings: ratingValues.length,
    averageRating: average(ratingValues),
    approvalRate: rate(approved, decided.length),
    rejectionRate: rate(modifications, decided.length),
    decisionsTotal: decided.length,
    complaintsOpen,
    complaintsTotal,
  };
}

export async function listComplaints(actor: Actor) {
  if (!canViewComplaints(actor) && !canCreateComplaint(actor)) {
    throw new AppError('You do not have permission to view complaints', 403);
  }

  // Creators without view can only see complaints they filed.
  const filter =
    canViewComplaints(actor)
      ? {}
      : { createdById: new Types.ObjectId(actor.id) };

  const items = await Complaint.find(filter).sort({ createdAt: -1 }).limit(200);
  const displayIds = await doctorDisplayIdMap(items.map((item) => item.doctorId));
  return items.map((doc) =>
    toDto(doc, actor, doc.doctorId ? displayIds.get(String(doc.doctorId)) : undefined),
  );
}

export async function listComplaintStaff(actor: Actor): Promise<ComplaintStaffOptionDto[]> {
  if (!canCreateComplaint(actor) && !canViewComplaints(actor)) {
    throw new AppError('You do not have permission to list staff for complaints', 403);
  }

  const users = await User.find({
    isActive: true,
    role: {
      $in: [ROLES.DESIGNER, ROLES.QC, ROLES.ORTHODONTIST, ROLES.SUPERVISOR, ROLES.COORDINATOR],
    },
  })
    .select('email firstName lastName role')
    .sort({ lastName: 1, firstName: 1 })
    .limit(500);

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  }));
}

export async function getRatingsOverview(actor: Actor): Promise<RatingsOverviewDto> {
  if (!canViewComplaints(actor)) {
    throw new AppError('You do not have permission to view ratings', 403);
  }

  const [rated, decisions, complaintsOpen, complaintsTotal] = await Promise.all([
    Complaint.find({ rating: { $gte: 1 } }).select('rating'),
    Case.find({
      doctorDecision: { $exists: true, $ne: null },
      isDeleted: false,
    }).select('doctorDecision'),
    Complaint.countDocuments({
      status: { $in: [COMPLAINT_STATUSES.OPEN, COMPLAINT_STATUSES.IN_PROGRESS] },
    }),
    Complaint.countDocuments(),
  ]);

  return computeOverview(rated, decisions, complaintsOpen, complaintsTotal);
}

export async function getComplaintReports(
  actor: Actor,
  options: { months?: number } = {},
): Promise<ComplaintReportsDto> {
  if (!canViewComplaints(actor)) {
    throw new AppError('You do not have permission to view complaint reports', 403);
  }

  const monthCount = Math.min(Math.max(options.months ?? 6, 3), 12);
  const keys = recentMonthKeys(monthCount);
  const start = new Date(`${keys[0]}-01T00:00:00.000Z`);

  const [complaints, decisions, overview] = await Promise.all([
    Complaint.find({ createdAt: { $gte: start } }),
    Case.find({
      isDeleted: false,
      doctorDecision: { $exists: true, $ne: null },
      doctorDecisionAt: { $gte: start },
    }).select('doctorId doctorName doctorDisplayId doctorDecision doctorDecisionAt'),
    getRatingsOverview(actor),
  ]);

  const monthMap = new Map<string, ComplaintTrendMonthDto>();
  for (const key of keys) {
    monthMap.set(key, {
      key,
      label: monthLabel(key),
      complaintsTotal: 0,
      complaintsOpen: 0,
      complaintsResolved: 0,
      byType: emptyByType(),
      ratingsCount: 0,
      averageRating: null,
      decisionsTotal: 0,
      approvalRate: null,
      rejectionRate: null,
    });
  }

  const monthRatings = new Map<string, number[]>();
  const monthApproved = new Map<string, number>();
  const monthMods = new Map<string, number>();
  const monthDecisions = new Map<string, number>();

  for (const key of keys) {
    monthRatings.set(key, []);
    monthApproved.set(key, 0);
    monthMods.set(key, 0);
    monthDecisions.set(key, 0);
  }

  for (const complaint of complaints) {
    const key = monthKey(complaint.createdAt);
    const bucket = monthMap.get(key);
    if (!bucket) continue;
    bucket.complaintsTotal += 1;
    if (
      complaint.status === COMPLAINT_STATUSES.OPEN ||
      complaint.status === COMPLAINT_STATUSES.IN_PROGRESS
    ) {
      bucket.complaintsOpen += 1;
    }
    if (
      complaint.status === COMPLAINT_STATUSES.RESOLVED ||
      complaint.status === COMPLAINT_STATUSES.CLOSED
    ) {
      bucket.complaintsResolved += 1;
    }
    if (ALL_COMPLAINT_TYPES.includes(complaint.type)) {
      bucket.byType[complaint.type] += 1;
    }
    if (typeof complaint.rating === 'number' && complaint.rating >= 1) {
      monthRatings.get(key)?.push(complaint.rating);
    }
  }

  for (const decision of decisions) {
    if (!decision.doctorDecisionAt) continue;
    const key = monthKey(decision.doctorDecisionAt);
    if (!monthDecisions.has(key)) continue;
    monthDecisions.set(key, (monthDecisions.get(key) ?? 0) + 1);
    if (decision.doctorDecision === DOCTOR_DECISIONS.APPROVE) {
      monthApproved.set(key, (monthApproved.get(key) ?? 0) + 1);
    }
    if (decision.doctorDecision === DOCTOR_DECISIONS.REQUEST_MODIFICATION) {
      monthMods.set(key, (monthMods.get(key) ?? 0) + 1);
    }
  }

  const months = keys.map((key) => {
    const bucket = monthMap.get(key)!;
    const ratings = monthRatings.get(key) ?? [];
    const decided = monthDecisions.get(key) ?? 0;
    bucket.ratingsCount = ratings.length;
    bucket.averageRating = average(ratings);
    bucket.decisionsTotal = decided;
    bucket.approvalRate = rate(monthApproved.get(key) ?? 0, decided);
    bucket.rejectionRate = rate(monthMods.get(key) ?? 0, decided);
    return bucket;
  });

  // Per-doctor metrics from all-time decisions + complaints (bounded).
  const [allDecisions, allComplaints] = await Promise.all([
    Case.find({
      isDeleted: false,
      doctorDecision: { $exists: true, $ne: null },
    }).select('doctorId doctorName doctorDisplayId doctorDecision'),
    Complaint.find().select(
      'doctorId doctorName rating status',
    ),
  ]);

  const byDoctorMap = new Map<string, DoctorComplaintMetricsDto>();

  function ensureDoctor(id: string, name: string) {
    let row = byDoctorMap.get(id);
    if (!row) {
      row = {
        doctorId: id,
        doctorName: name || 'Unknown doctor',
        decisionsTotal: 0,
        approvedCount: 0,
        modificationCount: 0,
        cancelCount: 0,
        approvalRate: null,
        rejectionRate: null,
        ratingsCount: 0,
        averageRating: null,
        complaintsCount: 0,
        openComplaints: 0,
      };
      byDoctorMap.set(id, row);
    }
    return row;
  }

  for (const decision of allDecisions) {
    const id = String(decision.doctorId);
    const row = ensureDoctor(id, decision.doctorName || '');
    row.decisionsTotal += 1;
    if (decision.doctorDecision === DOCTOR_DECISIONS.APPROVE) row.approvedCount += 1;
    if (decision.doctorDecision === DOCTOR_DECISIONS.REQUEST_MODIFICATION) {
      row.modificationCount += 1;
    }
    if (decision.doctorDecision === DOCTOR_DECISIONS.CANCEL) row.cancelCount += 1;
  }

  const doctorRatings = new Map<string, number[]>();

  for (const complaint of allComplaints) {
    if (!complaint.doctorId) continue;
    const id = String(complaint.doctorId);
    const row = ensureDoctor(id, complaint.doctorName || '');
    row.complaintsCount += 1;
    if (
      complaint.status === COMPLAINT_STATUSES.OPEN ||
      complaint.status === COMPLAINT_STATUSES.IN_PROGRESS
    ) {
      row.openComplaints += 1;
    }
    if (typeof complaint.rating === 'number' && complaint.rating >= 1) {
      const list = doctorRatings.get(id) ?? [];
      list.push(complaint.rating);
      doctorRatings.set(id, list);
    }
  }

  const displayFromCases = new Map<string, string>();
  for (const decision of allDecisions) {
    if (decision.doctorDisplayId) {
      displayFromCases.set(String(decision.doctorId), decision.doctorDisplayId);
    }
  }
  const missingIds = [...byDoctorMap.keys()].filter((id) => !displayFromCases.has(id));
  const displayFromUsers = await doctorDisplayIdMap(missingIds);

  const byDoctor = [...byDoctorMap.values()]
    .map((row) => {
      const ratings = doctorRatings.get(row.doctorId) ?? [];
      row.ratingsCount = ratings.length;
      row.averageRating = average(ratings);
      row.approvalRate = rate(row.approvedCount, row.decisionsTotal);
      row.rejectionRate = rate(row.modificationCount, row.decisionsTotal);
      row.doctorName = doctorLabel(
        actor,
        row.doctorId,
        row.doctorName,
        displayFromCases.get(row.doctorId) ?? displayFromUsers.get(row.doctorId),
      ) ?? row.doctorName;
      return row;
    })
    .sort((a, b) => b.decisionsTotal - a.decisionsTotal || b.complaintsCount - a.complaintsCount)
    .slice(0, 100);

  return { overview, months, byDoctor };
}

export async function createComplaint(
  actor: Actor,
  input: CreateComplaintInput,
  audit?: RequestAuditContext,
) {
  if (!canCreateComplaint(actor)) {
    throw new AppError('You do not have permission to file complaints', 403);
  }

  let doctorId: Types.ObjectId | undefined;
  let doctorName: string | undefined;
  let doctorDisplayId: string | undefined;
  let employeeId = input.responsibleEmployeeId;
  let qcId = input.responsibleQcId;
  let consultantId = input.responsibleConsultantId;
  let supervisorId = input.responsibleSupervisorId;

  if (input.caseId) {
    const caseDoc = await Case.findOne({ caseId: input.caseId.trim(), isDeleted: false });
    if (!caseDoc) throw new AppError('Case not found', 404);
    doctorId = caseDoc.doctorId;
    doctorName = caseDoc.doctorName;
    doctorDisplayId = caseDoc.doctorDisplayId;
    // Prefill responsible parties from the case when not explicitly provided.
    if (!employeeId && caseDoc.assignedDesignerId) {
      employeeId = String(caseDoc.assignedDesignerId);
    }
    if (!consultantId && caseDoc.assignedConsultantId) {
      consultantId = String(caseDoc.assignedConsultantId);
    }
  }

  const employee = await resolveUserName(employeeId);
  const qc = await resolveUserName(qcId);
  const consultant = await resolveUserName(consultantId);
  const supervisor = await resolveUserName(supervisorId);

  const doc = await Complaint.create({
    complaintCode: await nextComplaintCode(),
    details: input.details.trim(),
    caseId: input.caseId?.trim() || undefined,
    doctorId,
    doctorName,
    responsibleEmployeeId: employee.id,
    responsibleEmployeeName: employee.name,
    responsibleQcId: qc.id,
    responsibleQcName: qc.name,
    responsibleConsultantId: consultant.id,
    responsibleConsultantName: consultant.name,
    responsibleSupervisorId: supervisor.id,
    responsibleSupervisorName: supervisor.name,
    type: input.type ?? COMPLAINT_TYPES.OTHER,
    status: COMPLAINT_STATUSES.OPEN,
    rating: input.rating ?? undefined,
    additionalComments: input.additionalComments?.trim() || '',
    comments: [],
    createdById: new Types.ObjectId(actor.id),
    createdByName: actorName(actor),
  });

  await recordActivity({
    action: AUDIT_ACTIONS.COMPLAINT_CREATE,
    summary: `${actor.email} filed complaint ${doc.complaintCode}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'system',
    targetId: doc.complaintCode,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return toDto(doc, actor, doctorDisplayId);
}

export async function updateComplaint(
  actor: Actor,
  complaintId: string,
  input: UpdateComplaintInput,
  audit?: RequestAuditContext,
) {
  if (!permissionsInclude(actor.permissions as never, PERMISSIONS.COMPLAINT_MANAGE)) {
    throw new AppError('You do not have permission to manage complaints', 403);
  }

  const doc = await Complaint.findById(complaintId);
  if (!doc) throw new AppError('Complaint not found', 404);

  if (input.status !== undefined) {
    if (!ALL_COMPLAINT_STATUSES.includes(input.status)) {
      throw new AppError('Invalid complaint status', 400);
    }
    doc.status = input.status;
  }

  if (input.additionalComments !== undefined) {
    doc.additionalComments = input.additionalComments.trim();
  }

  if (input.comment?.trim()) {
    doc.comments.push({
      _id: new Types.ObjectId(),
      text: input.comment.trim(),
      authorId: new Types.ObjectId(actor.id),
      authorName: actorName(actor),
      createdAt: new Date(),
    } as never);
  }

  if (input.responsibleEmployeeId !== undefined) {
    const employee = await resolveUserName(input.responsibleEmployeeId);
    doc.responsibleEmployeeId = employee.id;
    doc.responsibleEmployeeName = employee.name;
  }
  if (input.responsibleQcId !== undefined) {
    const qc = await resolveUserName(input.responsibleQcId);
    doc.responsibleQcId = qc.id;
    doc.responsibleQcName = qc.name;
  }
  if (input.responsibleConsultantId !== undefined) {
    const consultant = await resolveUserName(input.responsibleConsultantId);
    doc.responsibleConsultantId = consultant.id;
    doc.responsibleConsultantName = consultant.name;
  }
  if (input.responsibleSupervisorId !== undefined) {
    const supervisor = await resolveUserName(input.responsibleSupervisorId);
    doc.responsibleSupervisorId = supervisor.id;
    doc.responsibleSupervisorName = supervisor.name;
  }

  await doc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.COMPLAINT_UPDATE,
    summary: `${actor.email} updated complaint ${doc.complaintCode}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'system',
    targetId: doc.complaintCode,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  const displayIds = await doctorDisplayIdMap([doc.doctorId]);
  return toDto(
    doc,
    actor,
    doc.doctorId ? displayIds.get(String(doc.doctorId)) : undefined,
  );
}
