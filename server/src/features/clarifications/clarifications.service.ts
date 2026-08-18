import {
  ALL_CLARIFICATION_SENDER_ROLES,
  AUDIT_ACTIONS,
  CASE_STATUSES,
  CLARIFICATION_ESCALATION_STATUSES,
  CLARIFICATION_MESSAGE_KINDS,
  CLARIFICATION_PRIORITIES,
  CLARIFICATION_SENDER_ROLE_LABELS,
  CLARIFICATION_STATUSES,
  EMAIL_TEMPLATE_KEYS,
  NOTIFICATION_TYPES,
  PERMISSIONS,
  ROLE_LABELS,
  ROLES,
  clarificationTypeLabel,
  computeClarificationButtonState,
  formatDoctorDisplay,
  isValidClarificationType,
  permissionsInclude,
  resolveClarificationSenderRole,
  type ClarificationButtonState,
  type ClarificationDto,
  type ClarificationPriority,
  type ClarificationReportDto,
  type ClarificationReportRowDto,
  type ClarificationSenderRole,
  type CreateClarificationInput,
  type EscalateClarificationInput,
  type Permission,
  type Role,
  type UpdateClarificationDraftInput,
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
  sendCmsOrFallback,
} from '../../services/email';
import { persistUploadedFile } from '../../services/storage.service';
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

function doctorAuthorLabel(
  viewer: { id: string; role: string } | undefined,
  authorId: string,
  authorName: string,
  authorRole: string,
  doctorDisplayId?: string | null,
) {
  if (authorRole !== ROLES.DOCTOR) return authorName;
  return formatDoctorDisplay((viewer?.role ?? ROLES.COORDINATOR) as Role, viewer?.id ?? '', {
    doctorUserId: authorId,
    doctorName: authorName,
    doctorId: doctorDisplayId ?? null,
  });
}

