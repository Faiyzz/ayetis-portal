export const CLARIFICATION_STATUSES = {
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
  [CLARIFICATION_STATUSES.OPEN]: 'Open',
  [CLARIFICATION_STATUSES.AWAITING_DOCTOR]: 'Awaiting doctor',
  [CLARIFICATION_STATUSES.AWAITING_TEAM]: 'Awaiting team',
  [CLARIFICATION_STATUSES.RESOLVED]: 'Resolved',
};

export const CLARIFICATION_MESSAGE_KINDS = {
  REQUEST: 'request',
  REPLY: 'reply',
  NOTE: 'note',
} as const;

export type ClarificationMessageKind =
  (typeof CLARIFICATION_MESSAGE_KINDS)[keyof typeof CLARIFICATION_MESSAGE_KINDS];

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
  createdById: string;
  createdByName: string;
  createdByRole: string;
  messages: ClarificationMessageDto[];
  resolvedAt: string | null;
  resolvedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClarificationInput {
  subject: string;
  requiredInfo: string;
  message?: string;
}

export interface ReplyClarificationInput {
  body: string;
}

export function isClarificationStatus(value: string): value is ClarificationStatus {
  return (ALL_CLARIFICATION_STATUSES as string[]).includes(value);
}
