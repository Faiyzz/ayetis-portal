import {
  ALL_ARCH_OPTIONS,
  ALL_ASSIGNMENT_MODES,
  ALL_CASE_CATEGORIES,
  ALL_CASE_PRIORITIES,
  ALL_CASE_STATUSES,
  ALL_CASE_TYPES,
  ALL_CONSULTANT_INDICATORS,
  ALL_CUT_ASSIGNMENT_MODES,
  ALL_CUT_PHASES,
  ALL_DOCTOR_DECISIONS,
  ALL_FILE_CATEGORIES,
  ALL_PAYMENT_STATUSES,
  ALL_QC_ERROR_CODES,
  ALL_FILE_RESTORE_STATUSES,
  ALL_FILE_STORAGE_TIERS,
  ASSIGNMENT_MODES,
  CASE_PRIORITIES,
  CASE_STATUSES,
  CASE_CATEGORIES,
  CASE_TYPES,
  CUT_ASSIGNMENT_MODES,
  CUT_PHASES,
  EMPTY_CASE_COMMERCIAL,
  EMPTY_CLINICAL_PREFERENCES,
  EMPTY_IMPLANT_DETAILS,
  EMPTY_OCCLUSION_GOALS,
  EMPTY_PROSTHO_DETAILS,
  EMPTY_RECORDS_NUMBERING,
  EMPTY_TREATMENT_INSTRUCTIONS,
  FILE_CATEGORIES,
  FILE_RESTORE_STATUSES,
  FILE_STORAGE_TIERS,
  PAYMENT_STATUSES,
  QC_REVIEW_OUTCOMES,
  type ArchOption,
  type AssignmentMode,
  type CaseCategory,
  type CaseCommercial,
  type CasePriority,
  type CaseStatus,
  type CaseType,
  type ClinicalPreferences,
  type ImplantDetails,
  type OcclusionGoals,
  type ProsthoDetails,
  type RecordsNumbering,
  type ConsultantIndicator,
  type DoctorDecision,
  type FileCategory,
  type FileRestoreStatus,
  type FileStorageTier,
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
  viewUrl?: string;
  extractedFrom?: string;
  uploadedById?: Types.ObjectId;
  uploadedByName: string;
  version: number;
  note?: string;
  createdAt: Date;
  scanStatus?: 'skipped' | 'clean' | 'infected' | 'error';
  scanMessage?: string;
  storageTier: FileStorageTier;
  restoreStatus: FileRestoreStatus;
  hotUntil?: Date;
  coldSince?: Date;
  lastAccessedAt?: Date;
  restoreRequestedAt?: Date;
  restoreError?: string;
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
  storageTier?: FileStorageTier;
  restoreStatus?: FileRestoreStatus;
  hotUntil?: Date;
  coldSince?: Date;
  lastAccessedAt?: Date;
  restoreRequestedAt?: Date;
  restoreError?: string;
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
  /** Business Doctor ID (DR-########) for privacy-scoped display */
  doctorDisplayId?: string;
  doctorEmail: string;
  organizationId?: Types.ObjectId;
  facilityId?: Types.ObjectId;
  corporateCustomerId?: string;
  caseCategory?: CaseCategory;
  caseType?: CaseType;
  chiefComplaint?: string;
  practiceName?: string;
  patientDateOfBirth?: Date;
  recordsNumbering?: RecordsNumbering;
  clinicalPreferences?: ClinicalPreferences;
  occlusionGoals?: OcclusionGoals;
  prosthoDetails?: ProsthoDetails;
  implantDetails?: ImplantDetails;
  commercial?: CaseCommercial;
  submittedAt?: Date;
  slaHours?: number;
  slaDeadlineAt?: Date;
  /** Set when SLA Warning notification was sent (once per case). */
  slaWarningNotifiedAt?: Date;
  /** Set when SLA Breach notification was sent (once per case). */
  slaBreachNotifiedAt?: Date;
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
  cutRequired: boolean;
  cutPhase: import('@ayetis/shared').CutPhase;
  cutAssignmentMode: import('@ayetis/shared').CutAssignmentMode;
  assignedCutOperatorId?: Types.ObjectId;
  assignedCutOperatorName?: string;
  cutStartedAt?: Date;
  cutSubmittedAt?: Date;
  cutCompletedAt?: Date;
  cutNotes: string;
  cutInternalComments: Array<{
    _id: Types.ObjectId;
    body: string;
    authorId: Types.ObjectId;
    authorName: string;
    createdAt: Date;
  }>;
  cutRevisions: Array<{
    _id: Types.ObjectId;
    revision: number;
    reason: string;
    comments: string;
    requestedById: Types.ObjectId;
    requestedByName: string;
    requestedByRole: string;
    requestedAt: Date;
    completedAt?: Date;
  }>;
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
  /** Status before the latest unacknowledged change (doctor dual Status/Updated-Status columns). */
  previousStatusForAck?: CaseStatus;
  statusPendingDoctorAck: boolean;
  cancelReason?: string;
  notes: ICaseNote[];
  files: ICaseFile[];
  history: ICaseHistory[];
  isDeleted: boolean;
  deletedAt?: Date;
  deletedById?: Types.ObjectId;
  deletedByName?: string;
  deleteReason?: string;
  isDemo: boolean;
  invoiceId?: Types.ObjectId;
  paymentSessionId?: Types.ObjectId;
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
    viewUrl: { type: String, trim: true },
    extractedFrom: { type: String, trim: true },
    uploadedById: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedByName: { type: String, required: true },
    version: { type: Number, default: 1, min: 1 },
    note: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
    scanStatus: { type: String, enum: ['skipped', 'clean', 'infected', 'error'], default: 'skipped' },
    scanMessage: { type: String, trim: true },
    storageTier: {
      type: String,
      enum: ALL_FILE_STORAGE_TIERS,
      default: FILE_STORAGE_TIERS.HOT,
    },
    restoreStatus: {
      type: String,
      enum: ALL_FILE_RESTORE_STATUSES,
      default: FILE_RESTORE_STATUSES.NONE,
    },
    hotUntil: { type: Date },
    coldSince: { type: Date },
    lastAccessedAt: { type: Date },
    restoreRequestedAt: { type: Date },
    restoreError: { type: String, trim: true },
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
    storageTier: {
      type: String,
      enum: ALL_FILE_STORAGE_TIERS,
      default: FILE_STORAGE_TIERS.HOT,
    },
    restoreStatus: {
      type: String,
      enum: ALL_FILE_RESTORE_STATUSES,
      default: FILE_RESTORE_STATUSES.NONE,
    },
    hotUntil: { type: Date },
    coldSince: { type: Date },
    lastAccessedAt: { type: Date },
    restoreRequestedAt: { type: Date },
    restoreError: { type: String, trim: true },
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
    doctorDisplayId: { type: String, trim: true, index: true },
    doctorEmail: { type: String, required: true, lowercase: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facility', index: true },
    corporateCustomerId: { type: String, trim: true, index: true },
    caseCategory: { type: String, enum: ALL_CASE_CATEGORIES, index: true },
    caseType: { type: String, enum: ALL_CASE_TYPES, index: true },
    chiefComplaint: { type: String, default: '', trim: true },
    practiceName: { type: String, default: '', trim: true },
    patientDateOfBirth: { type: Date },
    recordsNumbering: { type: Schema.Types.Mixed, default: () => ({ ...EMPTY_RECORDS_NUMBERING }) },
    clinicalPreferences: { type: Schema.Types.Mixed, default: () => ({ ...EMPTY_CLINICAL_PREFERENCES }) },
    occlusionGoals: { type: Schema.Types.Mixed, default: () => ({ ...EMPTY_OCCLUSION_GOALS }) },
    prosthoDetails: { type: Schema.Types.Mixed, default: () => ({ ...EMPTY_PROSTHO_DETAILS }) },
    implantDetails: { type: Schema.Types.Mixed, default: () => ({ ...EMPTY_IMPLANT_DETAILS }) },
    commercial: { type: Schema.Types.Mixed, default: () => ({ ...EMPTY_CASE_COMMERCIAL }) },
    submittedAt: { type: Date, index: true },
    slaHours: { type: Number },
    slaDeadlineAt: { type: Date, index: true },
    slaWarningNotifiedAt: { type: Date },
    slaBreachNotifiedAt: { type: Date },
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
      default: CASE_STATUSES.NEW_CASE,
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
    cutRequired: { type: Boolean, default: false, index: true },
    cutPhase: {
      type: String,
      enum: ALL_CUT_PHASES,
      default: CUT_PHASES.NONE,
      index: true,
    },
    cutAssignmentMode: {
      type: String,
      enum: ALL_CUT_ASSIGNMENT_MODES,
      default: CUT_ASSIGNMENT_MODES.NONE,
      index: true,
    },
    assignedCutOperatorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    assignedCutOperatorName: { type: String },
    cutStartedAt: { type: Date },
    cutSubmittedAt: { type: Date },
    cutCompletedAt: { type: Date },
    cutNotes: { type: String, default: '', trim: true },
    cutInternalComments: {
      type: [
        {
          body: { type: String, required: true, trim: true },
          authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          authorName: { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    cutRevisions: {
      type: [
        {
          revision: { type: Number, required: true },
          reason: { type: String, required: true, trim: true },
          comments: { type: String, default: '', trim: true },
          requestedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          requestedByName: { type: String, required: true },
          requestedByRole: { type: String, required: true },
          requestedAt: { type: Date, default: Date.now },
          completedAt: { type: Date },
        },
      ],
      default: [],
    },
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
    previousStatusForAck: { type: String, enum: ALL_CASE_STATUSES },
    statusPendingDoctorAck: { type: Boolean, default: false, index: true },
    cancelReason: { type: String },
    notes: { type: [caseNoteSchema], default: [] },
    files: { type: [caseFileSchema], default: [] },
    history: { type: [caseHistorySchema], default: [] },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedById: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedByName: { type: String },
    deleteReason: { type: String },
    isDemo: { type: Boolean, default: false, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', index: true },
    paymentSessionId: { type: Schema.Types.ObjectId, ref: 'PaymentSession', index: true },
  },
  { timestamps: true },
);

caseSchema.index({ createdAt: -1 });
caseSchema.index({ status: 1, priority: 1, createdAt: -1 });
caseSchema.index({ status: 1, submittedToQcAt: -1 });
caseSchema.index({ escalatedForOversight: 1, updatedAt: -1 });
caseSchema.index({ assignedConsultantId: 1, updatedAt: -1 });
caseSchema.index({ consultantIndicator: 1, updatedAt: -1 });
caseSchema.index({ cutPhase: 1, cutAssignmentMode: 1, assignedCutOperatorId: 1 });
caseSchema.index({ organizationId: 1, createdAt: -1 });
caseSchema.index({ doctorId: 1, createdAt: -1 });
caseSchema.index({ assignedDesignerId: 1, status: 1 });
caseSchema.index({ slaDeadlineAt: 1, status: 1 });

caseSchema.post('init', function trackStatusBaseline(doc) {
  (doc as ICase & { _statusBaseline?: string })._statusBaseline = doc.status;
});

caseSchema.pre('save', function trackDoctorStatusAck(next) {
  const self = this as ICase & {
    _statusBaseline?: string;
    $locals?: { statusNotify?: { from: string; to: string; caseId: string; doctorId: string } };
  };
  if (!self.isNew && self.isModified('status')) {
    const from = self._statusBaseline;
    const to = self.status;
    if (from && from !== to) {
      if (!self.statusPendingDoctorAck) {
        self.previousStatusForAck = from as CaseStatus;
      }
      self.statusPendingDoctorAck = true;
      self.$locals = self.$locals ?? {};
      self.$locals.statusNotify = {
        from: String(self.previousStatusForAck ?? from),
        to: String(to),
        caseId: self.caseId,
        doctorId: String(self.doctorId),
      };
    }
  }
  next();
});

caseSchema.post('save', function resetStatusBaseline(doc) {
  const typed = doc as ICase & {
    _statusBaseline?: string;
    $locals?: { statusNotify?: { from: string; to: string; caseId: string; doctorId: string } };
  };
  typed._statusBaseline = doc.status;
  const notify = typed.$locals?.statusNotify;
  if (notify?.doctorId) {
    void import('../features/notifications/notifications.service')
      .then(({ createNotification }) =>
        import('@ayetis/shared').then(({ CASE_STATUS_LABELS, NOTIFICATION_TYPES }) =>
          createNotification({
            userId: notify.doctorId,
            type: NOTIFICATION_TYPES.CASE_STATUS_CHANGED,
            title: 'Case status updated',
            body: `Case ${notify.caseId}: ${CASE_STATUS_LABELS[notify.from as keyof typeof CASE_STATUS_LABELS] ?? notify.from} → ${CASE_STATUS_LABELS[notify.to as keyof typeof CASE_STATUS_LABELS] ?? notify.to}`,
            link: `/app/cases/${notify.caseId}`,
            caseId: notify.caseId,
          }),
        ),
      )
      .catch((err) => console.error('[case] status notify failed', err));
    delete typed.$locals?.statusNotify;
  }
});

export const Case: Model<ICase> = mongoose.models.Case ?? mongoose.model<ICase>('Case', caseSchema);

export type { ArchOption };