function toDto(
  doc: IClarification,
  viewer?: { id: string; role: string },
  doctorDisplayId?: string | null,
): ClarificationDto {
  const senderRole = (doc.senderRole || 'coordinator') as ClarificationSenderRole;
  const clarificationType = doc.clarificationType || 'missing_records';
  return {
    id: doc.id,
    caseId: doc.caseId,
    caseMongoId: String(doc.caseMongoId),
    subject: doc.subject,
    requiredInfo: doc.requiredInfo,
    status: doc.status,
    senderRole,
    clarificationType,
    clarificationTypeLabel: clarificationTypeLabel(senderRole, clarificationType),
    priority: doc.priority ?? CLARIFICATION_PRIORITIES.NORMAL,
    isDraft: Boolean(doc.isDraft),
    createdById: String(doc.createdById),
    createdByName: doctorAuthorLabel(
      viewer,
      String(doc.createdById),
      doc.createdByName,
      doc.createdByRole,
      doctorDisplayId,
    ),
    createdByRole: doc.createdByRole,
    messages: doc.messages.map((message) => ({
      id: String(message._id),
      kind: message.kind,
      body: message.body,
      authorId: String(message.authorId),
      authorName: doctorAuthorLabel(
        viewer,
        String(message.authorId),
        message.authorName,
        message.authorRole,
        doctorDisplayId,
      ),
      authorRole: message.authorRole,
      createdAt: message.createdAt.toISOString(),
    })),
    attachments: (doc.attachments ?? []).map((file) => ({
      id: String(file._id),
      filename: file.filename,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedByName: file.uploadedByName,
      createdAt: file.createdAt.toISOString(),
    })),
    doctorResponseDraft: doc.doctorResponseDraft ?? null,
    doctorReadAt: doc.doctorReadAt ? doc.doctorReadAt.toISOString() : null,
    teamReadAt: doc.teamReadAt ? doc.teamReadAt.toISOString() : null,
    escalationStatus: doc.escalationStatus ?? CLARIFICATION_ESCALATION_STATUSES.NONE,
    escalatedAt: doc.escalatedAt ? doc.escalatedAt.toISOString() : null,
    escalatedByName: doc.escalatedByName ?? null,
    escalationReason: doc.escalationReason ?? null,
    resolvedAt: doc.resolvedAt ? doc.resolvedAt.toISOString() : null,
    resolvedByName: doc.resolvedByName ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function resolveSenderRole(
  actor: ClarificationActor,
  requested?: ClarificationSenderRole,
): ClarificationSenderRole {
  if (requested) {
    if (actor.role === 'admin' || permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL)) {
      return requested;
    }
    const mapped = resolveClarificationSenderRole(actor.role);
    if (mapped && mapped !== requested) {
      throw new AppError('You cannot create clarifications as that sender role', 403);
    }
    return requested;
  }
  const mapped = resolveClarificationSenderRole(actor.role);
  if (!mapped) {
    throw new AppError(
      'Your role cannot create clarifications; Admins must pick a sender role',
      400,
    );
  }
  return mapped;
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

function canSeeDraft(actor: ClarificationActor, doc: IClarification) {
  if (!doc.isDraft) return true;
  if (String(doc.createdById) === actor.id) return true;
  return permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL);
}

export async function listClarificationsForCase(
  actor: ClarificationActor,
  caseIdOrMongoId: string,
) {
  const caseDoc = await findCaseForActor(actor, caseIdOrMongoId);
  const items = await Clarification.find({ caseMongoId: caseDoc._id }).sort({
    createdAt: -1,
  });
  return items.filter((doc) => canSeeDraft(actor, doc)).map((doc) => toDto(doc, actor, caseDoc.doctorDisplayId));
}

export async function getClarification(actor: ClarificationActor, clarificationId: string) {
  const doc = await Clarification.findById(clarificationId);
  if (!doc) throw new AppError('Clarification not found', 404);
  const caseDoc = await findCaseForActor(actor, doc.caseId);
  if (!canSeeDraft(actor, doc)) throw new AppError('Clarification not found', 404);
  return toDto(doc, actor, caseDoc.doctorDisplayId);
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

  const senderRole = resolveSenderRole(actor, input.senderRole);
  const clarificationType = input.clarificationType.trim();
  if (!isValidClarificationType(senderRole, clarificationType)) {
    throw new AppError('Invalid clarification type for sender role', 400);
  }

  const priority = (input.priority ?? CLARIFICATION_PRIORITIES.NORMAL) as ClarificationPriority;
  const asDraft = Boolean(input.asDraft);
  const initialBody = (input.message?.trim() || requiredInfo).trim();

  const clarification = await Clarification.create({
    caseId: caseDoc.caseId,
    caseMongoId: caseDoc._id,
    subject,
    requiredInfo,
    status: asDraft ? CLARIFICATION_STATUSES.DRAFT : CLARIFICATION_STATUSES.AWAITING_DOCTOR,
    senderRole,
    clarificationType,
    priority,
    isDraft: asDraft,
    createdById: new Types.ObjectId(actor.id),
    createdByName: actorName(actor),
    createdByRole: actor.role,
    messages: asDraft
      ? []
      : [
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
    attachments: [],
    escalationStatus: CLARIFICATION_ESCALATION_STATUSES.NONE,
  });

  if (asDraft) {
    await recordActivity({
      action: AUDIT_ACTIONS.CLARIFICATION_DRAFT_SAVE,
      summary: `${actor.email} saved clarification draft on case ${caseDoc.caseId}`,
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
    return toDto(clarification, actor, caseDoc.doctorDisplayId);
  }

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
      senderRole,
      clarificationType,
    },
    createdAt: new Date(),
  } as (typeof caseDoc.history)[number]);
  await caseDoc.save();

  await notifyDoctorClarification(caseDoc, clarification, actor, subject, requiredInfo);

  await recordActivity({
    action: AUDIT_ACTIONS.CLARIFICATION_CREATE,
    summary: `${actor.email} created clarification on case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'clarification',
    targetId: clarification.id,
    metadata: { caseId: caseDoc.caseId, subject, senderRole, clarificationType },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return toDto(clarification, actor, caseDoc.doctorDisplayId);
}

async function notifyDoctorClarification(
  caseDoc: { doctorId: Types.ObjectId; doctorEmail: string; doctorName: string; caseId: string; patientName: string },
  clarification: IClarification,
  actor: ClarificationActor,
  subject: string,
  requiredInfo: string,
) {
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
    await sendCmsOrFallback(
      caseDoc.doctorEmail,
      EMAIL_TEMPLATE_KEYS.CLARIFICATION_REQUIRED,
      {
        doctorName: caseDoc.doctorName,
        caseId: caseDoc.caseId,
        patientName: caseDoc.patientName,
        subject,
        requiredInfo,
        portalUrl,
      },
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
}

export async function updateClarificationDraft(
  actor: ClarificationActor,
  clarificationId: string,
  input: UpdateClarificationDraftInput,
  audit?: RequestAuditContext,
) {
  const clarification = await Clarification.findById(clarificationId);
  if (!clarification) throw new AppError('Clarification not found', 404);
  const caseDoc = await findCaseForActor(actor, clarification.caseId);

  const isCreator = String(clarification.createdById) === actor.id;
  const isDoctorOwner =
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_OWN) &&
    (await Case.findById(clarification.caseMongoId).then(
      (c) => c && String(c.doctorId) === actor.id,
    ));

  if (input.doctorResponseDraft !== undefined) {
    if (!isDoctorOwner && !permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL)) {
      throw new AppError('Only the doctor can save a response draft', 403);
    }
    clarification.doctorResponseDraft = input.doctorResponseDraft;
  } else {
    if (!clarification.isDraft) {
      throw new AppError('Only drafts can be updated this way', 400);
    }
    if (!isCreator && !permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL)) {
      throw new AppError('Only the draft author can update it', 403);
    }
    if (input.subject !== undefined) clarification.subject = input.subject.trim();
    if (input.requiredInfo !== undefined) clarification.requiredInfo = input.requiredInfo.trim();
    if (input.clarificationType !== undefined) {
      if (!isValidClarificationType(clarification.senderRole, input.clarificationType)) {
        throw new AppError('Invalid clarification type', 400);
      }
      clarification.clarificationType = input.clarificationType;
    }
    if (input.priority !== undefined) clarification.priority = input.priority;
    if (input.message !== undefined && clarification.messages[0]) {
      clarification.messages[0].body = input.message.trim();
    }
  }

  await clarification.save();
  await recordActivity({
    action: AUDIT_ACTIONS.CLARIFICATION_DRAFT_SAVE,
    summary: `${actor.email} saved clarification draft ${clarification.id}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'clarification',
    targetId: clarification.id,
    metadata: { caseId: clarification.caseId },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });
  return toDto(clarification, actor, caseDoc.doctorDisplayId);
}

export async function publishClarificationDraft(
  actor: ClarificationActor,
  clarificationId: string,
  audit?: RequestAuditContext,
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CLARIFICATION_CREATE)) {
    throw new AppError('You do not have permission to publish clarifications', 403);
  }
  const clarification = await Clarification.findById(clarificationId);
  if (!clarification) throw new AppError('Clarification not found', 404);
  if (!clarification.isDraft) throw new AppError('Clarification is not a draft', 400);
  if (
    String(clarification.createdById) !== actor.id &&
    !permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL)
  ) {
    throw new AppError('Only the draft author can publish it', 403);
  }

  const caseDoc = await findCaseForActor(actor, clarification.caseId);
  const body = clarification.requiredInfo;
  clarification.isDraft = false;
  clarification.status = CLARIFICATION_STATUSES.AWAITING_DOCTOR;
  if (clarification.messages.length === 0) {
    clarification.messages.push({
      _id: new Types.ObjectId(),
      kind: CLARIFICATION_MESSAGE_KINDS.REQUEST,
      body,
      authorId: new Types.ObjectId(actor.id),
      authorName: actorName(actor),
      authorRole: actor.role,
      createdAt: new Date(),
    } as (typeof clarification.messages)[number]);
  }
  await clarification.save();

  caseDoc.status = CASE_STATUSES.IN_PROCESS;
  caseDoc.history.unshift({
    _id: new Types.ObjectId(),
    action: 'clarification_created',
    summary: `Clarification requested: ${clarification.subject}`,
    actorId: new Types.ObjectId(actor.id),
    actorName: actorName(actor),
    metadata: { clarificationId: clarification.id },
    createdAt: new Date(),
  } as (typeof caseDoc.history)[number]);
  await caseDoc.save();

  await notifyDoctorClarification(
    caseDoc,
    clarification,
    actor,
    clarification.subject,
    clarification.requiredInfo,
  );

  await recordActivity({
    action: AUDIT_ACTIONS.CLARIFICATION_PUBLISH,
    summary: `${actor.email} published clarification on case ${caseDoc.caseId}`,
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

  return toDto(clarification, actor, caseDoc.doctorDisplayId);
}

export async function replyToClarification(
  actor: ClarificationActor,
  clarificationId: string,
  body: string,
  audit?: RequestAuditContext,
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CLARIFICATION_REPLY)) {
    if (!permissionsInclude(actor.permissions, PERMISSIONS.CLARIFICATION_CREATE)) {
      throw new AppError('You do not have permission to reply', 403);
    }
  }

  const clarification = await Clarification.findById(clarificationId);
  if (!clarification) throw new AppError('Clarification not found', 404);
  if (clarification.isDraft) throw new AppError('Publish the draft before replying', 400);

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
    clarification.doctorResponseDraft = '';
    clarification.doctorReadAt = clarification.doctorReadAt ?? new Date();
  } else {
    clarification.status = CLARIFICATION_STATUSES.AWAITING_DOCTOR;
    clarification.teamReadAt = new Date();
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
        const recipientName = `${recipient.firstName} ${recipient.lastName}`.trim();
        await sendCmsOrFallback(
          recipient.email,
          EMAIL_TEMPLATE_KEYS.CLARIFICATION_REPLIED,
          {
            recipientName,
            caseId: caseDoc.caseId,
            replyPreview: trimmed,
            portalUrl,
          },
          clarificationRepliedTemplate({
            recipientName,
            caseId: caseDoc.caseId,
            patientName: caseDoc.patientName,
            subject: clarification.subject,
            doctorName: caseDoc.doctorDisplayId || 'Doctor',
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

  return toDto(clarification, actor, caseDoc.doctorDisplayId);
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
  if (clarification.isDraft) throw new AppError('Cannot resolve a draft', 400);

  const caseDoc = await findCaseForActor(actor, clarification.caseId);

  if (clarification.status === CLARIFICATION_STATUSES.RESOLVED) {
    return toDto(clarification, actor, caseDoc.doctorDisplayId);
  }

  clarification.status = CLARIFICATION_STATUSES.RESOLVED;
  clarification.resolvedAt = new Date();
  clarification.resolvedById = new Types.ObjectId(actor.id);
  clarification.resolvedByName = actorName(actor);
  await clarification.save();

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

  return toDto(clarification, actor, caseDoc.doctorDisplayId);
}

export async function markClarificationRead(
  actor: ClarificationActor,
  clarificationId: string,
  audit?: RequestAuditContext,
) {
  const clarification = await Clarification.findById(clarificationId);
  if (!clarification) throw new AppError('Clarification not found', 404);
  const caseDoc = await findCaseForActor(actor, clarification.caseId);
  const isDoctor = String(caseDoc.doctorId) === actor.id;
  const now = new Date();
  if (isDoctor) {
    clarification.doctorReadAt = clarification.doctorReadAt ?? now;
  } else {
    clarification.teamReadAt = now;
  }
  await clarification.save();
  await recordActivity({
    action: AUDIT_ACTIONS.CLARIFICATION_READ,
    summary: `${actor.email} marked clarification read`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'clarification',
    targetId: clarification.id,
    metadata: { caseId: clarification.caseId, asDoctor: isDoctor },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });
  return toDto(clarification, actor, caseDoc.doctorDisplayId);
}

export async function escalateClarification(
  actor: ClarificationActor,
  clarificationId: string,
  input: EscalateClarificationInput,
  audit?: RequestAuditContext,
) {
  if (
    !permissionsInclude(actor.permissions, PERMISSIONS.CLARIFICATION_CREATE) &&
    !permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL)
  ) {
    throw new AppError('You do not have permission to escalate clarifications', 403);
  }
  const clarification = await Clarification.findById(clarificationId);
  if (!clarification) throw new AppError('Clarification not found', 404);
  const caseDoc = await findCaseForActor(actor, clarification.caseId);

  const escalate = input.escalate !== false;
  if (escalate) {
    clarification.escalationStatus = CLARIFICATION_ESCALATION_STATUSES.ESCALATED;
    clarification.escalatedAt = new Date();
    clarification.escalatedById = new Types.ObjectId(actor.id);
    clarification.escalatedByName = actorName(actor);
    clarification.escalationReason = input.reason?.trim() || clarification.escalationReason;
  } else {
    clarification.escalationStatus = CLARIFICATION_ESCALATION_STATUSES.DE_ESCALATED;
  }
  await clarification.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CLARIFICATION_ESCALATE,
    summary: `${actor.email} ${escalate ? 'escalated' : 'de-escalated'} clarification`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'clarification',
    targetId: clarification.id,
    metadata: { caseId: clarification.caseId, escalate },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });
  return toDto(clarification, actor, caseDoc.doctorDisplayId);
}

