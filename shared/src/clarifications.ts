/**
 * Multi-role clarification workflow — sender-role types, priority, button states, drafts.
 */

export const CLARIFICATION_STATUSES = {
  DRAFT: 'draft',
  OPEN: 'open',
  AWAITING_DOCTOR: 'awaiting_doctor',
  AWAITING_TEAM: 'awaiting_team',
  RESOLVED: 'resolved',
} as const;

export type ClarificationStatus =
  (typeof CLARIFICATION_STATUSES)[keyof typeof CLARIFICATION_STATUSES];

export const ALL_CLARIFICATION_STATUSES: ClarificationStatus[] =
  Object.values(CLARIFICATION_STATUSES);

export const CLARIFICATION_STATUS_LABELS: Record<ClarificationStatus, string> = {
  [CLARIFICATION_STATUSES.DRAFT]: 'Draft',
  [CLARIFICATION_STATUSES.OPEN]: 'Open',
  [CLARIFICATION_STATUSES.AWAITING_DOCTOR]: 'Awaiting doctor',
  [CLARIFICATION_STATUSES.AWAITING_TEAM]: 'Awaiting team',
  [CLARIFICATION_STATUSES.RESOLVED]: 'Resolved',
};

export const CLARIFICATION_PRIORITIES = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export type ClarificationPriority =
  (typeof CLARIFICATION_PRIORITIES)[keyof typeof CLARIFICATION_PRIORITIES];

export const ALL_CLARIFICATION_PRIORITIES: ClarificationPriority[] =
  Object.values(CLARIFICATION_PRIORITIES);

export const CLARIFICATION_PRIORITY_LABELS: Record<ClarificationPriority, string> = {
  [CLARIFICATION_PRIORITIES.LOW]: 'Low',
  [CLARIFICATION_PRIORITIES.NORMAL]: 'Normal',
  [CLARIFICATION_PRIORITIES.HIGH]: 'High',
  [CLARIFICATION_PRIORITIES.URGENT]: 'Urgent',
};

export const CLARIFICATION_SENDER_ROLES = {
  COORDINATOR: 'coordinator',
  DESIGNER: 'designer',
  QC: 'qc',
  CONSULTANT: 'consultant',
  SUPERVISOR: 'supervisor',
} as const;

export type ClarificationSenderRole =
  (typeof CLARIFICATION_SENDER_ROLES)[keyof typeof CLARIFICATION_SENDER_ROLES];

export const ALL_CLARIFICATION_SENDER_ROLES: ClarificationSenderRole[] = Object.values(
  CLARIFICATION_SENDER_ROLES,
);

export const CLARIFICATION_SENDER_ROLE_LABELS: Record<ClarificationSenderRole, string> = {
  [CLARIFICATION_SENDER_ROLES.COORDINATOR]: 'Coordinator',
  [CLARIFICATION_SENDER_ROLES.DESIGNER]: 'Designer',
  [CLARIFICATION_SENDER_ROLES.QC]: 'QC',
  [CLARIFICATION_SENDER_ROLES.CONSULTANT]: 'Consultant',
  [CLARIFICATION_SENDER_ROLES.SUPERVISOR]: 'Supervisor',
};

export interface ClarificationTypeDef {
  type: string;
  label: string;
  exampleTriggers: string[];
}

export const CLARIFICATION_TYPES_BY_SENDER: Record<
  ClarificationSenderRole,
  ClarificationTypeDef[]
