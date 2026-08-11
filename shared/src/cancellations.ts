/**
 * Case Cancellation audit reporting contracts.
 */

import type { AccountType } from './account';
import type { CaseCategory, CaseType, RefundStatus } from './caseTaxonomy';
import type { CaseStatus } from './cases';
import type { PaymentStatus } from './treatment';

export const CANCELLATION_TREND_GRANULARITIES = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
} as const;

export type CancellationTrendGranularity =
  (typeof CANCELLATION_TREND_GRANULARITIES)[keyof typeof CANCELLATION_TREND_GRANULARITIES];

export const ALL_CANCELLATION_TREND_GRANULARITIES: CancellationTrendGranularity[] =
  Object.values(CANCELLATION_TREND_GRANULARITIES);

export function isCancellationTrendGranularity(
  value: string,
): value is CancellationTrendGranularity {
  return (ALL_CANCELLATION_TREND_GRANULARITIES as string[]).includes(value);
}

export interface CancellationAuditDto {
  id: string;
  caseId: string;
  patientId: string | null;
  patientName: string;
  doctorUserId: string;
  doctorName: string;
  doctorDisplayId: string | null;
  coordinatorId: string | null;
  coordinatorName: string | null;
  organizationId: string | null;
  companyName: string | null;
  facilityId: string | null;
  accountType: AccountType | null;
  caseCategory: CaseCategory | null;
  caseType: CaseType | null;
  treatmentPlanName: string | null;
  caseValue: number | null;
  currency: string;
  invoiceNumber: string | null;
  paymentStatus: PaymentStatus | null;
  refundAmount: number;
  refundedAmount: number;
  pendingRefundAmount: number;
  refundStatus: RefundStatus;
  cancellationReason: string;
  cancellationRemarks: string | null;
  statusAtCancellation: CaseStatus;
  submittedAt: string | null;
  cancelledAt: string;
  remainingWindowSeconds: number;
  cancelledById: string;
  cancelledByName: string;
  cancelledByEmail: string | null;
  cancelledByRole: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceSummary: string | null;
  paymentTransactionReference: string | null;
  refundTransactionReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CancellationReportSummary {
  totalCancelled: number;
  totalCasesInPeriod: number;
  cancellationPercent: number;
  totalCaseValue: number;
  totalRefundAmount: number;
  refundedAmount: number;
  pendingRefundAmount: number;
  refundsPending: number;
  refundsProcessed: number;
  refundsApproved: number;
  refundsRejected: number;
}

export interface CancellationTrendPoint {
  period: string;
  label: string;
  cancelled: number;
  refundAmount: number;
  refundedAmount: number;
  pendingRefundAmount: number;
}

export interface CancellationReportResult {
  items: CancellationAuditDto[];
  total: number;
  page: number;
  pageSize: number;
  summary: CancellationReportSummary;
  trends: CancellationTrendPoint[];
  trendGranularity: CancellationTrendGranularity;
}
