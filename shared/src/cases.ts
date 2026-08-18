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
  [CASE_STATUSES.SAVED_FOR_SUBMISSION]: 'Draft',
};

export function isCaseDraft(status: CaseStatus): boolean {
  return status === CASE_STATUSES.SAVED_FOR_SUBMISSION;
}

/** Prefix draft cases so they are obvious in lists and headers. */
export function formatCaseIdLabel(caseId: string, status?: CaseStatus | null): string {
  return status && isCaseDraft(status) ? `Draft ${caseId}` : caseId;
}

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
  DICOM: 'dicom',
  PHOTO: 'photo',
  XRAY: 'xray',
  PDF: 'pdf',
  VIDEO: 'video',
  MODEL: 'model',
  HTML_LINK: 'html_link',
  ARCHIVE: 'archive',
  CUT: 'cut',
  OTHER: 'other',
} as const;

export type FileCategory = (typeof FILE_CATEGORIES)[keyof typeof FILE_CATEGORIES];

export const ALL_FILE_CATEGORIES: FileCategory[] = Object.values(FILE_CATEGORIES);

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  [FILE_CATEGORIES.STL]: 'STL',
  [FILE_CATEGORIES.SCAN]: 'Scan',
  [FILE_CATEGORIES.DICOM]: 'DICOM',
  [FILE_CATEGORIES.PHOTO]: 'Photo',
  [FILE_CATEGORIES.XRAY]: 'X-ray / OPG / CBCT',
  [FILE_CATEGORIES.PDF]: 'PDF',
  [FILE_CATEGORIES.VIDEO]: 'Video',
  [FILE_CATEGORIES.MODEL]: '3D model',
  [FILE_CATEGORIES.HTML_LINK]: 'HTML viewer link',
  [FILE_CATEGORIES.ARCHIVE]: 'Archive',
  [FILE_CATEGORIES.CUT]: 'Cut output',
  [FILE_CATEGORIES.OTHER]: 'Other',
};

/** Archive formats that are auto-extracted on upload (URD §7.1). */
export const ARCHIVE_UPLOAD_EXTENSIONS = ['.zip', '.rar', '.7z'] as const;

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
  '.rar',
  '.7z',
  '.mp4',
  '.mov',
  '.webm',
  '.avi',
  '.mkv',
  '.wmv',
  '.html',
  '.htm',
  '.txt',
  '.csv',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
] as const;

export function getFilenameExtension(filename: string): string {
  const lower = filename.toLowerCase().trim();
  const idx = lower.lastIndexOf('.');
  if (idx < 0) return '';
  return lower.slice(idx);
}

export function isArchiveFilename(filename: string): boolean {
  const ext = getFilenameExtension(filename);
  return (ARCHIVE_UPLOAD_EXTENSIONS as readonly string[]).includes(ext);
}