> = {
  [CLARIFICATION_SENDER_ROLES.COORDINATOR]: [
    {
      type: 'missing_records',
      label: 'Missing / incomplete records',
      exampleTriggers: ['STL missing', 'Photos incomplete', 'Prescription unclear'],
    },
    {
      type: 'patient_data',
      label: 'Patient data clarification',
      exampleTriggers: ['DOB mismatch', 'Wrong patient name', 'Missing clinical notes'],
    },
    {
      type: 'intake_hold',
      label: 'Intake hold',
      exampleTriggers: ['Awaiting payment confirmation', 'Duplicate case check'],
    },
  ],
  [CLARIFICATION_SENDER_ROLES.DESIGNER]: [
    {
      type: 'scan_quality',
      label: 'Scan / mesh quality',
      exampleTriggers: ['Holes in mesh', 'Occlusion unclear', 'Arch incomplete'],
    },
    {
      type: 'setup_instructions',
      label: 'Setup / instructions unclear',
      exampleTriggers: ['IPR ambiguity', 'Attachment preference', 'Midline preference'],
    },
    {
      type: 'material_spec',
      label: 'Material / appliance specs',
      exampleTriggers: ['Retainer type', 'Print protocol', 'Thickness preference'],
    },
  ],
  [CLARIFICATION_SENDER_ROLES.QC]: [
    {
      type: 'fit_check',
      label: 'Fit / anatomy check with doctor',
      exampleTriggers: ['Contact points', 'Undercut concern', 'Margin question'],
    },
    {
      type: 'instruction_mismatch',
      label: 'Instructions vs delivery mismatch',
      exampleTriggers: ['Bite different from form', 'Tooth not in plan'],
    },
    {
      type: 'rework_confirm',
      label: 'Rework confirmation',
      exampleTriggers: ['Confirm reject reason', 'Doctor preference after QC fail'],
    },
  ],
  [CLARIFICATION_SENDER_ROLES.CONSULTANT]: [
    {
      type: 'clinical_review',
      label: 'Clinical review question',
      exampleTriggers: ['Treatment feasibility', 'Alternative approach', 'Risk discussion'],
    },
    {
      type: 'plan_change',
      label: 'Suggested plan change',
      exampleTriggers: ['Stage count', 'Elastics', 'Extraction option'],
    },
  ],
  [CLARIFICATION_SENDER_ROLES.SUPERVISOR]: [
    {
      type: 'escalation_review',
      label: 'Escalation / oversight review',
      exampleTriggers: ['Repeated delays', 'Cross-team conflict', 'SLA risk'],
    },
    {
      type: 'priority_directive',
      label: 'Priority / workflow directive',
      exampleTriggers: ['Rush request confirmation', 'Reassignment needed'],
    },
  ],
};

export const CLARIFICATION_ESCALATION_STATUSES = {
  NONE: 'none',
  ESCALATED: 'escalated',
  DE_ESCALATED: 'de_escalated',
} as const;

export type ClarificationEscalationStatus =
  (typeof CLARIFICATION_ESCALATION_STATUSES)[keyof typeof CLARIFICATION_ESCALATION_STATUSES];

export const ALL_CLARIFICATION_ESCALATION_STATUSES: ClarificationEscalationStatus[] =
  Object.values(CLARIFICATION_ESCALATION_STATUSES);

export const CLARIFICATION_ESCALATION_STATUS_LABELS: Record<
  ClarificationEscalationStatus,
  string
> = {
  [CLARIFICATION_ESCALATION_STATUSES.NONE]: 'None',
  [CLARIFICATION_ESCALATION_STATUSES.ESCALATED]: 'Escalated',
  [CLARIFICATION_ESCALATION_STATUSES.DE_ESCALATED]: 'De-escalated',
};

/** Case-level View Clarification button: Blue → Green → Blue (re-open). */
export const CLARIFICATION_BUTTON_STATES = {
  NONE: 'none',
  BLUE: 'blue',
  GREEN: 'green',
} as const;

export type ClarificationButtonState =
  (typeof CLARIFICATION_BUTTON_STATES)[keyof typeof CLARIFICATION_BUTTON_STATES];

export const CLARIFICATION_BUTTON_STATE_LABELS: Record<ClarificationButtonState, string> = {
  [CLARIFICATION_BUTTON_STATES.NONE]: 'No open clarifications',
  [CLARIFICATION_BUTTON_STATES.BLUE]: 'Clarification open / reopened',
  [CLARIFICATION_BUTTON_STATES.GREEN]: 'Doctor responded',
};

export const CLARIFICATION_MESSAGE_KINDS = {
  REQUEST: 'request',
  REPLY: 'reply',
  NOTE: 'note',
} as const;

export type ClarificationMessageKind =
  (typeof CLARIFICATION_MESSAGE_KINDS)[keyof typeof CLARIFICATION_MESSAGE_KINDS];

export interface ClarificationAttachmentDto {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByName: string;
  createdAt: string;
}

export interface ClarificationMessageDto {
  id: string;
  kind: ClarificationMessageKind;
  body: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
}

