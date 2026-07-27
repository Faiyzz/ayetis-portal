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

export interface ComplaintCommentDto {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
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
  /** Explicit 1–5 rating when logged with the complaint; not a derived score. */
  rating: number | null;
  additionalComments: string;
  comments: ComplaintCommentDto[];
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
  /** Appended as a resolution note (does not replace prior comments). */
  comment?: string;
  additionalComments?: string;
  responsibleEmployeeId?: string | null;
  responsibleQcId?: string | null;
  responsibleConsultantId?: string | null;
  responsibleSupervisorId?: string | null;
}

export interface RatingsOverviewDto {
  totalRatings: number;
  /**
   * Mean of explicit 1–5 ratings filed on complaints.
   * Null when no ratings exist — not a synthetic composite score.
   */
  averageRating: number | null;
  /** Share of doctor decisions that are "approve". */
  approvalRate: number | null;
  /** Share of doctor decisions that are "request_modification". */
  rejectionRate: number | null;
  decisionsTotal: number;
  complaintsOpen: number;
  complaintsTotal: number;
}

export interface DoctorComplaintMetricsDto {
  doctorId: string;
  doctorName: string;
  decisionsTotal: number;
  approvedCount: number;
  modificationCount: number;
  cancelCount: number;
  approvalRate: number | null;
  rejectionRate: number | null;
  ratingsCount: number;
  /** Mean of explicit complaint ratings for this doctor; null if none. */
  averageRating: number | null;
  complaintsCount: number;
  openComplaints: number;
}

export interface ComplaintTrendMonthDto {
  key: string;
  label: string;
  complaintsTotal: number;
  complaintsOpen: number;
  complaintsResolved: number;
  byType: Record<ComplaintType, number>;
  ratingsCount: number;
  averageRating: number | null;
  decisionsTotal: number;
  approvalRate: number | null;
  rejectionRate: number | null;
}

export interface ComplaintReportsDto {
  overview: RatingsOverviewDto;
  months: ComplaintTrendMonthDto[];
  byDoctor: DoctorComplaintMetricsDto[];
}

export interface ComplaintStaffOptionDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}
