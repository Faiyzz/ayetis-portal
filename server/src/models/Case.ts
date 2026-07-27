import {
  ALL_CASE_PRIORITIES,
  ALL_CASE_STATUSES,
  CASE_PRIORITIES,
  CASE_STATUSES,
  type CasePriority,
  type CaseStatus,
} from '@ayetis/shared';
import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface ICaseNote {
  _id: Types.ObjectId;
  body: string;
  authorId: Types.ObjectId;
  authorName: string;
  createdAt: Date;
}

export interface ICaseFile {
  _id: Types.ObjectId;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByName: string;
  note?: string;
  createdAt: Date;
}

export interface ICaseHistory {
  _id: Types.ObjectId;
  action: string;
  summary: string;
  actorId?: Types.ObjectId;
  actorName?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface ICase extends Document {
  caseId: string;
  doctorId: Types.ObjectId;
  doctorName: string;
  doctorEmail: string;
  patientName: string;
  patientAge?: number;
  patientGender: string;
  clinicName: string;
  country: string;
  treatmentSummary: string;
  instructions: string;
  status: CaseStatus;
  priority: CasePriority;
  assignedDesignerId?: Types.ObjectId;
  assignedDesignerName?: string;
  cancelReason?: string;
  notes: ICaseNote[];
  files: ICaseFile[];
  history: ICaseHistory[];
  isDeleted: boolean;
  deletedAt?: Date;
  deletedById?: Types.ObjectId;
  deletedByName?: string;
  deleteReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const caseNoteSchema = new Schema<ICaseNote>(
  {
    body: { type: String, required: true, trim: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const caseFileSchema = new Schema<ICaseFile>(
  {
    filename: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    uploadedByName: { type: String, required: true },
    note: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const caseHistorySchema = new Schema<ICaseHistory>(
  {
    action: { type: String, required: true },
    summary: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const caseSchema = new Schema<ICase>(
  {
    caseId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    doctorName: { type: String, required: true },
    doctorEmail: { type: String, required: true, lowercase: true, index: true },
    patientName: { type: String, required: true, trim: true, index: true },
    patientAge: { type: Number, min: 0, max: 120 },
    patientGender: { type: String, default: '', trim: true },
    clinicName: { type: String, default: '', trim: true },
    country: { type: String, default: '', trim: true },
    treatmentSummary: { type: String, required: true, trim: true },
    instructions: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ALL_CASE_STATUSES,
      default: CASE_STATUSES.SUBMITTED,
      index: true,
    },
    priority: {
      type: String,
      enum: ALL_CASE_PRIORITIES,
      default: CASE_PRIORITIES.NORMAL,
      index: true,
    },
    assignedDesignerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    assignedDesignerName: { type: String },
    cancelReason: { type: String },
    notes: { type: [caseNoteSchema], default: [] },
    files: { type: [caseFileSchema], default: [] },
    history: { type: [caseHistorySchema], default: [] },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedById: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedByName: { type: String },
    deleteReason: { type: String },
  },
  { timestamps: true },
);

caseSchema.index({ createdAt: -1 });
caseSchema.index({ status: 1, priority: 1, createdAt: -1 });

export const Case: Model<ICase> = mongoose.models.Case ?? mongoose.model<ICase>('Case', caseSchema);
