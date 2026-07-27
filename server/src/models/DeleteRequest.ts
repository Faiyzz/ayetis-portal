import {
  ALL_DELETE_RECORD_TYPES,
  ALL_DELETE_REQUEST_STATUSES,
  DELETE_REQUEST_STATUSES,
  type DeleteRecordType,
  type DeleteRequestStatus,
} from '@ayetis/shared';
import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IDeleteRequest extends Document {
  recordType: DeleteRecordType;
  recordId: string;
  recordLabel: string;
  caseId?: string;
  reason: string;
  status: DeleteRequestStatus;
  requestedById: Types.ObjectId;
  requestedByName: string;
  requestedByEmail: string;
  reviewedById?: Types.ObjectId;
  reviewedByName?: string;
  reviewNote?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const deleteRequestSchema = new Schema<IDeleteRequest>(
  {
    recordType: { type: String, enum: ALL_DELETE_RECORD_TYPES, required: true, index: true },
    recordId: { type: String, required: true, index: true },
    recordLabel: { type: String, required: true },
    caseId: { type: String, trim: true, index: true },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ALL_DELETE_REQUEST_STATUSES,
      default: DELETE_REQUEST_STATUSES.PENDING,
      index: true,
    },
    requestedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestedByName: { type: String, required: true },
    requestedByEmail: { type: String, required: true },
    reviewedById: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedByName: { type: String },
    reviewNote: { type: String, trim: true },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

deleteRequestSchema.index({ status: 1, createdAt: -1 });

export const DeleteRequest: Model<IDeleteRequest> =
  mongoose.models.DeleteRequest ??
  mongoose.model<IDeleteRequest>('DeleteRequest', deleteRequestSchema);
