import {
  ALL_COMPLAINT_STATUSES,
  ALL_COMPLAINT_TYPES,
  COMPLAINT_STATUSES,
  type ComplaintStatus,
  type ComplaintType,
} from '@ayetis/shared';
import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IComplaint extends Document {
  complaintCode: string;
  details: string;
  caseId?: string;
  doctorId?: Types.ObjectId;
  doctorName?: string;
  responsibleEmployeeId?: Types.ObjectId;
  responsibleEmployeeName?: string;
  responsibleQcId?: Types.ObjectId;
  responsibleQcName?: string;
  responsibleConsultantId?: Types.ObjectId;
  responsibleConsultantName?: string;
  responsibleSupervisorId?: Types.ObjectId;
  responsibleSupervisorName?: string;
  type: ComplaintType;
  status: ComplaintStatus;
  rating?: number;
  additionalComments: string;
  createdById: Types.ObjectId;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const complaintSchema = new Schema<IComplaint>(
  {
    complaintCode: { type: String, required: true, unique: true, index: true },
    details: { type: String, required: true, trim: true },
    caseId: { type: String, trim: true, index: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    doctorName: { type: String },
    responsibleEmployeeId: { type: Schema.Types.ObjectId, ref: 'User' },
    responsibleEmployeeName: { type: String },
    responsibleQcId: { type: Schema.Types.ObjectId, ref: 'User' },
    responsibleQcName: { type: String },
    responsibleConsultantId: { type: Schema.Types.ObjectId, ref: 'User' },
    responsibleConsultantName: { type: String },
    responsibleSupervisorId: { type: Schema.Types.ObjectId, ref: 'User' },
    responsibleSupervisorName: { type: String },
    type: { type: String, enum: ALL_COMPLAINT_TYPES, required: true, index: true },
    status: {
      type: String,
      enum: ALL_COMPLAINT_STATUSES,
      default: COMPLAINT_STATUSES.OPEN,
      index: true,
    },
    rating: { type: Number, min: 1, max: 5 },
    additionalComments: { type: String, default: '', trim: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true },
);

export const Complaint: Model<IComplaint> =
  mongoose.models.Complaint ?? mongoose.model<IComplaint>('Complaint', complaintSchema);
