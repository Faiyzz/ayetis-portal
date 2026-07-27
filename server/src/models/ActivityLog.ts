import {
  ALL_AUDIT_ACTIONS,
  type AuditAction,
  type AuditTargetType,
} from '@ayetis/shared';
import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IActivityLog extends Document {
  action: AuditAction;
  actorId?: mongoose.Types.ObjectId;
  actorEmail?: string;
  actorName?: string;
  actorRole?: string;
  targetType: AuditTargetType;
  targetId?: string;
  summary: string;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    action: {
      type: String,
      enum: ALL_AUDIT_ACTIONS,
      required: true,
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    actorEmail: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
    actorName: {
      type: String,
      trim: true,
    },
    actorRole: {
      type: String,
      index: true,
    },
    targetType: {
      type: String,
      enum: ['user', 'role', 'auth', 'system', 'case', 'clarification'],
      required: true,
      index: true,
    },
    targetId: {
      type: String,
      index: true,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

activityLogSchema.index({ createdAt: -1 });

export const ActivityLog: Model<IActivityLog> =
  mongoose.models.ActivityLog ?? mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);
