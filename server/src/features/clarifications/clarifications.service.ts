import {
  AUDIT_ACTIONS,
  CASE_STATUSES,
  CLARIFICATION_MESSAGE_KINDS,
  CLARIFICATION_STATUSES,
  NOTIFICATION_TYPES,
  PERMISSIONS,
  ROLE_LABELS,
  permissionsInclude,
  type ClarificationDto,
  type CreateClarificationInput,
  type Permission,
  type Role,
} from '@ayetis/shared';
import { Types } from 'mongoose';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { Clarification, type IClarification } from '../../models/Clarification';
import { Case } from '../../models/Case';
import { User } from '../../models/User';
import {
  clarificationRepliedTemplate,
  clarificationRequiredTemplate,
  sendTemplatedEmail,
} from '../../services/email';
import {
  recordActivity,
  type RequestAuditContext,
} from '../audit/audit.service';
import {
  createNotification,
  createNotificationsForUsers,
} from '../notifications/notifications.service';
import { resolvePermissionsForUserId } from '../users/users.service';

export interface ClarificationActor {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: Permission[];
}

function actorName(actor: ClarificationActor) {
  return `${actor.firstName} ${actor.lastName}`.trim();
}

function roleLabel(role: string) {
  return ROLE_LABELS[role as Role] ?? role;
}

function toDto(doc: IClarification): ClarificationDto {
  return {
    id: doc.id,
    caseId: doc.caseId,
    caseMongoId: String(doc.caseMongoId),
    subject: doc.subject,
    requiredInfo: doc.requiredInfo,
    status: doc.status,
    createdById: String(doc.createdById),
    createdByName: doc.createdByName,
    createdByRole: doc.createdByRole,
    messages: doc.messages.map((message) => ({
      id: String(message._id),
      kind: message.kind,
      body: message.body,
      authorId: String(message.authorId),
      authorName: message.authorName,
      authorRole: message.authorRole,
      createdAt: message.createdAt.toISOString(),
    })),
    resolvedAt: doc.resolvedAt ? doc.resolvedAt.toISOString() : null,
    resolvedByName: doc.resolvedByName ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function findCaseForActor(actor: ClarificationActor, caseIdOrMongoId: string) {
  const filter = Types.ObjectId.isValid(caseIdOrMongoId)
    ? { $or: [{ _id: caseIdOrMongoId }, { caseId: caseIdOrMongoId }] }
    : { caseId: caseIdOrMongoId };

  const caseDoc = await Case.findOne(filter);
  if (!caseDoc) throw new AppError('Case not found', 404);

  if (permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL)) {
    return caseDoc;
  }

  if (
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_OWN) &&
    String(caseDoc.doctorId) === actor.id
  ) {
    return caseDoc;
  }

  if (permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ASSIGNED)) {
    if (caseDoc.assignedDesignerId && String(caseDoc.assignedDesignerId) === actor.id) {
      return caseDoc;
    }
    if (caseDoc.assignmentMode === 'auto_queue' && !caseDoc.assignedDesignerId) {
      return caseDoc;
    }
  }

  throw new AppError('You do not have permission to view this case', 403);
}

export async function listClarificationsForCase(
  actor: ClarificationActor,
  caseIdOrMongoId: string,
) {
  const caseDoc = await findCaseForActor(actor, caseIdOrMongoId);
  const items = await Clarification.find({ caseMongoId: caseDoc._id }).sort({
    createdAt: -1,
  });
  return items.map(toDto);
}

export async function getClarification(actor: ClarificationActor, clarificationId: string) {
  const doc = await Clarification.findById(clarificationId);
  if (!doc) throw new AppError('Clarification not found', 404);
  await findCaseForActor(actor, doc.caseId);
  return toDto(doc);
}