export async function uploadClarificationAttachment(
  actor: ClarificationActor,
  clarificationId: string,
  file: { buffer?: Buffer; tempPath?: string; mimetype: string; originalname: string; size?: number },
  audit?: RequestAuditContext,
) {
  const clarification = await Clarification.findById(clarificationId);
  if (!clarification) throw new AppError('Clarification not found', 404);
  const caseDoc = await findCaseForActor(actor, clarification.caseId);

  const saved = await persistUploadedFile({
    caseId: `clarification-${clarification.id}`,
    originalName: file.originalname,
    mimeType: file.mimetype,
    buffer: file.buffer,
    tempPath: file.tempPath,
  });

  clarification.attachments.push({
    _id: new Types.ObjectId(),
    filename: file.originalname,
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size ?? 0,
    storageKey: saved.storageKey,
    uploadedById: new Types.ObjectId(actor.id),
    uploadedByName: actorName(actor),
    createdAt: new Date(),
  } as (typeof clarification.attachments)[number]);
  await clarification.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CLARIFICATION_CREATE,
    summary: `${actor.email} uploaded clarification attachment`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'clarification',
    targetId: clarification.id,
    metadata: { caseId: clarification.caseId, filename: file.originalname },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return toDto(clarification, actor, caseDoc.doctorDisplayId);
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
    isDraft: { $ne: true },
    status: {
      $in: [
        CLARIFICATION_STATUSES.OPEN,
        CLARIFICATION_STATUSES.AWAITING_DOCTOR,
        CLARIFICATION_STATUSES.AWAITING_TEAM,
      ],
    },
  });
}

