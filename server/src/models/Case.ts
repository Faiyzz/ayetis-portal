import {
  ALL_ARCH_OPTIONS,
  ALL_ASSIGNMENT_MODES,
  ALL_CASE_PRIORITIES,
  ALL_CASE_STATUSES,
  ALL_CONSULTANT_INDICATORS,
  ALL_DOCTOR_DECISIONS,
  ALL_FILE_CATEGORIES,
  ALL_PAYMENT_STATUSES,
  ALL_QC_ERROR_CODES,
  ASSIGNMENT_MODES,
  CASE_PRIORITIES,
  CASE_STATUSES,
  EMPTY_TREATMENT_INSTRUCTIONS,
  FILE_CATEGORIES,
  PAYMENT_STATUSES,
  QC_REVIEW_OUTCOMES,
  type ArchOption,
  type AssignmentMode,
  type CasePriority,
  type CaseStatus,
  type ConsultantIndicator,
  type DoctorDecision,
  type FileCategory,
  type PaymentStatus,
  type QcErrorCode,
  type QcReviewOutcome,
  type TreatmentInstructions,
} from '@ayetis/shared';
import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

const ALL_QC_REVIEW_OUTCOMES = Object.values(QC_REVIEW_OUTCOMES);

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

export interface IQcReview {
  _id: Types.ObjectId;
  outcome: QcReviewOutcome;
  errorCode?: QcErrorCode;
  comments: string;
  requiredChanges: string;
  reviewerId: Types.ObjectId;
  reviewerName: string;
  deliveryViewLink?: string;
  deliveryVideoFilename?: string;
  deliveryVideoStorageKey?: string;
  createdAt: Date;
}

export interface ICaseDelivery {
  viewLink: string;
  videoFilename?: string;
  videoStorageKey?: string;
  uploadedAt?: Date;
  uploadedById?: Types.ObjectId;
  uploadedByName?: string;
}

export interface IClinicalRemark {
  _id: Types.ObjectId;
  body: string;
  indicator: ConsultantIndicator;
  authorId: Types.ObjectId;
  authorName: string;
  createdAt: Date;
}

export interface IDoctorEngagement {
  openedAt?: Date;
  videoViewedAt?: Date;
  respondedAt?: Date;
  filesDownloadedAt?: Date;
  lastViewedAt?: Date;
  viewedWithoutActionNotifiedAt?: Date;
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
  assignedConsultantId?: Types.ObjectId;
  assignedConsultantName?: string;
  validatedAt?: Date;
  validatedById?: Types.ObjectId;
  validatedByName?: string;
  productionStartedAt?: Date;
  productionStartedById?: Types.ObjectId;
  productionStartedByName?: string;
  submittedToQcAt?: Date;
  submittedToQcById?: Types.ObjectId;
  submittedToQcByName?: string;
  productionNotes: string;
  qcRejectionCount: number;
  escalatedForOversight: boolean;
  escalatedAt?: Date;
  lastQcErrorCode?: QcErrorCode;
  lastQcComments?: string;
  lastQcRequiredChanges?: string;
  delivery?: ICaseDelivery;
  qcReviews: IQcReview[];
  clinicalRemarks: IClinicalRemark[];
  consultantIndicator?: ConsultantIndicator;
  consultantReviewedAt?: Date;
  doctorDecision?: DoctorDecision;
  doctorDecisionNote?: string;
  doctorDecisionAt?: Date;
  doctorEngagement: IDoctorEngagement;
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

const qcReviewSchema = new Schema<IQcReview>(
  {
    outcome: {
      type: String,
      enum: ALL_QC_REVIEW_OUTCOMES,
      required: true,
    },
    errorCode: {
      type: String,
      enum: ALL_QC_ERROR_CODES,
    },
    comments: { type: String, default: '', trim: true },
    requiredChanges: { type: String, default: '', trim: true },
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reviewerName: { type: String, required: true },
    deliveryViewLink: { type: String, trim: true },
    deliveryVideoFilename: { type: String, trim: true },
    deliveryVideoStorageKey: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const caseDeliverySchema = new Schema<ICaseDelivery>(
  {
    viewLink: { type: String, default: '', trim: true },
    videoFilename: { type: String, trim: true },
    videoStorageKey: { type: String, trim: true },
    uploadedAt: { type: Date },
    uploadedById: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedByName: { type: String },
  },
  { _id: false },
);

const clinicalRemarkSchema = new Schema<IClinicalRemark>(
  {
    body: { type: String, required: true, trim: true },
    indicator: {
      type: String,
      enum: ALL_CONSULTANT_INDICATORS,
      required: true,
    },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const doctorEngagementSchema = new Schema<IDoctorEngagement>(
  {
    openedAt: { type: Date },
    videoViewedAt: { type: Date },
    respondedAt: { type: Date },
    filesDownloadedAt: { type: Date },
    lastViewedAt: { type: Date },
    viewedWithoutActionNotifiedAt: { type: Date },
  },
  { _id: false },
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
    assignedConsultantId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    assignedConsultantName: { type: String },
    validatedAt: { type: Date, index: true },
    validatedById: { type: Schema.Types.ObjectId, ref: 'User' },
    validatedByName: { type: String },
    productionStartedAt: { type: Date, index: true },
    productionStartedById: { type: Schema.Types.ObjectId, ref: 'User' },
    productionStartedByName: { type: String },
    submittedToQcAt: { type: Date },
    submittedToQcById: { type: Schema.Types.ObjectId, ref: 'User' },
    submittedToQcByName: { type: String },
    productionNotes: { type: String, default: '', trim: true },
    qcRejectionCount: { type: Number, default: 0, min: 0, index: true },
    escalatedForOversight: { type: Boolean, default: false, index: true },
    escalatedAt: { type: Date },
    lastQcErrorCode: { type: String, enum: ALL_QC_ERROR_CODES },
    lastQcComments: { type: String, trim: true },
    lastQcRequiredChanges: { type: String, trim: true },
    delivery: { type: caseDeliverySchema },
    qcReviews: { type: [qcReviewSchema], default: [] },
    clinicalRemarks: { type: [clinicalRemarkSchema], default: [] },
    consultantIndicator: { type: String, enum: ALL_CONSULTANT_INDICATORS, index: true },
    consultantReviewedAt: { type: Date },
    doctorDecision: { type: String, enum: ALL_DOCTOR_DECISIONS },
    doctorDecisionNote: { type: String, trim: true },
    doctorDecisionAt: { type: Date },
    doctorEngagement: {
      type: doctorEngagementSchema,
      default: () => ({}),
    },
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
caseSchema.index({ status: 1, submittedToQcAt: -1 });
caseSchema.index({ escalatedForOversight: 1, updatedAt: -1 });
caseSchema.index({ assignedConsultantId: 1, updatedAt: -1 });
caseSchema.index({ consultantIndicator: 1, updatedAt: -1 });

export const Case: Model<ICase> = mongoose.models.Case ?? mongoose.model<ICase>('Case', caseSchema);

export type { ArchOption };
