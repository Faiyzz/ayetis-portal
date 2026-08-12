/**
 * Notification channels for Doctor Notification Center (URD).
 * Status Alerts (bell) vs Clarification notifications — independent unread/mark-read.
 */

import {
  ALL_NOTIFICATION_TYPES,
  NOTIFICATION_EMAIL_TEMPLATE,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPES,
  type NotificationType,
} from './notifications';

export const NOTIFICATION_CHANNELS = {
  STATUS_ALERTS: 'status_alerts',
  CLARIFICATIONS: 'clarifications',
} as const;

export type NotificationChannel =
  (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS];

export const ALL_NOTIFICATION_CHANNELS: NotificationChannel[] = Object.values(
  NOTIFICATION_CHANNELS,
);

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  [NOTIFICATION_CHANNELS.STATUS_ALERTS]: 'Status Alerts',
  [NOTIFICATION_CHANNELS.CLARIFICATIONS]: 'Clarifications',
};

export function isNotificationChannel(value: string): value is NotificationChannel {
  return (ALL_NOTIFICATION_CHANNELS as string[]).includes(value);
}

/** Clarification channel notification types. */
export const CLARIFICATION_NOTIFICATION_TYPES: NotificationType[] = [
  NOTIFICATION_TYPES.CLARIFICATION_REQUIRED,
  NOTIFICATION_TYPES.CLARIFICATION_REPLIED,
  NOTIFICATION_TYPES.CLARIFICATION_RESOLVED,
];

export function notificationChannelForType(type: NotificationType): NotificationChannel {
  if ((CLARIFICATION_NOTIFICATION_TYPES as string[]).includes(type)) {
    return NOTIFICATION_CHANNELS.CLARIFICATIONS;
  }
  return NOTIFICATION_CHANNELS.STATUS_ALERTS;
}

export function typesForNotificationChannel(channel: NotificationChannel): NotificationType[] {
  if (channel === NOTIFICATION_CHANNELS.CLARIFICATIONS) {
    return [...CLARIFICATION_NOTIFICATION_TYPES];
  }
  return Object.values(NOTIFICATION_TYPES).filter(
    (type) => !(CLARIFICATION_NOTIFICATION_TYPES as string[]).includes(type),
  );
}

export interface NotificationCatalogItem {
  type: NotificationType;
  label: string;
  channel: NotificationChannel;
  emailTemplateKey: string | null;
}

export function notificationCatalog(): NotificationCatalogItem[] {
  return ALL_NOTIFICATION_TYPES.map((type) => ({
    type,
    label: NOTIFICATION_TYPE_LABELS[type],
    channel: notificationChannelForType(type),
    emailTemplateKey: NOTIFICATION_EMAIL_TEMPLATE[type] ?? null,
  }));
}
