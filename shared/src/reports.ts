import type { DelayLevel } from './coordinator';
import type { ConsultantIndicator } from './consultation';
import type { QcErrorCode } from './qc';

export interface ReportPeriodDto {
  view: 'month' | 'quarter';
  periodKey: string;
  periodLabel: string;
  availableMonths: Array<{ key: string; label: string }>;
}

/** URD §14.1 reporting filters. */
export interface ReportFilterQuery {
  month?: string;
  view?: 'month' | 'quarter';
  from?: string;
  to?: string;
  doctor?: string;
  customer?: string;
  supervisor?: string;
  consultant?: string;
  designer?: string;
  qc?: string;
  priority?: string;
  status?: string;
  sla?: 'breached' | 'ok' | '';
}

export interface CasePipelineReportDto extends ReportPeriodDto {
  total: number;
  newlySubmitted: number;
  unassigned: number;
  assigned: number;
  inProduction: number;
  qcPending: number;
  qcRunning: number;
  qcRejected: number;
  completed: number;
  cancelled: number;
  delivered: number;
  slaBreached: number;
  onHold: number;
  byStatus: Array<{ status: string; label: string; count: number }>;
}

export interface DesignerDeptReportDto extends ReportPeriodDto {
  members: Array<{
    userId: string;
    name: string;
    email: string;
    assigned: number;
    completed: number;
    revisions: number;
    averageCompletionHours: number | null;
  }>;
  totals: {
    assigned: number;
    completed: number;
    revisions: number;
    averageCompletionHours: number | null;
  };
}

export interface QcDeptReportDto extends ReportPeriodDto {
  reviewed: number;
  rejected: number;
  approved: number;
  errorTrends: Array<{ code: QcErrorCode; label: string; count: number }>;
  members: Array<{
    userId: string;
    name: string;
    reviewed: number;
    rejected: number;
    approved: number;
  }>;
}

export interface ConsultantDeptReportDto extends ReportPeriodDto {
  reviewed: number;
  rejected: number;
  remarksCount: number;
  errorTrends: Array<{ code: QcErrorCode; label: string; count: number }>;
  remarksByColor: Array<{ indicator: ConsultantIndicator; label: string; count: number }>;
  members: Array<{
    userId: string;
    name: string;
    reviewed: number;
    remarks: number;
  }>;
}

export interface SupervisorTeamReportDto extends ReportPeriodDto {
  teams: Array<{
    supervisorId: string;
    supervisorName: string;
    designerCompleted: number;
    qcReviewed: number;
    qcRejected: number;
    consultantReviewed: number;
    members: Array<{
      userId: string;
      name: string;
      role: string;
      casesHandled: number;
    }>;
  }>;
}

export interface DepartmentComparisonReportDto extends ReportPeriodDto {
  rows: Array<{
    department: 'designers' | 'qc' | 'consultants' | 'supervisors';
    label: string;
    headcount: number;
    volume: number;
    completedOrReviewed: number;
    rejectionOrRevisionRate: number | null;
  }>;
}

export interface DoctorPerformanceReportDto extends ReportPeriodDto {
  members: Array<{
    doctorId: string;
    doctorName: string;
    doctorDisplayId: string | null;
    viewed: number;
    approved: number;
    modifications: number;
    approvalRate: number | null;
    modificationRate: number | null;
    averageReviewHours: number | null;
    satisfactionScore: number | null;
    complaintsCount: number;
  }>;
  totals: {
    viewed: number;
    approved: number;
    modifications: number;
    approvalRate: number | null;
    modificationRate: number | null;
    averageReviewHours: number | null;
  };
}

export interface AnalyticsDashboardDto {
  period: ReportPeriodDto;
  pipeline: CasePipelineReportDto;
  designer: DesignerDeptReportDto;
  qc: QcDeptReportDto;
  consultant: ConsultantDeptReportDto;
  supervisor: SupervisorTeamReportDto;
  comparison: DepartmentComparisonReportDto;
  clarifications: import('./clarifications').ClarificationReportDto;
  doctors: DoctorPerformanceReportDto;
}

export interface CorporateInsightsDto {
  organizationId: string;
  companyName: string;
  period: ReportPeriodDto;
  totalCases: number;
  openCases: number;
  approved: number;
  cancelled: number;
  slaBreached: number;
  byStatus: Array<{ status: string; label: string; count: number }>;
  byFacility: Array<{ facilityId: string; name: string; count: number }>;
  byDoctor: Array<{
    doctorId: string;
    doctorName: string;
    count: number;
    approved: number;
    modifications: number;
  }>;
}
