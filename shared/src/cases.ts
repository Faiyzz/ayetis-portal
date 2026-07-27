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

export interface CaseFileDto {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByName: string;
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

export interface CaseHistoryDto {
  id: string;
  action: string;
  summary: string;
  actorId: string | null;
  actorName: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
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

export function isCaseStatus(value: string): value is CaseStatus {
  return (ALL_CASE_STATUSES as string[]).includes(value);
}

export function isCasePriority(value: string): value is CasePriority {
  return (ALL_CASE_PRIORITIES as string[]).includes(value);
}
