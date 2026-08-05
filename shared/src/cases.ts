import type { ClarificationDto } from './clarifications';
import type {
  ClinicalRemarkDto,
  ConsultantIndicator,
  DoctorDecision,
  DoctorEngagementDto,
} from './consultation';
import type {
  AssignmentMode,
  CaseValidationSummary,
  CoordinatorQueue,
  DelayLevel,
} from './coordinator';
import type { CaseDeliveryDto, QcErrorCode, QcReviewDto } from './qc';
import type {
  CasePaymentOverview,
  PaymentStatus,
  TreatmentInstructions,
} from './treatment';

export const CASE_STATUSES = {
  NEW_CASE: 'new_case',
  IN_PROCESS: 'in_process',
  WAITING_FOR_APPROVAL: 'waiting_for_approval',
  APPROVED: 'approved',
  CANCELLED: 'cancelled',
  SAVED_FOR_SUBMISSION: 'saved_for_submission',
} as const;

export type CaseStatus = (typeof CASE_STATUSES)[keyof typeof CASE_STATUSES];

export const ALL_CASE_STATUSES: CaseStatus[] = Object.values(CASE_STATUSES);

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  [CASE_STATUSES.NEW_CASE]: 'New Case',
  [CASE_STATUSES.IN_PROCESS]: 'In Process',
  [CASE_STATUSES.WAITING_FOR_APPROVAL]: 'Waiting for Approval',
  [CASE_STATUSES.APPROVED]: 'Approved',
  [CASE_STATUSES.CANCELLED]: 'Cancelled',
  [CASE_STATUSES.SAVED_FOR_SUBMISSION]: 'Saved for Submission',
};

/** Primary happy-path stages shown on the visual timeline (URD doctor lifecycle). */
export const CASE_TIMELINE_STATUSES: CaseStatus[] = [
  CASE_STATUSES.NEW_CASE,
  CASE_STATUSES.IN_PROCESS,
  CASE_STATUSES.WAITING_FOR_APPROVAL,
  CASE_STATUSES.APPROVED,
];

/** Maps statuses onto the nearest timeline stage for visualization. */
export const CASE_STATUS_TIMELINE_ANCHOR: Record<CaseStatus, CaseStatus> = {
  [CASE_STATUSES.SAVED_FOR_SUBMISSION]: CASE_STATUSES.NEW_CASE,
  [CASE_STATUSES.NEW_CASE]: CASE_STATUSES.NEW_CASE,
  [CASE_STATUSES.IN_PROCESS]: CASE_STATUSES.IN_PROCESS,
  [CASE_STATUSES.WAITING_FOR_APPROVAL]: CASE_STATUSES.WAITING_FOR_APPROVAL,
  [CASE_STATUSES.APPROVED]: CASE_STATUSES.APPROVED,
  [CASE_STATUSES.CANCELLED]: CASE_STATUSES.CANCELLED,
};

export type TimelineStepState = 'complete' | 'current' | 'upcoming' | 'cancelled';

export interface TimelineStep {
  status: CaseStatus;
  label: string;
  state: TimelineStepState;
}

export function buildCaseTimeline(currentStatus: CaseStatus): TimelineStep[] {
  if (currentStatus === CASE_STATUSES.CANCELLED) {
    return CASE_TIMELINE_STATUSES.map((status, index) => ({
      status,
      label: CASE_STATUS_LABELS[status],
      state: index === 0 ? 'complete' : 'cancelled',
    }));
  }

  if (currentStatus === CASE_STATUSES.SAVED_FOR_SUBMISSION) {
    return CASE_TIMELINE_STATUSES.map((status, index) => ({
      status,
      label: CASE_STATUS_LABELS[status],
      state: index === 0 ? 'current' : 'upcoming',
    }));
  }

  const anchor = CASE_STATUS_TIMELINE_ANCHOR[currentStatus];
  const currentIndex = CASE_TIMELINE_STATUSES.indexOf(anchor);

  return CASE_TIMELINE_STATUSES.map((status, index) => {
    let state: TimelineStepState = 'upcoming';
    if (index < currentIndex) state = 'complete';
    if (index === currentIndex) state = 'current';
    return {
      status,
      label: CASE_STATUS_LABELS[status],
      state,
    };
  });
}

export const CASE_PRIORITIES = {
  NORMAL: 'normal',
  URGENT: 'urgent',
} as const;

export type CasePriority = (typeof CASE_PRIORITIES)[keyof typeof CASE_PRIORITIES];

export const ALL_CASE_PRIORITIES: CasePriority[] = Object.values(CASE_PRIORITIES);

export const CASE_PRIORITY_LABELS: Record<CasePriority, string> = {
  [CASE_PRIORITIES.NORMAL]: 'Normal',
  [CASE_PRIORITIES.URGENT]: 'Urgent',
};

