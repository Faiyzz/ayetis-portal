import {
  ALL_NOTIFICATION_TYPES,
  NOTIFICATION_TYPES,
  notificationChannelForType,
  type NotificationDto,
  type NotificationType,
} from '@ayetis/shared';
import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  caseId?: string;
  clarificationId?: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ALL_NOTIFICATION_TYPES,
      default: NOTIFICATION_TYPES.SYSTEM,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    link: { type: String, trim: true },
    caseId: { type: String, trim: true, index: true },
    clarificationId: { type: String, index: true },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification: Model<INotification> =
  mongoose.models.Notification ?? mongoose.model<INotification>('Notification', notificationSchema);

export function toNotificationDto(doc: INotification): NotificationDto {
  return {
    id: doc.id,
    type: doc.type,
    channel: notificationChannelForType(doc.type),
    title: doc.title,
    body: doc.body,
    link: doc.link ?? null,
    caseId: doc.caseId ?? null,
    clarificationId: doc.clarificationId ?? null,
    isRead: doc.isRead,
    createdAt: doc.createdAt.toISOString(),
  };
}