export async function createClarification(
  actor: ClarificationActor,
  caseIdOrMongoId: string,
  input: CreateClarificationInput,
  audit?: RequestAuditContext,
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CLARIFICATION_CREATE)) {
    throw new AppError('You do not have permission to create clarifications', 403);
  }

  const caseDoc = await findCaseForActor(actor, caseIdOrMongoId);
  if (caseDoc.isDeleted) throw new AppError('Cannot clarify a deleted case', 400);
  if (caseDoc.status === CASE_STATUSES.CANCELLED) {
    throw new AppError('Cannot clarify a cancelled case', 400);
  }

  const subject = input.subject.trim();
  const requiredInfo = input.requiredInfo.trim();
  if (!subject || !requiredInfo) {
    throw new AppError('Subject and required information are required', 400);
  }

  const initialBody = (input.message?.trim() || requiredInfo).trim();

  const clarification = await Clarification.create({
    caseId: caseDoc.caseId,
    caseMongoId: caseDoc._id,
    subject,
    requiredInfo,
    status: CLARIFICATION_STATUSES.AWAITING_DOCTOR,
    createdById: new Types.ObjectId(actor.id),
    createdByName: actorName(actor),
    createdByRole: actor.role,
    messages: [
      {
        _id: new Types.ObjectId(),
        kind: CLARIFICATION_MESSAGE_KINDS.REQUEST,
        body: initialBody,
        authorId: new Types.ObjectId(actor.id),
        authorName: actorName(actor),
        authorRole: actor.role,
        createdAt: new Date(),
      },
    ],
  });

  const previousStatus = caseDoc.status;
  caseDoc.status = CASE_STATUSES.IN_PROCESS;
  caseDoc.history.unshift({
    _id: new Types.ObjectId(),
    action: 'clarification_created',
    summary: `Clarification requested: ${subject}`,
    actorId: new Types.ObjectId(actor.id),
    actorName: actorName(actor),
    metadata: {
      clarificationId: clarification.id,
      previousStatus,
    },
    createdAt: new Date(),
  } as (typeof caseDoc.history)[number]);
  await caseDoc.save();

  const portalUrl = `${env.clientUrl}/app/cases/${caseDoc.caseId}?tab=clarifications`;

  await createNotification({
    userId: String(caseDoc.doctorId),
    type: NOTIFICATION_TYPES.CLARIFICATION_REQUIRED,
    title: `Clarification required — ${caseDoc.caseId}`,
    body: subject,
    link: `/app/cases/${caseDoc.caseId}?tab=clarifications`,
    caseId: caseDoc.caseId,
    clarificationId: clarification.id,
  });

  try {
    await sendTemplatedEmail(
      caseDoc.doctorEmail,
      clarificationRequiredTemplate({
        doctorName: caseDoc.doctorName,
        caseId: caseDoc.caseId,
        patientName: caseDoc.patientName,
        subject,
        requiredInfo,
        requestedByName: actorName(actor),
        requestedByRole: roleLabel(actor.role),
        portalUrl,
      }),
    );
  } catch (error) {
    console.error('[email] clarification-required failed', error);
  }

  await recordActivity({
    action: AUDIT_ACTIONS.CLARIFICATION_CREATE,
    summary: `${actor.email} created clarification on case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'clarification',
    targetId: clarification.id,
    metadata: { caseId: caseDoc.caseId, subject },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return toDto(clarification);
}

export async function replyToClarification(
  actor: ClarificationActor,
  clarificationId: string,
  body: string,
  audit?: RequestAuditContext,
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CLARIFICATION_REPLY)) {
    // Staff with create can also reply
    if (!permissionsInclude(actor.permissions, PERMISSIONS.CLARIFICATION_CREATE)) {
      throw new AppError('You do not have permission to reply', 403);
    }
  }

  const clarification = await Clarification.findById(clarificationId);
  if (!clarification) throw new AppError('Clarification not found', 404);

  const caseDoc = await findCaseForActor(actor, clarification.caseId);
  if (caseDoc.isDeleted) throw new AppError('Cannot reply on a deleted case', 400);

  const trimmed = body.trim();
  if (!trimmed) throw new AppError('Reply cannot be empty', 400);

  const isDoctorOwner =
    String(caseDoc.doctorId) === actor.id &&
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_OWN);

  const isStaff =
    permissionsInclude(actor.permissions, PERMISSIONS.CLARIFICATION_CREATE) ||
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL);

  if (!isDoctorOwner && !isStaff) {
    throw new AppError('You do not have permission to reply to this clarification', 403);
  }

  if (clarification.status === CLARIFICATION_STATUSES.RESOLVED) {
    throw new AppError('This clarification is already resolved', 400);
  }

  clarification.messages.push({
    _id: new Types.ObjectId(),
    kind: isDoctorOwner
      ? CLARIFICATION_MESSAGE_KINDS.REPLY
      : CLARIFICATION_MESSAGE_KINDS.NOTE,
    body: trimmed,
    authorId: new Types.ObjectId(actor.id),
    authorName: actorName(actor),
    authorRole: actor.role,
    createdAt: new Date(),
  } as (typeof clarification.messages)[number]);

  if (isDoctorOwner) {
    clarification.status = CLARIFICATION_STATUSES.AWAITING_TEAM;
  } else {
    clarification.status = CLARIFICATION_STATUSES.AWAITING_DOCTOR;
    if (caseDoc.status !== CASE_STATUSES.IN_PROCESS) {
      caseDoc.status = CASE_STATUSES.IN_PROCESS;
    }
  }

  await clarification.save();

  caseDoc.history.unshift({
    _id: new Types.ObjectId(),
    action: 'clarification_reply',
    summary: isDoctorOwner
      ? 'Doctor replied to clarification'
      : 'Team followed up on clarification',
    actorId: new Types.ObjectId(actor.id),
    actorName: actorName(actor),
    metadata: { clarificationId: clarification.id },
    createdAt: new Date(),
  } as (typeof caseDoc.history)[number]);
  await caseDoc.save();

  const portalUrl = `${env.clientUrl}/app/cases/${caseDoc.caseId}?tab=clarifications`;

  if (isDoctorOwner) {
    const notifyIds = [String(clarification.createdById)];
    if (caseDoc.assignedDesignerId) {
      notifyIds.push(String(caseDoc.assignedDesignerId));
    }

    await createNotificationsForUsers(notifyIds, {
      type: NOTIFICATION_TYPES.CLARIFICATION_REPLIED,
      title: `Reply received for Case ID ${caseDoc.caseId}`,
      body: `Doctor responded: ${clarification.subject}`,
      link: `/app/cases/${caseDoc.caseId}?tab=clarifications`,
      caseId: caseDoc.caseId,
      clarificationId: clarification.id,
    });

    const recipients = await User.find({
      _id: { $in: notifyIds.map((id) => new Types.ObjectId(id)) },
      isActive: true,
    }).select('email firstName lastName');

    for (const recipient of recipients) {
      try {
        await sendTemplatedEmail(
          recipient.email,
          clarificationRepliedTemplate({
            recipientName: `${recipient.firstName} ${recipient.lastName}`.trim(),
            caseId: caseDoc.caseId,
            patientName: caseDoc.patientName,
            subject: clarification.subject,
            doctorName: caseDoc.doctorName,
            replyPreview: trimmed,
            portalUrl,
          }),
        );
      } catch (error) {
        console.error('[email] clarification-replied failed', error);
      }
    }
  } else {
    await createNotification({
      userId: String(caseDoc.doctorId),
      type: NOTIFICATION_TYPES.CLARIFICATION_REQUIRED,
      title: `Clarification update — ${caseDoc.caseId}`,
      body: clarification.subject,
      link: `/app/cases/${caseDoc.caseId}?tab=clarifications`,
      caseId: caseDoc.caseId,
      clarificationId: clarification.id,
    });
  }

  await recordActivity({
    action: AUDIT_ACTIONS.CLARIFICATION_REPLY,
    summary: `${actor.email} replied on clarification for case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'clarification',
    targetId: clarification.id,
    metadata: { caseId: caseDoc.caseId },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return toDto(clarification);
}

export async function resolveClarification(
  actor: ClarificationActor,
  clarificationId: string,
  audit?: RequestAuditContext,
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CLARIFICATION_RESOLVE)) {
    throw new AppError('You do not have permission to resolve clarifications', 403);
  }

  const clarification = await Clarification.findById(clarificationId);
  if (!clarification) throw new AppError('Clarification not found', 404);

  const caseDoc = await findCaseForActor(actor, clarification.caseId);

  if (clarification.status === CLARIFICATION_STATUSES.RESOLVED) {
    return toDto(clarification);
  }

  clarification.status = CLARIFICATION_STATUSES.RESOLVED;
  clarification.resolvedAt = new Date();
  clarification.resolvedById = new Types.ObjectId(actor.id);
  clarification.resolvedByName = actorName(actor);
  await clarification.save();

  const openCount = await Clarification.countDocuments({
    caseMongoId: caseDoc._id,
    status: {
      $in: [
        CLARIFICATION_STATUSES.OPEN,
        CLARIFICATION_STATUSES.AWAITING_DOCTOR,
        CLARIFICATION_STATUSES.AWAITING_TEAM,
      ],
    },
  });

  if (openCount === 0 && caseDoc.status === CASE_STATUSES.IN_PROCESS) {
    caseDoc.status = CASE_STATUSES.IN_PROCESS;
  }

  caseDoc.history.unshift({
    _id: new Types.ObjectId(),
    action: 'clarification_resolved',
    summary: `Clarification resolved: ${clarification.subject}`,
    actorId: new Types.ObjectId(actor.id),
    actorName: actorName(actor),
    metadata: { clarificationId: clarification.id },
    createdAt: new Date(),
  } as (typeof caseDoc.history)[number]);
  await caseDoc.save();

  await createNotification({
    userId: String(caseDoc.doctorId),
    type: NOTIFICATION_TYPES.CLARIFICATION_RESOLVED,
    title: `Clarification resolved — ${caseDoc.caseId}`,
    body: clarification.subject,
    link: `/app/cases/${caseDoc.caseId}?tab=clarifications`,
    caseId: caseDoc.caseId,
    clarificationId: clarification.id,
  });

  await recordActivity({
    action: AUDIT_ACTIONS.CLARIFICATION_RESOLVE,
    summary: `${actor.email} resolved clarification on case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'clarification',
    targetId: clarification.id,
    metadata: { caseId: caseDoc.caseId },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return toDto(clarification);
}

export async function resolveClarificationActor(userId: string): Promise<ClarificationActor> {
  const user = await User.findById(userId);
  if (!user || !user.isActive) throw new AppError('User not found or inactive', 401);
  const permissions = await resolvePermissionsForUserId(userId);
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    permissions,
  };
}

export async function countOpenClarifications(caseMongoId: Types.ObjectId) {
  return Clarification.countDocuments({
    caseMongoId,
    status: {
      $in: [
        CLARIFICATION_STATUSES.OPEN,
        CLARIFICATION_STATUSES.AWAITING_DOCTOR,
        CLARIFICATION_STATUSES.AWAITING_TEAM,
      ],
    },
  });
}

export async function listClarificationDtosForCase(caseMongoId: Types.ObjectId) {
  const items = await Clarification.find({ caseMongoId }).sort({ createdAt: -1 });
  return items.map(toDto);
}
