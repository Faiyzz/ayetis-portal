/**
 * Cut Operator Portal & Cut Workflow (URD §13).
 */

import type { CasePriority, CaseStatus } from './cases';
import { CASE_STATUSES, CASE_STATUS_LABELS } from './cases';
import type { PerformanceMonthOption } from './qc';

export const CUT_PHASES = {
  NONE: 'none',
  CUT_QUEUE: 'cut_queue',
  CUT_ASSIGNED: 'cut_assigned',
  CUT_IN_PROGRESS: 'cut_in_progress',
  WAITING_FOR_DESIGNER: 'waiting_for_designer',
  CUT_REWORK: 'cut_rework',
  CUT_COMPLETE: 'cut_complete',
} as const;

export type CutPhase = (typeof CUT_PHASES)[keyof typeof CUT_PHASES];

export const ALL_CUT_PHASES: CutPhase[] = Object.values(CUT_PHASES);

export const CUT_PHASE_LABELS: Record<CutPhase, string> = {
  [CUT_PHASES.NONE]: 'No cut',
  [CUT_PHASES.CUT_QUEUE]: 'Cut auto-pick queue',
  [CUT_PHASES.CUT_ASSIGNED]: 'Cut assigned',
  [CUT_PHASES.CUT_IN_PROGRESS]: 'Cut in progress',
  [CUT_PHASES.WAITING_FOR_DESIGNER]: 'Waiting for Designer Assignment',
  [CUT_PHASES.CUT_REWORK]: 'Cut rework',
  [CUT_PHASES.CUT_COMPLETE]: 'Cut complete',
};

export const CUT_ASSIGNMENT_MODES = {
  NONE: 'none',
  AUTO_QUEUE: 'auto_queue',
  OPERATOR: 'operator',
} as const;

export type CutAssignmentMode =
  (typeof CUT_ASSIGNMENT_MODES)[keyof typeof CUT_ASSIGNMENT_MODES];

export const ALL_CUT_ASSIGNMENT_MODES: CutAssignmentMode[] =
  Object.values(CUT_ASSIGNMENT_MODES);

export const CUT_ASSIGNMENT_MODE_LABELS: Record<CutAssignmentMode, string> = {
  [CUT_ASSIGNMENT_MODES.NONE]: 'Unassigned',
  [CUT_ASSIGNMENT_MODES.AUTO_QUEUE]: 'Cut auto case-pick queue',
  [CUT_ASSIGNMENT_MODES.OPERATOR]: 'Assigned cut operator',
};

export function isCutPhase(value: string): value is CutPhase {
  return (ALL_CUT_PHASES as string[]).includes(value);
}

export function isCutAssignmentMode(value: string): value is CutAssignmentMode {
  return (ALL_CUT_ASSIGNMENT_MODES as string[]).includes(value);
}

/** Prefer cut-phase label when case is in an active cut stage. */
export function getCaseWorkflowLabel(
  status: CaseStatus,
  cutPhase?: CutPhase | null,
): string {
  if (
    cutPhase &&
    cutPhase !== CUT_PHASES.NONE &&
    cutPhase !== CUT_PHASES.CUT_COMPLETE &&
    status === CASE_STATUSES.IN_PROCESS
  ) {
    return CUT_PHASE_LABELS[cutPhase];
  }
  return CASE_STATUS_LABELS[status] ?? status;
}

export interface CutRevisionDto {
  id: string;
  revision: number;
  reason: string;
  comments: string;
  requestedById: string;
  requestedByName: string;
  requestedByRole: string;
  requestedAt: string;
  completedAt: string | null;
}

export interface CutQueueCaseDto {
  id: string;
  caseId: string;
  patientName: string;
  doctorName: string;
  status: CaseStatus;
  priority: CasePriority;
  treatmentSummary: string;
  cutPhase: CutPhase;
  cutAssignmentMode: CutAssignmentMode;
  assignedCutOperatorName: string | null;
  openClarificationCount: number;
  fileCount: number;
  cutStartedAt: string | null;
  cutSubmittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CutDashboardDto {
  generatedAt: string;
  assigned: CutQueueCaseDto[];
  autoQueue: CutQueueCaseDto[];
  inProgress: CutQueueCaseDto[];
  pendingClarification: CutQueueCaseDto[];
  completed: CutQueueCaseDto[];
  waitingForDesigner: CutQueueCaseDto[];
  counts: {
    assigned: number;
    autoQueue: number;
    inProgress: number;
    pendingClarification: number;
    completed: number;
    waitingForDesigner: number;
  };
}

export interface CutPerformanceDto {
  periodKey: string;
  periodLabel: string;
  availableMonths: PerformanceMonthOption[];
  view: 'month' | 'quarter';
  totalAssigned: number;
  totalCompleted: number;
  averageCompletionHours: number | null;
  pending: number;
  clarificationsRaised: number;
}

export interface RequestCutReworkInput {
  reason: string;
  comments: string;
}

export interface SubmitCutInput {
  notes?: string;
  /** When true (default), hand off to designer auto-queue; false leaves for coordinator. */
  designerAutoQueue?: boolean;
}

export interface StartCutInput {
  notes?: string;
}

export interface SaveCutProgressInput {
  notes?: string;
  comment?: string;
}

export interface AssignCutInput {
  mode: 'operator' | 'auto_queue';
  cutOperatorId?: string;
  note?: string;
  cutRequired?: boolean;
}

export interface CutOperatorAssigneeDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
}
