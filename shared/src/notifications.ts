export const NOTIFICATION_TYPES = {
  CLARIFICATION_REQUIRED: 'clarification_required',
  CLARIFICATION_REPLIED: 'clarification_replied',
  CLARIFICATION_RESOLVED: 'clarification_resolved',
  CASE_NOTE: 'case_note',
  CASE_QC_REJECTED: 'case_qc_rejected',
  CASE_QC_APPROVED: 'case_qc_approved',
  CASE_ESCALATED: 'case_escalated',
  SYSTEM: 'system',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export const ALL_NOTIFICATION_TYPES: NotificationType[] = Object.values(NOTIFICATION_TYPES);

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  [NOTIFICATION_TYPES.CLARIFICATION_REQUIRED]: 'Clarification required',
  [NOTIFICATION_TYPES.CLARIFICATION_REPLIED]: 'Clarification reply',
  [NOTIFICATION_TYPES.CLARIFICATION_RESOLVED]: 'Clarification resolved',
  [NOTIFICATION_TYPES.CASE_NOTE]: 'Case note',
  [NOTIFICATION_TYPES.CASE_QC_REJECTED]: 'QC rejected case',
  [NOTIFICATION_TYPES.CASE_QC_APPROVED]: 'QC approved case',
  [NOTIFICATION_TYPES.CASE_ESCALATED]: 'Case escalated',
  [NOTIFICATION_TYPES.SYSTEM]: 'System',
};

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  caseId: string | null;
  clarificationId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResult {
  items: NotificationDto[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
}

export function isNotificationType(value: string): value is NotificationType {
  return (ALL_NOTIFICATION_TYPES as string[]).includes(value);
}