export const FILE_CATEGORIES = {
  STL: 'stl',
  SCAN: 'scan',
  PHOTO: 'photo',
  XRAY: 'xray',
  PDF: 'pdf',
  VIDEO: 'video',
  MODEL: 'model',
  OTHER: 'other',
} as const;

export type FileCategory = (typeof FILE_CATEGORIES)[keyof typeof FILE_CATEGORIES];

export const ALL_FILE_CATEGORIES: FileCategory[] = Object.values(FILE_CATEGORIES);

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  [FILE_CATEGORIES.STL]: 'STL',
  [FILE_CATEGORIES.SCAN]: 'Scan',
  [FILE_CATEGORIES.PHOTO]: 'Photo',
  [FILE_CATEGORIES.XRAY]: 'X-ray',
  [FILE_CATEGORIES.PDF]: 'PDF',
  [FILE_CATEGORIES.VIDEO]: 'Video',
  [FILE_CATEGORIES.MODEL]: '3D model',
  [FILE_CATEGORIES.OTHER]: 'Other',
};

/** Extensions accepted for case file uploads (plus image/* and video/* mime families). */
export const ALLOWED_UPLOAD_EXTENSIONS = [
  '.stl',
  '.obj',
  '.ply',
  '.dcm',
  '.dicom',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.heic',
  '.bmp',
  '.tif',
  '.tiff',
  '.pdf',
  '.zip',
  '.mp4',
  '.mov',
  '.webm',
  '.avi',
  '.mkv',
  '.html',
  '.htm',
] as const;

export function isAllowedUploadFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ALLOWED_UPLOAD_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export const CASE_FIELD_LABELS: Record<string, string> = {
  patientName: 'Patient name',
  patientAge: 'Patient age',
  patientGender: 'Gender',
  clinicName: 'Clinic',
  country: 'Country',
  treatmentSummary: 'Treatment summary',
  instructions: 'Instructions',
  priority: 'Priority',
  status: 'Status',
};

export interface CaseFileDto {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  category: FileCategory;
  storageKey: string;
  uploadedById: string | null;
  uploadedByName: string;
  version: number;
  createdAt: string;
  note?: string;
  storageTier: import('./storage').FileStorageTier;
  restoreStatus: import('./storage').FileRestoreStatus;
  hotUntil: string | null;
  coldSince: string | null;
  restoreRequestedAt: string | null;
  restoreError: string | null;
}

