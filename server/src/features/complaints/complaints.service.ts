import {
  AUDIT_ACTIONS,
  COMPLAINT_STATUSES,
  PERMISSIONS,
  permissionsInclude,
  type ComplaintDto,
  type CreateComplaintInput,
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
  permissions: string[];
}

function actorName(actor: Actor) {
  return `${actor.firstName} ${actor.lastName}`.trim();
}

function toDto(doc: InstanceType<typeof Complaint>): ComplaintDto {
  return {
    id: doc.id,
    complaintCode: doc.complaintCode,
    details: doc.details,
    caseId: doc.caseId ?? null,
    doctorId: doc.doctorId ? String(doc.doctorId) : null,
    doctorName: doc.doctorName ?? null,
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

export async function listComplaints(actor: Actor) {
  if (
    !permissionsInclude(actor.permissions as never, PERMISSIONS.COMPLAINT_VIEW) &&
    !permissionsInclude(actor.permissions as never, PERMISSIONS.COMPLAINT_MANAGE) &&
    !permissionsInclude(actor.permissions as never, PERMISSIONS.CASE_VIEW_ALL)
  ) {
    throw new AppError('You do not have permission to view complaints', 403);
  }

  const items = await Complaint.find().sort({ createdAt: -1 }).limit(200);
  return items.map(toDto);
}

export async function getRatingsOverview(actor: Actor): Promise<RatingsOverviewDto> {
  if (
    !permissionsInclude(actor.permissions as never, PERMISSIONS.COMPLAINT_VIEW) &&
    !permissionsInclude(actor.permissions as never, PERMISSIONS.CASE_VIEW_ALL)
  ) {
    throw new AppError('You do not have permission to view ratings', 403);
  }

  const [rated, decisions, complaintsOpen, complaintsTotal] = await Promise.all([
    Complaint.find({ rating: { $gte: 1 } }).select('rating'),
    Case.find({
      doctorDecision: { $exists: true, $ne: null },
      isDeleted: false,
    }).select('doctorDecision doctorEngagement'),
    Complaint.countDocuments({
      status: { $in: [COMPLAINT_STATUSES.OPEN, COMPLAINT_STATUSES.IN_PROGRESS] },
    }),
    Complaint.countDocuments(),
  ]);

  const ratingSum = rated.reduce((sum, item) => sum + (item.rating ?? 0), 0);
  const viewed = decisions.filter((c) => c.doctorEngagement?.openedAt || c.doctorDecision);
  const approved = decisions.filter((c) => c.doctorDecision === 'approve').length;
  const modifications = decisions.filter(
    (c) => c.doctorDecision === 'request_modification',
  ).length;
  const viewedCount = Math.max(viewed.length, 1);

  return {
    totalRatings: rated.length,
    averageSatisfaction: rated.length ? Number((ratingSum / rated.length).toFixed(2)) : null,
    approvalRate: Number(((approved / viewedCount) * 100).toFixed(1)),
    rejectionRate: Number(((modifications / viewedCount) * 100).toFixed(1)),
    complaintsOpen,
    complaintsTotal,
  };
}

export async function createComplaint(
  actor: Actor,
  input: CreateComplaintInput,
  audit?: RequestAuditContext,
) {
  const canCreate =
    permissionsInclude(actor.permissions as never, PERMISSIONS.COMPLAINT_MANAGE) ||
    permissionsInclude(actor.permissions as never, PERMISSIONS.CASE_VIEW_OWN) ||
    permissionsInclude(actor.permissions as never, PERMISSIONS.CASE_VIEW_ALL);

  if (!canCreate) throw new AppError('You do not have permission to file complaints', 403);

  let doctorId = new Types.ObjectId(actor.id);
  let doctorName = actorName(actor);

  if (input.caseId) {
    const caseDoc = await Case.findOne({ caseId: input.caseId, isDeleted: false });
    if (!caseDoc) throw new AppError('Case not found', 404);
    doctorId = caseDoc.doctorId;
    doctorName = caseDoc.doctorName;
  }

  const employee = await resolveUserName(input.responsibleEmployeeId);
  const qc = await resolveUserName(input.responsibleQcId);
  const consultant = await resolveUserName(input.responsibleConsultantId);
  const supervisor = await resolveUserName(input.responsibleSupervisorId);

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
    type: input.type,
    status: COMPLAINT_STATUSES.OPEN,
    rating: input.rating ?? undefined,
    additionalComments: input.additionalComments?.trim() || '',
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

  return toDto(doc);
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

  if (input.status !== undefined) doc.status = input.status;
  if (input.additionalComments !== undefined) {
    doc.additionalComments = input.additionalComments.trim();
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

  return toDto(doc);
}
