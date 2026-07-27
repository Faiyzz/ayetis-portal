import { CASE_STATUSES, type CasePriority, type CaseStatus } from './cases';

/** Coordinator dashboard queue buckets (SRS §6). */
export const COORDINATOR_QUEUES = {
  NEW: 'new',
  PENDING_VALIDATION: 'pending_validation',
  WAITING_DOCTOR: 'waiting_doctor',
  READY_FOR_ASSIGNMENT: 'ready_for_assignment',
  ASSIGNED: 'assigned',
} as const;

export type CoordinatorQueue =
  (typeof COORDINATOR_QUEUES)[keyof typeof COORDINATOR_QUEUES];

export const ALL_COORDINATOR_QUEUES: CoordinatorQueue[] = Object.values(COORDINATOR_QUEUES);

export const COORDINATOR_QUEUE_LABELS: Record<CoordinatorQueue, string> = {
  [COORDINATOR_QUEUES.NEW]: 'New cases',
  [COORDINATOR_QUEUES.PENDING_VALIDATION]: 'Pending validation',
  [COORDINATOR_QUEUES.WAITING_DOCTOR]: 'Waiting for doctor',
  [COORDINATOR_QUEUES.READY_FOR_ASSIGNMENT]: 'Ready for assignment',
  [COORDINATOR_QUEUES.ASSIGNED]: 'Assigned cases',
};

export const COORDINATOR_QUEUE_DESCRIPTIONS: Record<CoordinatorQueue, string> = {
  [COORDINATOR_QUEUES.NEW]: 'Freshly submitted — not yet under validation',
  [COORDINATOR_QUEUES.PENDING_VALIDATION]: 'In validation, checklist not marked complete',
  [COORDINATOR_QUEUES.WAITING_DOCTOR]: 'Clarification sent — awaiting doctor reply',
  [COORDINATOR_QUEUES.READY_FOR_ASSIGNMENT]: 'Validated and waiting for a designer or auto queue',
  [COORDINATOR_QUEUES.ASSIGNED]: 'Routed to a designer or the auto pick queue',
};

/** Review delay colour bar (SRS: Green / Yellow / Blue / Red). */
export const DELAY_LEVELS = {
  GREEN: 'green',
  YELLOW: 'yellow',
  BLUE: 'blue',
  RED: 'red',
} as const;

export type DelayLevel = (typeof DELAY_LEVELS)[keyof typeof DELAY_LEVELS];

export const ALL_DELAY_LEVELS: DelayLevel[] = Object.values(DELAY_LEVELS);

export const DELAY_LEVEL_LABELS: Record<DelayLevel, string> = {
  [DELAY_LEVELS.GREEN]: 'On track',
  [DELAY_LEVELS.YELLOW]: 'Watch',
  [DELAY_LEVELS.BLUE]: 'Aging',
  [DELAY_LEVELS.RED]: 'Overdue',
};

/** Hours thresholds: green <24, yellow <48, blue <72, else red. */
export const DELAY_THRESHOLDS_HOURS = {
  greenMax: 24,
  yellowMax: 48,
  blueMax: 72,
} as const;

export function computeDelayLevel(referenceIso: string | Date, now = new Date()): DelayLevel {
  const ref = typeof referenceIso === 'string' ? new Date(referenceIso) : referenceIso;
  const hours = Math.max(0, (now.getTime() - ref.getTime()) / (1000 * 60 * 60));
  if (hours < DELAY_THRESHOLDS_HOURS.greenMax) return DELAY_LEVELS.GREEN;
  if (hours < DELAY_THRESHOLDS_HOURS.yellowMax) return DELAY_LEVELS.YELLOW;
  if (hours < DELAY_THRESHOLDS_HOURS.blueMax) return DELAY_LEVELS.BLUE;
  return DELAY_LEVELS.RED;
}

export const ASSIGNMENT_MODES = {
  NONE: 'none',
  AUTO_QUEUE: 'auto_queue',
  DESIGNER: 'designer',
} as const;