export interface CaseNoteDto {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface CaseHistoryChange {
  field: string;
  label: string;
  from: unknown;
  to: unknown;
}

export interface CaseHistoryDto {
  id: string;
  action: string;
  summary: string;
  actorId: string | null;
  actorName: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
  changes?: CaseHistoryChange[];
}

export interface CaseListItemDto {
  id: string;
  caseId: string;
  patientName: string;
  patientAge: number | null;
  doctorId: string;
  /** Name for privileged viewers; Doctor ID for everyone else (API-redacted). */
  doctorName: string;
  doctorDisplayId: string | null;
  doctorEmail: string;
  status: CaseStatus;
  priority: CasePriority;
  caseCategory: import('./caseTaxonomy').CaseCategory | null;
  caseType: import('./caseTaxonomy').CaseType | null;
  chiefComplaint: string;
  treatmentSummary: string;
  paymentStatus: PaymentStatus;
  submittedAt: string | null;
  slaHours: number | null;
  slaDeadlineAt: string | null;
  slaUtilizationPercent: number | null;
  slaProgressColor: import('./caseTaxonomy').SlaProgressColor | null;
  cancelWindowRemainingSeconds: number | null;
  openClarificationCount: number;
  assignedDesignerId: string | null;
  assignedDesignerName: string | null;
  assignmentMode: AssignmentMode;
  validatedAt: string | null;
  consultantIndicator: ConsultantIndicator | null;
  queue: CoordinatorQueue | null;
  delayLevel: DelayLevel | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CaseDetailDto extends CaseListItemDto {
  clinicName: string;
  practiceName: string;
  patientGender: string;
  patientDateOfBirth: string | null;
  instructions: string;
  country: string;
  treatmentInstructions: TreatmentInstructions;
  recordsNumbering: import('./treatment').RecordsNumbering | null;
  clinicalPreferences: import('./treatment').ClinicalPreferences | null;
  occlusionGoals: import('./treatment').OcclusionGoals | null;
  commercial: import('./treatment').CaseCommercial | null;
  payment: CasePaymentOverview;
  cancelReason: string | null;
  deletedAt: string | null;
  deletedByName: string | null;
  deleteReason: string | null;
  validatedByName: string | null;
  validation: CaseValidationSummary;
  productionStartedAt: string | null;
  productionStartedByName: string | null;
  submittedToQcAt: string | null;
  submittedToQcByName: string | null;
  productionNotes: string;
  qcRejectionCount: number;
  escalatedForOversight: boolean;
  escalatedAt: string | null;
  lastQcErrorCode: QcErrorCode | null;
  lastQcComments: string | null;
  lastQcRequiredChanges: string | null;
  delivery: CaseDeliveryDto | null;
  qcReviews: QcReviewDto[];
  clinicalRemarks: ClinicalRemarkDto[];
  assignedConsultantId: string | null;
  assignedConsultantName: string | null;
  consultantReviewedAt: string | null;
  doctorDecision: DoctorDecision | null;
  doctorDecisionNote: string | null;
  doctorDecisionAt: string | null;
  doctorEngagement: DoctorEngagementDto;
  notes: CaseNoteDto[];
  files: CaseFileDto[];
  history: CaseHistoryDto[];
  timeline: TimelineStep[];
  clarifications: ClarificationDto[];
}

export interface CaseListResult {
  items: CaseListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateCaseInput {
  patientName: string;
  patientAge?: number | null;
  patientGender?: string;
  patientDateOfBirth?: string | null;
  clinicName?: string;
  practiceName?: string;
  country?: string;
  chiefComplaint?: string;
  caseCategory?: import('./caseTaxonomy').CaseCategory;
  caseType?: import('./caseTaxonomy').CaseType;
  treatmentSummary: string;
  instructions?: string;
  treatmentInstructions?: Partial<TreatmentInstructions>;
  recordsNumbering?: Partial<import('./treatment').RecordsNumbering>;
  clinicalPreferences?: Partial<import('./treatment').ClinicalPreferences>;
  occlusionGoals?: Partial<import('./treatment').OcclusionGoals>;
  commercial?: Partial<import('./treatment').CaseCommercial>;
  priority?: CasePriority;
  initialNote?: string;
  /** Save as draft without starting the 15-minute clock / SLA. */
  asDraft?: boolean;
  /** Treating doctor. Required when the creator is not a doctor. */
  doctorId?: string;
}

export interface UpdateCaseInput {
  patientName?: string;
  patientAge?: number | null;
  patientGender?: string;
  patientDateOfBirth?: string | null;
  clinicName?: string;
  practiceName?: string;
  country?: string;
  chiefComplaint?: string;
  caseCategory?: import('./caseTaxonomy').CaseCategory;
  caseType?: import('./caseTaxonomy').CaseType;
  treatmentSummary?: string;
  instructions?: string;
  treatmentInstructions?: Partial<TreatmentInstructions>;
  recordsNumbering?: Partial<import('./treatment').RecordsNumbering>;
  clinicalPreferences?: Partial<import('./treatment').ClinicalPreferences>;
  occlusionGoals?: Partial<import('./treatment').OcclusionGoals>;
  commercial?: Partial<import('./treatment').CaseCommercial>;
  priority?: CasePriority;
  status?: CaseStatus;
  /** Promote a draft to New Case (starts SLA + cancel window). */
  submitDraft?: boolean;
}

export interface CancelCaseInput {
  reason: string;
  remarks?: string;
}

export interface SoftDeleteCaseInput {
  reason: string;
}

export interface AddCaseNoteInput {
  body: string;
}

export interface SetCasePriorityInput {
  priority: CasePriority;
}

export function isCaseStatus(value: string): value is CaseStatus {
  return (ALL_CASE_STATUSES as string[]).includes(value);
}

export function isCasePriority(value: string): value is CasePriority {
  return (ALL_CASE_PRIORITIES as string[]).includes(value);
}

/**
 * After delivery to doctor (waiting_for_approval) or terminal approved/cancelled,
 * production-side editing is closed. Doctor decision remains allowed on waiting_for_approval.
 * Modification requests move the case back to in_process and unlock again.
 */
export const CASE_DELIVERY_LOCKED_STATUSES: CaseStatus[] = [
  CASE_STATUSES.WAITING_FOR_APPROVAL,
  CASE_STATUSES.APPROVED,
  CASE_STATUSES.CANCELLED,
];

export function isCaseDeliveryLocked(status: CaseStatus): boolean {
  return (CASE_DELIVERY_LOCKED_STATUSES as CaseStatus[]).includes(status);
}

export function isFileCategory(value: string): value is FileCategory {
  return (ALL_FILE_CATEGORIES as string[]).includes(value);
}

export function formatHistoryValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'status' && typeof value === 'string' && isCaseStatus(value)) {
    return CASE_STATUS_LABELS[value];
  }
  if (field === 'priority' && typeof value === 'string' && isCasePriority(value)) {
    return CASE_PRIORITY_LABELS[value];
  }
  return String(value);
}
