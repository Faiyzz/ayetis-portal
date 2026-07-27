export const CONSULTANT_INDICATORS = {
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
} as const;

export type ConsultantIndicator =
  (typeof CONSULTANT_INDICATORS)[keyof typeof CONSULTANT_INDICATORS];

export const ALL_CONSULTANT_INDICATORS: ConsultantIndicator[] =
  Object.values(CONSULTANT_INDICATORS);

export const CONSULTANT_INDICATOR_LABELS: Record<ConsultantIndicator, string> = {
  [CONSULTANT_INDICATORS.GREEN]: 'Consultant Reviewed',
  [CONSULTANT_INDICATORS.YELLOW]: 'Remarks Available',
  [CONSULTANT_INDICATORS.RED]: 'Attention Required',
};

export function isConsultantIndicator(value: string): value is ConsultantIndicator {
  return (ALL_CONSULTANT_INDICATORS as string[]).includes(value);
}

export interface ClinicalRemarkDto {
  id: string;
  body: string;
  indicator: ConsultantIndicator;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface AddClinicalRemarkInput {
  body: string;
  indicator: ConsultantIndicator;
}

export interface ConsultantQueueCaseDto {
  id: string;
  caseId: string;
  patientName: string;
  doctorName: string;
  designerName: string | null;
  status: string;
  priority: string;
  treatmentSummary: string;
  consultantIndicator: ConsultantIndicator | null;
  escalatedForOversight: boolean;
  qcRejectionCount: number;
  clinicalRemarkCount: number;
  assignedConsultantName: string | null;
  updatedAt: string;
}

export interface ConsultantDashboardDto {
  generatedAt: string;
  totalCount: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  unreviewedCount: number;
  items: ConsultantQueueCaseDto[];
}

export interface ConsultantPerformanceDto {
  view: 'month' | 'quarter';
  periodKey: string;
  periodLabel: string;
  availableMonths: Array<{ key: string; label: string }>;
  reviewCount: number;
  consultationCount: number;
  qcRevertedCount: number;
  approvedCount: number;
  errorTrends: Array<{ errorCode: string; label: string; count: number }>;
  indicatorBreakdown: Record<ConsultantIndicator, number>;
}

export const DOCTOR_DECISIONS = {
  APPROVE: 'approve',
  REQUEST_MODIFICATION: 'request_modification',
  CANCEL: 'cancel',
  UNDER_REVIEW: 'under_review',
} as const;

export type DoctorDecision = (typeof DOCTOR_DECISIONS)[keyof typeof DOCTOR_DECISIONS];

export const ALL_DOCTOR_DECISIONS: DoctorDecision[] = Object.values(DOCTOR_DECISIONS);

export const DOCTOR_DECISION_LABELS: Record<DoctorDecision, string> = {
  [DOCTOR_DECISIONS.APPROVE]: 'Approve',
  [DOCTOR_DECISIONS.REQUEST_MODIFICATION]: 'Request modification',
  [DOCTOR_DECISIONS.CANCEL]: 'Cancel case',
  [DOCTOR_DECISIONS.UNDER_REVIEW]: 'Keep under review',
};

export function isDoctorDecision(value: string): value is DoctorDecision {
  return (ALL_DOCTOR_DECISIONS as string[]).includes(value);
}

export interface DoctorDecisionInput {
  decision: DoctorDecision;
  note?: string;
}

export interface DoctorEngagementDto {
  openedAt: string | null;
  videoViewedAt: string | null;
  respondedAt: string | null;
  filesDownloadedAt: string | null;
  lastViewedAt: string | null;
  viewedWithoutActionNotifiedAt: string | null;
}

export interface DoctorDeliveryQueueItemDto {
  id: string;
  caseId: string;
  patientName: string;
  status: string;
  treatmentSummary: string;
  hasDeliveryVideo: boolean;
  hasDeliveryLink: boolean;
  doctorDecision: DoctorDecision | null;
  deliveredAt: string | null;
  updatedAt: string;
}
