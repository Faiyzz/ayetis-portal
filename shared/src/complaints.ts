export const COMPLAINT_TYPES = {
  QUALITY: 'quality',
  DELAY: 'delay',
  COMMUNICATION: 'communication',
  BILLING: 'billing',
  OTHER: 'other',
} as const;

export type ComplaintType = (typeof COMPLAINT_TYPES)[keyof typeof COMPLAINT_TYPES];

export const ALL_COMPLAINT_TYPES: ComplaintType[] = Object.values(COMPLAINT_TYPES);

export const COMPLAINT_TYPE_LABELS: Record<ComplaintType, string> = {
  [COMPLAINT_TYPES.QUALITY]: 'Quality',
  [COMPLAINT_TYPES.DELAY]: 'Delay',
  [COMPLAINT_TYPES.COMMUNICATION]: 'Communication',
  [COMPLAINT_TYPES.BILLING]: 'Billing',
  [COMPLAINT_TYPES.OTHER]: 'Other',
};

export const COMPLAINT_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;

export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[keyof typeof COMPLAINT_STATUSES];

export const ALL_COMPLAINT_STATUSES: ComplaintStatus[] = Object.values(COMPLAINT_STATUSES);

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  [COMPLAINT_STATUSES.OPEN]: 'Open',
  [COMPLAINT_STATUSES.IN_PROGRESS]: 'In progress',
  [COMPLAINT_STATUSES.RESOLVED]: 'Resolved',
  [COMPLAINT_STATUSES.CLOSED]: 'Closed',
};

export function isComplaintType(value: string): value is ComplaintType {
  return (ALL_COMPLAINT_TYPES as string[]).includes(value);
}

export function isComplaintStatus(value: string): value is ComplaintStatus {
  return (ALL_COMPLAINT_STATUSES as string[]).includes(value);
}

export interface ComplaintDto {
  id: string;
  complaintCode: string;
  details: string;
  caseId: string | null;
  doctorId: string | null;
  doctorName: string | null;
  responsibleEmployeeId: string | null;
  responsibleEmployeeName: string | null;
  responsibleQcId: string | null;
  responsibleQcName: string | null;
  responsibleConsultantId: string | null;
  responsibleConsultantName: string | null;
  responsibleSupervisorId: string | null;
  responsibleSupervisorName: string | null;
  type: ComplaintType;
  status: ComplaintStatus;
  rating: number | null;
  additionalComments: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateComplaintInput {
  details: string;
  caseId?: string;
  type: ComplaintType;
  rating?: number | null;
  responsibleEmployeeId?: string | null;
  responsibleQcId?: string | null;
  responsibleConsultantId?: string | null;
  responsibleSupervisorId?: string | null;
  additionalComments?: string;
}

export interface UpdateComplaintInput {
  status?: ComplaintStatus;
  additionalComments?: string;
  responsibleEmployeeId?: string | null;
  responsibleQcId?: string | null;
  responsibleConsultantId?: string | null;
  responsibleSupervisorId?: string | null;
}

export interface RatingsOverviewDto {
  totalRatings: number;
  averageSatisfaction: number | null;
  approvalRate: number | null;
  rejectionRate: number | null;
  complaintsOpen: number;
  complaintsTotal: number;
}
