/**
 * URD Case Category / Type taxonomy and SLA / refund / cancel helpers.
 */

export const CASE_CATEGORIES = {
  DIGITAL_ALIGNER: 'digital_aligner',
  PROSTHODONTIC: 'prosthodontic',
  IMPLANT: 'implant',
} as const;

export type CaseCategory = (typeof CASE_CATEGORIES)[keyof typeof CASE_CATEGORIES];

export const ALL_CASE_CATEGORIES: CaseCategory[] = Object.values(CASE_CATEGORIES);

export const CASE_CATEGORY_LABELS: Record<CaseCategory, string> = {
  [CASE_CATEGORIES.DIGITAL_ALIGNER]: 'Digital Aligner Treatment Planning',
  [CASE_CATEGORIES.PROSTHODONTIC]: 'Prosthodontic Planning',
  [CASE_CATEGORIES.IMPLANT]: 'Implant Planning',
};

export const CASE_TYPES = {
  // Digital Aligner
  NEW: 'new',
  MODIFICATION: 'modification',
  REFINEMENT: 'refinement',
  RETAINER: 'retainer',
  // Prosthodontic
  CROWN: 'crown',
  BRIDGE: 'bridge',
  PARTIAL_DENTURE: 'partial_denture',
  COMPLETE_DENTURE: 'complete_denture',
  // Implant
  IMPLANT_TREATMENT_PLANNING: 'implant_treatment_planning',
} as const;

export type CaseType = (typeof CASE_TYPES)[keyof typeof CASE_TYPES];

export const ALL_CASE_TYPES: CaseType[] = Object.values(CASE_TYPES);

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  [CASE_TYPES.NEW]: 'New Case',
  [CASE_TYPES.MODIFICATION]: 'Modification Case',
  [CASE_TYPES.REFINEMENT]: 'Refinement Case',
  [CASE_TYPES.RETAINER]: 'Retainer',
  [CASE_TYPES.CROWN]: 'Crown Design',
  [CASE_TYPES.BRIDGE]: 'Bridge Design',
  [CASE_TYPES.PARTIAL_DENTURE]: 'Partial Denture Design',
  [CASE_TYPES.COMPLETE_DENTURE]: 'Complete Denture Design',
  [CASE_TYPES.IMPLANT_TREATMENT_PLANNING]: 'Implant Treatment Planning',
};

export const CASE_TYPES_BY_CATEGORY: Record<CaseCategory, CaseType[]> = {
  [CASE_CATEGORIES.DIGITAL_ALIGNER]: [
    CASE_TYPES.NEW,
    CASE_TYPES.MODIFICATION,
    CASE_TYPES.REFINEMENT,
    CASE_TYPES.RETAINER,
  ],
  [CASE_CATEGORIES.PROSTHODONTIC]: [
    CASE_TYPES.CROWN,
    CASE_TYPES.BRIDGE,
    CASE_TYPES.PARTIAL_DENTURE,
    CASE_TYPES.COMPLETE_DENTURE,
  ],
  [CASE_CATEGORIES.IMPLANT]: [CASE_TYPES.IMPLANT_TREATMENT_PLANNING],
};

export function isCaseCategory(value: string): value is CaseCategory {
  return (ALL_CASE_CATEGORIES as string[]).includes(value);
}

export function isCaseType(value: string): value is CaseType {
  return (ALL_CASE_TYPES as string[]).includes(value);
}

export function isCaseTypeForCategory(category: CaseCategory, type: CaseType): boolean {
  return CASE_TYPES_BY_CATEGORY[category].includes(type);
}

/** Refund status tracked on cancellation audits (no payment gateway in this pass). */
export const REFUND_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PROCESSED: 'processed',
  NOT_APPLICABLE: 'not_applicable',
} as const;

export type RefundStatus = (typeof REFUND_STATUSES)[keyof typeof REFUND_STATUSES];

