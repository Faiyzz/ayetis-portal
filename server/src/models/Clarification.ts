import {
  ALL_CLARIFICATION_ESCALATION_STATUSES,
  ALL_CLARIFICATION_PRIORITIES,
  ALL_CLARIFICATION_SENDER_ROLES,
  ALL_CLARIFICATION_STATUSES,
  CLARIFICATION_ESCALATION_STATUSES,
  CLARIFICATION_MESSAGE_KINDS,
  CLARIFICATION_PRIORITIES,
  CLARIFICATION_STATUSES,
  type ClarificationEscalationStatus,
  type ClarificationMessageKind,
  type ClarificationPriority,
  type ClarificationSenderRole,
  type ClarificationStatus,
} from '@ayetis/shared';
import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IClarificationMessage {
  _id: Types.ObjectId;
  kind: ClarificationMessageKind;
  body: string;
  authorId: Types.ObjectId;
  authorName: string;
  authorRole: string;
  createdAt: Date;
}

export interface IClarificationAttachment {
  _id: Types.ObjectId;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedById?: Types.ObjectId;
  uploadedByName: string;
  createdAt: Date;
}

export interface IClarification extends Document {
  caseId: string;
  caseMongoId: Types.ObjectId;
  subject: string;
  requiredInfo: string;
  status: ClarificationStatus;
  senderRole: ClarificationSenderRole;
  clarificationType: string;
  priority: ClarificationPriority;
  isDraft: boolean;
  createdById: Types.ObjectId;
  createdByName: string;
  createdByRole: string;
  messages: IClarificationMessage[];
  attachments: IClarificationAttachment[];
  doctorResponseDraft?: string;
  doctorReadAt?: Date;
  teamReadAt?: Date;
  escalationStatus: ClarificationEscalationStatus;
  escalatedAt?: Date;
  escalatedById?: Types.ObjectId;
  escalatedByName?: string;
  escalationReason?: string;
  resolvedAt?: Date;
  resolvedById?: Types.ObjectId;
  resolvedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const clarificationMessageSchema = new Schema<IClarificationMessage>(
  {
    kind: {
      type: String,
      enum: Object.values(CLARIFICATION_MESSAGE_KINDS),
      required: true,
    },
    body: { type: String, required: true, trim: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const clarificationAttachmentSchema = new Schema<IClarificationAttachment>(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    storageKey: { type: String, required: true },
    uploadedById: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedByName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const clarificationSchema = new Schema<IClarification>(
  {
    caseId: { type: String, required: true, index: true },
    caseMongoId: {
      type: Schema.Types.ObjectId,
      ref: 'Case',
      required: true,
      index: true,
    },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    requiredInfo: { type: String, required: true, trim: true, maxlength: 5000 },
    status: {
      type: String,
      enum: ALL_CLARIFICATION_STATUSES,
      default: CLARIFICATION_STATUSES.AWAITING_DOCTOR,
      index: true,
    },
    senderRole: {
      type: String,
      enum: ALL_CLARIFICATION_SENDER_ROLES,
      default: 'coordinator',
      index: true,
    },
    clarificationType: { type: String, trim: true, default: 'missing_records', index: true },
    priority: {
      type: String,
      enum: ALL_CLARIFICATION_PRIORITIES,
      default: CLARIFICATION_PRIORITIES.NORMAL,
      index: true,
    },
    isDraft: { type: Boolean, default: false, index: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
    createdByRole: { type: String, required: true },
    messages: { type: [clarificationMessageSchema], default: [] },
    attachments: { type: [clarificationAttachmentSchema], default: [] },
    doctorResponseDraft: { type: String, default: '' },
    doctorReadAt: { type: Date },
    teamReadAt: { type: Date },
    escalationStatus: {
      type: String,
      enum: ALL_CLARIFICATION_ESCALATION_STATUSES,
      default: CLARIFICATION_ESCALATION_STATUSES.NONE,
      index: true,
    },
    escalatedAt: { type: Date },
    escalatedById: { type: Schema.Types.ObjectId, ref: 'User' },
    escalatedByName: { type: String },
    escalationReason: { type: String },
    resolvedAt: { type: Date },
    resolvedById: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedByName: { type: String },
  },
  { timestamps: true },
);

clarificationSchema.index({ caseId: 1, createdAt: -1 });
clarificationSchema.index({ status: 1, createdAt: -1 });
clarificationSchema.index({ caseMongoId: 1, isDraft: 1, status: 1 });

export const Clarification: Model<IClarification> =
  mongoose.models.Clarification ??
  mongoose.model<IClarification>('Clarification', clarificationSchema);
