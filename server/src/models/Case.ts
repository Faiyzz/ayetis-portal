import {
  ALL_ARCH_OPTIONS,
  ALL_ASSIGNMENT_MODES,
  ALL_CASE_PRIORITIES,
  ALL_CASE_STATUSES,
  ALL_FILE_CATEGORIES,
  ALL_PAYMENT_STATUSES,
  ASSIGNMENT_MODES,
  CASE_PRIORITIES,
  CASE_STATUSES,
  EMPTY_TREATMENT_INSTRUCTIONS,
  FILE_CATEGORIES,
  PAYMENT_STATUSES,
  type ArchOption,
  type AssignmentMode,
  type CasePriority,
  type CaseStatus,
  type FileCategory,
  type PaymentStatus,
  type TreatmentInstructions,
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
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  category: FileCategory;
  storageKey: string;
  uploadedById?: Types.ObjectId;
  uploadedByName: string;
  version: number;
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

export interface ICasePayment {
  status: PaymentStatus;
  currency: string;
  amountDue?: number;
  amountPaid?: number;
  invoiceNumber: string;
  notes: string;
  updatedAt?: Date;
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
  treatmentInstructions: TreatmentInstructions;
  payment: ICasePayment;
  status: CaseStatus;
  priority: CasePriority;
  assignmentMode: AssignmentMode;
  assignedDesignerId?: Types.ObjectId;
  assignedDesignerName?: string;
  validatedAt?: Date;
  validatedById?: Types.ObjectId;
  validatedByName?: string;
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
    originalName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: ALL_FILE_CATEGORIES,
      default: FILE_CATEGORIES.OTHER,
    },
    storageKey: { type: String, required: true },
    uploadedById: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedByName: { type: String, required: true },
    version: { type: Number, default: 1, min: 1 },
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

const treatmentInstructionsSchema = new Schema<TreatmentInstructions>(
  {
    arches: {
      type: String,
      enum: ['', ...ALL_ARCH_OPTIONS],
      default: '',
    },
    applianceType: { type: String, default: '', trim: true },
    treatmentGoal: { type: String, default: '', trim: true },
    biteDetails: { type: String, default: '', trim: true },
    retainers: { type: String, default: '', trim: true },
    specialRequirements: { type: String, default: '', trim: true },
    additionalNotes: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const casePaymentSchema = new Schema<ICasePayment>(
  {
    status: {
      type: String,
      enum: ALL_PAYMENT_STATUSES,
      default: PAYMENT_STATUSES.NOT_BILLED,
    },
    currency: { type: String, default: 'USD', trim: true },
    amountDue: { type: Number, min: 0 },
    amountPaid: { type: Number, min: 0 },
    invoiceNumber: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    updatedAt: { type: Date },
  },
  { _id: false },
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
    treatmentInstructions: {
      type: treatmentInstructionsSchema,
      default: () => ({ ...EMPTY_TREATMENT_INSTRUCTIONS }),
    },
    payment: {
      type: casePaymentSchema,
      default: () => ({
        status: PAYMENT_STATUSES.NOT_BILLED,
        currency: 'USD',
        invoiceNumber: '',
        notes: '',
      }),
    },
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
    assignmentMode: {
      type: String,
      enum: ALL_ASSIGNMENT_MODES,
      default: ASSIGNMENT_MODES.NONE,
      index: true,
    },
    assignedDesignerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    assignedDesignerName: { type: String },
    validatedAt: { type: Date, index: true },
    validatedById: { type: Schema.Types.ObjectId, ref: 'User' },
    validatedByName: { type: String },
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

export type { ArchOption };