export function isAllowedUploadFilename(filename: string): boolean {
  const ext = getFilenameExtension(filename);
  return (ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * URD: STL files extracted from archives are digital scan files.
 * Standalone STL uploads keep the STL category for clarity.
 */
export function classifyUploadFile(
  originalName: string,
  mimeType = '',
  options: { fromArchive?: boolean; explicit?: string } = {},
): FileCategory {
  if (options.explicit && isFileCategory(options.explicit)) {
    return options.explicit;
  }

  const lower = originalName.toLowerCase();
  const mime = mimeType.toLowerCase();

  if (lower.endsWith('.stl') || mime.includes('stl') || mime.includes('sla')) {
    return options.fromArchive ? FILE_CATEGORIES.SCAN : FILE_CATEGORIES.STL;
  }
  if (lower.endsWith('.dcm') || lower.endsWith('.dicom') || mime.includes('dicom')) {
    return FILE_CATEGORIES.DICOM;
  }
  if (lower.endsWith('.obj') || lower.endsWith('.ply') || mime.includes('model')) {
    return FILE_CATEGORIES.MODEL;
  }
  if (lower.endsWith('.pdf') || mime === 'application/pdf') {
    return FILE_CATEGORIES.PDF;
  }
  if (
    mime.startsWith('video/') ||
    /\.(mp4|mov|webm|avi|mkv|wmv)$/i.test(lower)
  ) {
    return FILE_CATEGORIES.VIDEO;
  }
  if (isArchiveFilename(originalName)) {
    return FILE_CATEGORIES.ARCHIVE;
  }
  if (
    mime.startsWith('image/') ||
    /\.(jpe?g|png|gif|webp|heic|bmp|tiff?)$/i.test(lower)
  ) {
    if (/x[-_]?ray|radiograph|opg|cbct|ceph/i.test(lower)) return FILE_CATEGORIES.XRAY;
    return FILE_CATEGORIES.PHOTO;
  }
  if (/x[-_]?ray|radiograph|opg|cbct|ceph/i.test(lower)) return FILE_CATEGORIES.XRAY;
  if (lower.includes('scan')) return FILE_CATEGORIES.SCAN;
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return FILE_CATEGORIES.HTML_LINK;
  return FILE_CATEGORIES.OTHER;
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
  /** Present for HTML viewer link records (no binary payload). */
  viewUrl: string | null;
  /** Archive path when this member was extracted from ZIP/RAR/7Z. */
  extractedFrom: string | null;
  uploadedById: string | null;
  uploadedByName: string;
  version: number;
  createdAt: string;
  note?: string;
  /** Malware scan result when scan hook is enabled. */
  scanStatus?: 'skipped' | 'clean' | 'infected' | 'error';
  scanMessage?: string;
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
  organizationId: string | null;
  facilityId: string | null;
  corporateCustomerId: string | null;
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
  clarificationButtonState: import('./clarifications').ClarificationButtonState;
  assignedDesignerId: string | null;
  assignedDesignerName: string | null;
  assignmentMode: AssignmentMode;
  cutRequired: boolean;
  cutPhase: import('./cut').CutPhase;
  cutAssignmentMode: import('./cut').CutAssignmentMode;
  assignedCutOperatorId: string | null;
  assignedCutOperatorName: string | null;
  workflowLabel: string;
  validatedAt: string | null;
  consultantIndicator: ConsultantIndicator | null;
  queue: CoordinatorQueue | null;
  delayLevel: DelayLevel | null;
  isDeleted: boolean;
  isDemo: boolean;
  invoiceId: string | null;
  /** Prior status shown in Updated-Status until doctor acknowledges. */
  previousStatus: CaseStatus | null;
  statusPendingDoctorAck: boolean;
  country: string;
  countryId: string | null;
  regionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseDetailDto extends CaseListItemDto {
  clinicName: string;
  practiceName: string;
  patientGender: string;
  patientDateOfBirth: string | null;
  instructions: string;
  treatmentInstructions: TreatmentInstructions;
  recordsNumbering: import('./treatment').RecordsNumbering | null;
  clinicalPreferences: import('./treatment').ClinicalPreferences | null;
  occlusionGoals: import('./treatment').OcclusionGoals | null;
  prosthoDetails: import('./treatment').ProsthoDetails | null;
  implantDetails: import('./treatment').ImplantDetails | null;
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
  cutRequired: boolean;
  cutPhase: import('./cut').CutPhase;
  cutAssignmentMode: import('./cut').CutAssignmentMode;
  assignedCutOperatorId: string | null;
  assignedCutOperatorName: string | null;
  cutStartedAt: string | null;
  cutSubmittedAt: string | null;
  cutCompletedAt: string | null;
  cutNotes: string;
  cutInternalComments: Array<{ id: string; body: string; authorName: string; createdAt: string }>;
  cutRevisions: import('./cut').CutRevisionDto[];
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

export const CASE_LIST_SORT_FIELDS = {
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  CASE_ID: 'caseId',
  PATIENT_NAME: 'patientName',
  STATUS: 'status',
  CATEGORY: 'caseCategory',
  TYPE: 'caseType',
} as const;

export type CaseListSortField =
  (typeof CASE_LIST_SORT_FIELDS)[keyof typeof CASE_LIST_SORT_FIELDS];

export const ALL_CASE_LIST_SORT_FIELDS: CaseListSortField[] = Object.values(CASE_LIST_SORT_FIELDS);

export interface DoctorCaseSummaryDto {
  generatedAt: string;
  total: number;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
  pendingStatusAckCount: number;
}

export interface CreateCaseInput {
  patientName: string;
  patientAge?: number | null;
  patientGender?: string;
  patientDateOfBirth?: string | null;
  clinicName?: string;
  practiceName?: string;
  country?: string;
  countryId?: string;
  chiefComplaint?: string;
  caseCategory?: import('./caseTaxonomy').CaseCategory;
  caseType?: import('./caseTaxonomy').CaseType;
  treatmentSummary: string;
  instructions?: string;
  treatmentInstructions?: Partial<TreatmentInstructions>;
  recordsNumbering?: Partial<import('./treatment').RecordsNumbering>;
  clinicalPreferences?: Partial<import('./treatment').ClinicalPreferences>;
  occlusionGoals?: Partial<import('./treatment').OcclusionGoals>;
  prosthoDetails?: Partial<import('./treatment').ProsthoDetails>;
  implantDetails?: Partial<import('./treatment').ImplantDetails>;
  commercial?: Partial<import('./treatment').CaseCommercial>;
  priority?: CasePriority;
  initialNote?: string;
  /** Save as draft without starting the 15-minute clock / SLA. */
  asDraft?: boolean;
  /** Demo case — separate tracked pipeline, no pay gate. */
  isDemo?: boolean;
  /** Treating doctor. Required when the creator is not a doctor. */
  doctorId?: string;
  /** Facility for corporate-originated cases when the treating doctor has no facility. */
  facilityId?: string;
  /** Complete a pending PaymentSession after pay (server sets on webhook confirm). */
  paymentSessionId?: string;
}

export interface UpdateCaseInput {
  patientName?: string;
  patientAge?: number | null;
  patientGender?: string;
  patientDateOfBirth?: string | null;
  clinicName?: string;
  practiceName?: string;
  country?: string;
  countryId?: string;
  chiefComplaint?: string;
  caseCategory?: import('./caseTaxonomy').CaseCategory;
  caseType?: import('./caseTaxonomy').CaseType;
  treatmentSummary?: string;
  instructions?: string;
  treatmentInstructions?: Partial<TreatmentInstructions>;
  recordsNumbering?: Partial<import('./treatment').RecordsNumbering>;
  clinicalPreferences?: Partial<import('./treatment').ClinicalPreferences>;
  occlusionGoals?: Partial<import('./treatment').OcclusionGoals>;
  prosthoDetails?: Partial<import('./treatment').ProsthoDetails>;
  implantDetails?: Partial<import('./treatment').ImplantDetails>;
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