export interface ClarificationDto {
  id: string;
  caseId: string;
  caseMongoId: string;
  subject: string;
  requiredInfo: string;
  status: ClarificationStatus;
  senderRole: ClarificationSenderRole;
  clarificationType: string;
  clarificationTypeLabel: string;
  priority: ClarificationPriority;
  isDraft: boolean;
  createdById: string;
  createdByName: string;
  createdByRole: string;
  messages: ClarificationMessageDto[];
  attachments: ClarificationAttachmentDto[];
  doctorResponseDraft: string | null;
  doctorReadAt: string | null;
  teamReadAt: string | null;
  escalationStatus: ClarificationEscalationStatus;
  escalatedAt: string | null;
  escalatedByName: string | null;
  escalationReason: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClarificationInput {
  subject: string;
  requiredInfo: string;
  message?: string;
  senderRole?: ClarificationSenderRole;
  clarificationType: string;
  priority?: ClarificationPriority;
  /** Save as draft without notifying the doctor. */
  asDraft?: boolean;
}

export interface UpdateClarificationDraftInput {
  subject?: string;
  requiredInfo?: string;
  clarificationType?: string;
  priority?: ClarificationPriority;
  doctorResponseDraft?: string;
  message?: string;
}

export interface ReplyClarificationInput {
  body: string;
}

export interface EscalateClarificationInput {
  reason?: string;
  escalate?: boolean;
}

export interface ClarificationReportRowDto {
  id: string;
  caseId: string;
  subject: string;
  senderRole: ClarificationSenderRole;
  clarificationType: string;
  priority: ClarificationPriority;
  status: ClarificationStatus;
  escalationStatus: ClarificationEscalationStatus;
  doctorRead: boolean;
  teamRead: boolean;
  createdByName: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ClarificationReportDto {
  generatedAt: string;
  total: number;
  openCount: number;
  awaitingDoctor: number;
  awaitingTeam: number;
  escalatedCount: number;
  unreadByDoctor: number;
  bySenderRole: Array<{ role: ClarificationSenderRole; label: string; count: number }>;
  items: ClarificationReportRowDto[];
}

export function isClarificationStatus(value: string): value is ClarificationStatus {
  return (ALL_CLARIFICATION_STATUSES as string[]).includes(value);
}

export function isClarificationPriority(value: string): value is ClarificationPriority {
  return (ALL_CLARIFICATION_PRIORITIES as string[]).includes(value);
}

export function isClarificationSenderRole(value: string): value is ClarificationSenderRole {
  return (ALL_CLARIFICATION_SENDER_ROLES as string[]).includes(value);
}

export function clarificationTypeLabel(
  senderRole: ClarificationSenderRole,
  type: string,
): string {
  const found = CLARIFICATION_TYPES_BY_SENDER[senderRole]?.find((item) => item.type === type);
  return found?.label ?? type;
}

export function isValidClarificationType(
  senderRole: ClarificationSenderRole,
  type: string,
): boolean {
  return Boolean(CLARIFICATION_TYPES_BY_SENDER[senderRole]?.some((item) => item.type === type));
}

/** Map portal role keys to clarification sender role. */
export function resolveClarificationSenderRole(role: string): ClarificationSenderRole | null {
  const key = role.toLowerCase();
  if (key === 'coordinator') return CLARIFICATION_SENDER_ROLES.COORDINATOR;
  if (key === 'designer' || key === 'senior_designer') return CLARIFICATION_SENDER_ROLES.DESIGNER;
  if (key === 'qc' || key === 'qc_self') return CLARIFICATION_SENDER_ROLES.QC;
  if (key === 'orthodontist' || key === 'consultant') return CLARIFICATION_SENDER_ROLES.CONSULTANT;
  if (key === 'supervisor') return CLARIFICATION_SENDER_ROLES.SUPERVISOR;
  return null;
}

/**
 * Blue (open / reopened awaiting doctor) → Green (doctor responded) → Blue (new request after response).
 */
export function computeClarificationButtonState(
  clarifications: Array<{ status: ClarificationStatus; isDraft?: boolean }>,
): ClarificationButtonState {
  const active = clarifications.filter(
    (item) => !item.isDraft && item.status !== CLARIFICATION_STATUSES.RESOLVED && item.status !== CLARIFICATION_STATUSES.DRAFT,
  );
  if (active.length === 0) return CLARIFICATION_BUTTON_STATES.NONE;

  const awaitingDoctor = active.some(
    (item) =>
      item.status === CLARIFICATION_STATUSES.AWAITING_DOCTOR ||
      item.status === CLARIFICATION_STATUSES.OPEN,
  );
  if (awaitingDoctor) return CLARIFICATION_BUTTON_STATES.BLUE;

  const awaitingTeam = active.some((item) => item.status === CLARIFICATION_STATUSES.AWAITING_TEAM);
  if (awaitingTeam) return CLARIFICATION_BUTTON_STATES.GREEN;

  return CLARIFICATION_BUTTON_STATES.BLUE;
}
