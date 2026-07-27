export const CASE_STATUSES = {
  SUBMITTED: 'submitted',
  UNDER_VALIDATION: 'under_validation',
  WAITING_CLARIFICATION: 'waiting_clarification',
  SENT_FOR_MODIFICATION: 'sent_for_modification',
  DESIGNER_WORKING: 'designer_working',
  QC_REVIEW: 'qc_review',
  ORTHODONTIST_REVIEW: 'orthodontist_review',
  APPROVED: 'approved',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type CaseStatus = (typeof CASE_STATUSES)[keyof typeof CASE_STATUSES];

export const ALL_CASE_STATUSES: CaseStatus[] = Object.values(CASE_STATUSES);

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  [CASE_STATUSES.SUBMITTED]: 'Submitted',
  [CASE_STATUSES.UNDER_VALIDATION]: 'Under Validation',
  [CASE_STATUSES.WAITING_CLARIFICATION]: 'Waiting for Clarification',
  [CASE_STATUSES.SENT_FOR_MODIFICATION]: 'Sent for Modification',
  [CASE_STATUSES.DESIGNER_WORKING]: 'Designer Working',
  [CASE_STATUSES.QC_REVIEW]: 'QC Review',
  [CASE_STATUSES.ORTHODONTIST_REVIEW]: 'Orthodontist Review',
  [CASE_STATUSES.APPROVED]: 'Approved',
  [CASE_STATUSES.DELIVERED]: 'Delivered',
  [CASE_STATUSES.COMPLETED]: 'Completed',
  [CASE_STATUSES.CANCELLED]: 'Cancelled',
};

/** Primary happy-path stages shown on the visual timeline. */
export const CASE_TIMELINE_STATUSES: CaseStatus[] = [
  CASE_STATUSES.SUBMITTED,
  CASE_STATUSES.UNDER_VALIDATION,
  CASE_STATUSES.DESIGNER_WORKING,
  CASE_STATUSES.QC_REVIEW,
  CASE_STATUSES.APPROVED,
  CASE_STATUSES.DELIVERED,
  CASE_STATUSES.COMPLETED,
];

/** Maps non-linear statuses onto the nearest timeline stage for visualization. */
export const CASE_STATUS_TIMELINE_ANCHOR: Record<CaseStatus, CaseStatus> = {
  [CASE_STATUSES.SUBMITTED]: CASE_STATUSES.SUBMITTED,
  [CASE_STATUSES.UNDER_VALIDATION]: CASE_STATUSES.UNDER_VALIDATION,
  [CASE_STATUSES.WAITING_CLARIFICATION]: CASE_STATUSES.UNDER_VALIDATION,
  [CASE_STATUSES.SENT_FOR_MODIFICATION]: CASE_STATUSES.DESIGNER_WORKING,
  [CASE_STATUSES.DESIGNER_WORKING]: CASE_STATUSES.DESIGNER_WORKING,
  [CASE_STATUSES.QC_REVIEW]: CASE_STATUSES.QC_REVIEW,
  [CASE_STATUSES.ORTHODONTIST_REVIEW]: CASE_STATUSES.QC_REVIEW,
  [CASE_STATUSES.APPROVED]: CASE_STATUSES.APPROVED,
  [CASE_STATUSES.DELIVERED]: CASE_STATUSES.DELIVERED,
  [CASE_STATUSES.COMPLETED]: CASE_STATUSES.COMPLETED,
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
  OTHER: 'other',
} as const;

export type FileCategory = (typeof FILE_CATEGORIES)[keyof typeof FILE_CATEGORIES];

export const ALL_FILE_CATEGORIES: FileCategory[] = Object.values(FILE_CATEGORIES);

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  [FILE_CATEGORIES.STL]: 'STL',
  [FILE_CATEGORIES.SCAN]: 'Scan',
  [FILE_CATEGORIES.PHOTO]: 'Photo',
  [FILE_CATEGORIES.XRAY]: 'X-ray',
  [FILE_CATEGORIES.OTHER]: 'Other',
};

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
  doctorName: string;
  doctorEmail: string;
  status: CaseStatus;
  priority: CasePriority;
  treatmentSummary: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CaseDetailDto extends CaseListItemDto {
  clinicName: string;
  patientGender: string;
  instructions: string;
  country: string;
  assignedDesignerId: string | null;
  assignedDesignerName: string | null;
  cancelReason: string | null;
  deletedAt: string | null;
  deletedByName: string | null;
  deleteReason: string | null;
  notes: CaseNoteDto[];
  files: CaseFileDto[];
  history: CaseHistoryDto[];
  timeline: TimelineStep[];
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
  clinicName?: string;
  country?: string;
  treatmentSummary: string;
  instructions?: string;
  priority?: CasePriority;
  initialNote?: string;
}

export interface UpdateCaseInput {
  patientName?: string;
  patientAge?: number | null;
  patientGender?: string;
  clinicName?: string;
  country?: string;
  treatmentSummary?: string;
  instructions?: string;
  priority?: CasePriority;
  status?: CaseStatus;
}

export interface CancelCaseInput {
  reason: string;
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