export const ALL_REFUND_STATUSES: RefundStatus[] = Object.values(REFUND_STATUSES);

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  [REFUND_STATUSES.PENDING]: 'Pending',
  [REFUND_STATUSES.APPROVED]: 'Approved',
  [REFUND_STATUSES.REJECTED]: 'Rejected',
  [REFUND_STATUSES.PROCESSED]: 'Processed',
  [REFUND_STATUSES.NOT_APPLICABLE]: 'Not applicable',
};

export function isRefundStatus(value: string): value is RefundStatus {
  return (ALL_REFUND_STATUSES as string[]).includes(value);
}

export const DEFAULT_CANCEL_REASONS = [
  'Submitted in error',
  'Incorrect patient information',
  'Wrong treatment category/type',
  'Duplicate case',
  'Patient declined treatment',
  'Other',
] as const;

/** Minutes after submission during which New Case may be cancelled. */
export const CASE_CANCEL_WINDOW_MINUTES = 15;

/** Default SLA business hours (excludes weekends). */
export const DEFAULT_SLA_BUSINESS_HOURS = 48;

export const SLA_PROGRESS_COLORS = {
  GREEN: 'green',
  YELLOW: 'yellow',
  BLUE: 'blue',
  ORANGE: 'orange',
  RED: 'red',
} as const;

export type SlaProgressColor =
  (typeof SLA_PROGRESS_COLORS)[keyof typeof SLA_PROGRESS_COLORS];

export const ALL_SLA_PROGRESS_COLORS: SlaProgressColor[] = Object.values(SLA_PROGRESS_COLORS);

export const SLA_PROGRESS_COLOR_LABELS: Record<SlaProgressColor, string> = {
  [SLA_PROGRESS_COLORS.GREEN]: 'Within SLA (≤25%)',
  [SLA_PROGRESS_COLORS.YELLOW]: 'Approaching (≤50%)',
  [SLA_PROGRESS_COLORS.BLUE]: 'Aging (≤75%)',
  [SLA_PROGRESS_COLORS.ORANGE]: 'Critical (≤90%)',
  [SLA_PROGRESS_COLORS.RED]: 'Breached (≥100%)',
};

/**
 * Map SLA utilization percent to URD progress bar color.
 * Up to 25% Green, 50% Yellow, 75% Blue, 90% Orange, 100%+ Red.
 */
export function slaProgressColor(utilizationPercent: number): SlaProgressColor {
  if (utilizationPercent <= 25) return SLA_PROGRESS_COLORS.GREEN;
  if (utilizationPercent <= 50) return SLA_PROGRESS_COLORS.YELLOW;
  if (utilizationPercent <= 75) return SLA_PROGRESS_COLORS.BLUE;
  if (utilizationPercent <= 90) return SLA_PROGRESS_COLORS.ORANGE;
  return SLA_PROGRESS_COLORS.RED;
}

export function remainingCancelWindowSeconds(
  submittedAt: Date | string | null | undefined,
  now = new Date(),
  windowMinutes = CASE_CANCEL_WINDOW_MINUTES,
): number {
  if (!submittedAt) return 0;
  const start = typeof submittedAt === 'string' ? new Date(submittedAt) : submittedAt;
  const expires = start.getTime() + windowMinutes * 60 * 1000;
  return Math.max(0, Math.floor((expires - now.getTime()) / 1000));
}

export function isWithinCancelWindow(
  submittedAt: Date | string | null | undefined,
  now = new Date(),
  windowMinutes = CASE_CANCEL_WINDOW_MINUTES,
): boolean {
  return remainingCancelWindowSeconds(submittedAt, now, windowMinutes) > 0;
}

/** Legacy → URD status migration map. */
export const LEGACY_STATUS_TO_URD: Record<string, string> = {
  submitted: 'new_case',
  under_validation: 'in_process',
  waiting_clarification: 'in_process',
  sent_for_modification: 'in_process',
  designer_working: 'in_process',
  qc_review: 'in_process',
  orthodontist_review: 'in_process',
  delivered: 'waiting_for_approval',
  approved: 'waiting_for_approval',
  completed: 'approved',
  cancelled: 'cancelled',
};