export async function getClarificationButtonStateForCase(
  caseMongoId: Types.ObjectId,
): Promise<ClarificationButtonState> {
  const items = await Clarification.find({
    caseMongoId,
    isDraft: { $ne: true },
  }).select('status isDraft');
  return computeClarificationButtonState(
    items.map((item) => ({ status: item.status, isDraft: item.isDraft })),
  );
}

export async function listClarificationDtosForCase(
  caseMongoId: Types.ObjectId,
  viewer?: { id: string; role: string },
  options?: { doctorDisplayId?: string | null },
) {
  const items = await Clarification.find({ caseMongoId }).sort({ createdAt: -1 });
  return items
    .filter((doc) => !doc.isDraft || (viewer && String(doc.createdById) === viewer.id))
    .map((doc) => toDto(doc, viewer, options?.doctorDisplayId));
}

export async function getClarificationReport(): Promise<ClarificationReportDto> {
  await Clarification.updateMany(
    { senderRole: { $exists: false } },
    {
      $set: {
        senderRole: 'coordinator',
        clarificationType: 'missing_records',
        priority: CLARIFICATION_PRIORITIES.NORMAL,
        isDraft: false,
        escalationStatus: CLARIFICATION_ESCALATION_STATUSES.NONE,
        attachments: [],
      },
    },
  );

  const items = await Clarification.find({ isDraft: { $ne: true } }).sort({ createdAt: -1 }).limit(2000);
  const rows: ClarificationReportRowDto[] = items.map((doc) => ({
    id: doc.id,
    caseId: doc.caseId,
    subject: doc.subject,
    senderRole: doc.senderRole,
    clarificationType: doc.clarificationType,
    priority: doc.priority ?? CLARIFICATION_PRIORITIES.NORMAL,
    status: doc.status,
    escalationStatus: doc.escalationStatus ?? CLARIFICATION_ESCALATION_STATUSES.NONE,
    doctorRead: Boolean(doc.doctorReadAt),
    teamRead: Boolean(doc.teamReadAt),
    createdByName: doc.createdByName,
    createdAt: doc.createdAt.toISOString(),
    resolvedAt: doc.resolvedAt ? doc.resolvedAt.toISOString() : null,
  }));

  const byRole = new Map<ClarificationSenderRole, number>();
  for (const row of rows) {
    byRole.set(row.senderRole, (byRole.get(row.senderRole) ?? 0) + 1);
  }

  return {
    generatedAt: new Date().toISOString(),
    total: rows.length,
    openCount: rows.filter((r) => r.status !== CLARIFICATION_STATUSES.RESOLVED).length,
    awaitingDoctor: rows.filter((r) => r.status === CLARIFICATION_STATUSES.AWAITING_DOCTOR).length,
    awaitingTeam: rows.filter((r) => r.status === CLARIFICATION_STATUSES.AWAITING_TEAM).length,
    escalatedCount: rows.filter(
      (r) => r.escalationStatus === CLARIFICATION_ESCALATION_STATUSES.ESCALATED,
    ).length,
    unreadByDoctor: rows.filter(
      (r) => !r.doctorRead && r.status === CLARIFICATION_STATUSES.AWAITING_DOCTOR,
    ).length,
    bySenderRole: ALL_CLARIFICATION_SENDER_ROLES.map((role) => ({
      role,
      label: CLARIFICATION_SENDER_ROLE_LABELS[role],
      count: byRole.get(role) ?? 0,
    })),
    items: rows,
  };
}
