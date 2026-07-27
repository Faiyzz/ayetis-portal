import {
  ALL_CLARIFICATION_STATUSES,
  CLARIFICATION_MESSAGE_KINDS,
  CLARIFICATION_STATUSES,
  type ClarificationMessageKind,
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

export interface IClarification extends Document {
  caseId: string;
  caseMongoId: Types.ObjectId;
  subject: string;
  requiredInfo: string;
  status: ClarificationStatus;
  createdById: Types.ObjectId;
  createdByName: string;
  createdByRole: string;
  messages: IClarificationMessage[];
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
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
    createdByRole: { type: String, required: true },
    messages: { type: [clarificationMessageSchema], default: [] },
    resolvedAt: { type: Date },
    resolvedById: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedByName: { type: String },
  },
  { timestamps: true },
);

clarificationSchema.index({ caseId: 1, createdAt: -1 });
clarificationSchema.index({ status: 1, createdAt: -1 });

export const Clarification: Model<IClarification> =
  mongoose.models.Clarification ??
  mongoose.model<IClarification>('Clarification', clarificationSchema);
