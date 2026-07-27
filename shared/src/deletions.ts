export const DELETE_RECORD_TYPES = {
  CASE: 'case',
  USER: 'user',
  DEPARTMENT: 'department',
} as const;

export type DeleteRecordType = (typeof DELETE_RECORD_TYPES)[keyof typeof DELETE_RECORD_TYPES];

export const ALL_DELETE_RECORD_TYPES: DeleteRecordType[] = Object.values(DELETE_RECORD_TYPES);

export const DELETE_REQUEST_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type DeleteRequestStatus =
  (typeof DELETE_REQUEST_STATUSES)[keyof typeof DELETE_REQUEST_STATUSES];

export const ALL_DELETE_REQUEST_STATUSES: DeleteRequestStatus[] =
  Object.values(DELETE_REQUEST_STATUSES);

export const DELETE_REQUEST_STATUS_LABELS: Record<DeleteRequestStatus, string> = {
  [DELETE_REQUEST_STATUSES.PENDING]: 'Pending approval',
  [DELETE_REQUEST_STATUSES.APPROVED]: 'Approved',
  [DELETE_REQUEST_STATUSES.REJECTED]: 'Rejected',
};

export function isDeleteRecordType(value: string): value is DeleteRecordType {
  return (ALL_DELETE_RECORD_TYPES as string[]).includes(value);
}

export interface DeleteRequestDto {
  id: string;
  recordType: DeleteRecordType;
  recordId: string;
  recordLabel: string;
  caseId: string | null;
  reason: string;
  status: DeleteRequestStatus;
  requestedById: string;
  requestedByName: string;
  requestedByEmail: string;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeleteRequestInput {
  reason: string;
}

export interface ReviewDeleteRequestInput {
  decision: 'approve' | 'reject';
  note?: string;
  /** Second confirmation token — must equal DELETE */
  confirmation: string;
}