export type AssignmentMode = (typeof ASSIGNMENT_MODES)[keyof typeof ASSIGNMENT_MODES];

export const ALL_ASSIGNMENT_MODES: AssignmentMode[] = Object.values(ASSIGNMENT_MODES);

export const ASSIGNMENT_MODE_LABELS: Record<AssignmentMode, string> = {
  [ASSIGNMENT_MODES.NONE]: 'Unassigned',
  [ASSIGNMENT_MODES.AUTO_QUEUE]: 'Auto case-pick queue',
  [ASSIGNMENT_MODES.DESIGNER]: 'Assigned designer',
};

export interface ValidationCheckItem {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface CaseValidationSummary {
  ready: boolean;
  checks: ValidationCheckItem[];
  validatedAt: string | null;
  validatedByName: string | null;
}

export interface CoordinatorQueueCaseDto {
  id: string;
  caseId: string;
  patientName: string;
  doctorName: string;
  doctorEmail: string;
  status: CaseStatus;
  priority: CasePriority;
  treatmentSummary: string;
  queue: CoordinatorQueue;
  delayLevel: DelayLevel;
  delayHours: number;
  fileCount: number;
  openClarificationCount: number;
  assignedDesignerName: string | null;
  assignmentMode: AssignmentMode;
  validatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoordinatorQueueBucketDto {
  queue: CoordinatorQueue;
  label: string;
  description: string;
  count: number;
  delayBreakdown: Record<DelayLevel, number>;
  items: CoordinatorQueueCaseDto[];
}

export interface CoordinatorDashboardDto {
  generatedAt: string;
  totals: Record<CoordinatorQueue, number>;
  delayBreakdown: Record<DelayLevel, number>;
  buckets: CoordinatorQueueBucketDto[];
}

export interface ValidateCaseInput {
  notes?: string;
  /** Force validate even if soft checks fail (still requires core patient/summary). */
  force?: boolean;
}

export interface AssignCaseInput {
  mode: 'designer' | 'auto_queue';
  designerId?: string;
  note?: string;
}

export interface DesignerAssigneeDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
}

export function resolveCoordinatorQueue(input: {
  status: CaseStatus;
  validatedAt?: Date | string | null;
  assignmentMode?: AssignmentMode | null;
  assignedDesignerId?: string | null;
}): CoordinatorQueue {
  const mode = input.assignmentMode ?? ASSIGNMENT_MODES.NONE;
  const assigned =
    mode === ASSIGNMENT_MODES.AUTO_QUEUE ||
    mode === ASSIGNMENT_MODES.DESIGNER ||
    Boolean(input.assignedDesignerId);

  if (input.status === CASE_STATUSES.WAITING_CLARIFICATION) {
    return COORDINATOR_QUEUES.WAITING_DOCTOR;
  }

  if (assigned && input.status !== CASE_STATUSES.CANCELLED) {
    return COORDINATOR_QUEUES.ASSIGNED;
  }

  if (input.status === CASE_STATUSES.SUBMITTED) {
    return COORDINATOR_QUEUES.NEW;
  }

  if (input.validatedAt && !assigned) {
    return COORDINATOR_QUEUES.READY_FOR_ASSIGNMENT;
  }

  if (input.status === CASE_STATUSES.UNDER_VALIDATION && !input.validatedAt) {
    return COORDINATOR_QUEUES.PENDING_VALIDATION;
  }

  // Later pipeline stages without an assignee still sit in pending until validated/assigned.
  if (!input.validatedAt) {
    return COORDINATOR_QUEUES.PENDING_VALIDATION;
  }

  return COORDINATOR_QUEUES.READY_FOR_ASSIGNMENT;
}

export function isAssignmentMode(value: string): value is AssignmentMode {
  return (ALL_ASSIGNMENT_MODES as string[]).includes(value);
}

export function isCoordinatorQueue(value: string): value is CoordinatorQueue {
  return (ALL_COORDINATOR_QUEUES as string[]).includes(value);
}
