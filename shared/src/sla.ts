/**
 * SLA Engine — account-type defaults, progress colors, warning/breach thresholds.
 * Color mapping lives in caseTaxonomy (`slaProgressColor`); this module owns config.
 */

import { ACCOUNT_TYPES, type AccountType } from './account';
import { DEFAULT_SLA_BUSINESS_HOURS } from './caseTaxonomy';

export const SLA_ACCOUNT_SEGMENTS = {
  INDIVIDUAL: 'individual',
  COMPANY: 'company',
  SUB_ACCOUNT: 'sub_account',
} as const;

export type SlaAccountSegment =
  (typeof SLA_ACCOUNT_SEGMENTS)[keyof typeof SLA_ACCOUNT_SEGMENTS];

export const ALL_SLA_ACCOUNT_SEGMENTS: SlaAccountSegment[] =
  Object.values(SLA_ACCOUNT_SEGMENTS);

export const SLA_ACCOUNT_SEGMENT_LABELS: Record<SlaAccountSegment, string> = {
  [SLA_ACCOUNT_SEGMENTS.INDIVIDUAL]: 'Individual',
  [SLA_ACCOUNT_SEGMENTS.COMPANY]: 'Company',
  [SLA_ACCOUNT_SEGMENTS.SUB_ACCOUNT]: 'Sub-Account',
};

/** Default when utilization hits the orange band (configurable). */
export const DEFAULT_SLA_WARNING_PERCENT = 90;

export interface SlaHoursBySegment {
  individual: number;
  company: number;
  sub_account: number;
}

export interface SlaConfigDto {
  hoursBySegment: SlaHoursBySegment;
  /** Fire "SLA Warning" when utilization reaches this percent (default 90). */
  warningPercent: number;
  updatedAt: string | null;
}

export const DEFAULT_SLA_HOURS_BY_SEGMENT: SlaHoursBySegment = {
  individual: DEFAULT_SLA_BUSINESS_HOURS,
  company: DEFAULT_SLA_BUSINESS_HOURS,
  sub_account: DEFAULT_SLA_BUSINESS_HOURS,
};

export const DEFAULT_SLA_CONFIG: Omit<SlaConfigDto, 'updatedAt'> = {
  hoursBySegment: { ...DEFAULT_SLA_HOURS_BY_SEGMENT },
  warningPercent: DEFAULT_SLA_WARNING_PERCENT,
};

export function isSlaAccountSegment(value: string): value is SlaAccountSegment {
  return (ALL_SLA_ACCOUNT_SEGMENTS as string[]).includes(value);
}

/**
 * Resolve SLA segment for a doctor/client account.
 * Individual → individual; corporate with subAccountId → sub_account; else company.
 */
export function resolveSlaAccountSegment(input: {
  accountType?: AccountType | string | null;
  subAccountId?: string | null;
}): SlaAccountSegment {
  if (input.accountType === ACCOUNT_TYPES.INDIVIDUAL || !input.accountType) {
    return SLA_ACCOUNT_SEGMENTS.INDIVIDUAL;
  }
  if (input.subAccountId) {
    return SLA_ACCOUNT_SEGMENTS.SUB_ACCOUNT;
  }
  return SLA_ACCOUNT_SEGMENTS.COMPANY;
}

export function hoursForSlaSegment(
  segment: SlaAccountSegment,
  hoursBySegment: Partial<SlaHoursBySegment> | null | undefined,
): number {
  const hours = hoursBySegment?.[segment];
  if (hours != null && Number.isFinite(hours) && hours >= 1) {
    return Math.floor(hours);
  }
  return DEFAULT_SLA_HOURS_BY_SEGMENT[segment] ?? DEFAULT_SLA_BUSINESS_HOURS;
}

/** Compact SLA snapshot for list/queue rows. */
export interface SlaProgressSnapshot {
  slaHours: number | null;
  slaDeadlineAt: string | null;
  slaUtilizationPercent: number | null;
  slaProgressColor: import('./caseTaxonomy').SlaProgressColor | null;
}
