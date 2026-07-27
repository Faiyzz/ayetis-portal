import type { DelayLevel } from './coordinator';
import type { CasePriority, CaseStatus } from './cases';

export const SUPERVISOR_QUEUE_BUCKETS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  RETURNED: 'returned',
} as const;

export type SupervisorQueueBucket =
  (typeof SUPERVISOR_QUEUE_BUCKETS)[keyof typeof SUPERVISOR_QUEUE_BUCKETS];

export interface SupervisorQueueCounts {
  pending: number;
  active: number;
  completed: number;
  returned: number;
}

export interface SupervisorQueueCaseDto {
  id: string;
  caseId: string;
  patientName: string;
  doctorName: string;
  status: CaseStatus;
  priority: CasePriority;
  treatmentSummary: string;
  assigneeName: string | null;
  delayLevel: DelayLevel;
  delayHours: number;
  updatedAt: string;
}

export interface SupervisorTeamQueuesDto {
  designer: SupervisorQueueCounts & { items: SupervisorQueueCaseDto[] };
  qc: SupervisorQueueCounts & { items: SupervisorQueueCaseDto[] };
  consultant: SupervisorQueueCounts & { items: SupervisorQueueCaseDto[] };
}

export interface SupervisorWorkloadDto {
  totalOpen: number;
  urgentCount: number;
  delayedCount: number;
  delayBreakdown: Record<DelayLevel, number>;
  delayedCases: SupervisorQueueCaseDto[];
}

export interface SupervisorMemberPerformanceDto {
  userId: string;
  name: string;
  email: string;
  role: string;
  totalCases: number;
  completedCases: number;
  modifications: number;
  qcReviews: number;
  qcReverted: number;
  consultations: number;
}

export interface SupervisorPerformanceDto {
  view: 'month' | 'quarter';
  periodKey: string;
  periodLabel: string;
  availableMonths: Array<{ key: string; label: string }>;
  team: {
    totalCases: number;
    modifications: number;
    qcCasesCount: number;
    qcRevertedCount: number;
    consultantReviewCount: number;
    consultantQcRevertedCount: number;
    consultantConsultationCount: number;
  };
  members: SupervisorMemberPerformanceDto[];
}

export interface SupervisorDashboardDto {
  generatedAt: string;
  queues: SupervisorTeamQueuesDto;
  workload: SupervisorWorkloadDto;
  escalatedCases: SupervisorQueueCaseDto[];
}
