/**
 * Commercial & Pricing Engine contracts.
 */

import type { CaseCategory } from './caseTaxonomy';

export const BILLING_ARRANGEMENTS = {
  WEEKLY: 'weekly',
  BI_MONTHLY: 'bi_monthly',
  MONTHLY: 'monthly',
  QUARTERLY_INVOICE: 'quarterly_invoice',
  ADVANCE_PAYMENT: 'advance_payment',
} as const;

export type BillingArrangement =
  (typeof BILLING_ARRANGEMENTS)[keyof typeof BILLING_ARRANGEMENTS];

export const ALL_BILLING_ARRANGEMENTS: BillingArrangement[] =
  Object.values(BILLING_ARRANGEMENTS);

export const BILLING_ARRANGEMENT_LABELS: Record<BillingArrangement, string> = {
  [BILLING_ARRANGEMENTS.WEEKLY]: 'Weekly Invoice',
  [BILLING_ARRANGEMENTS.BI_MONTHLY]: 'Bi-Monthly Invoice',
  [BILLING_ARRANGEMENTS.MONTHLY]: 'Monthly Invoice',
  [BILLING_ARRANGEMENTS.QUARTERLY_INVOICE]: 'Quarterly Invoice',
  [BILLING_ARRANGEMENTS.ADVANCE_PAYMENT]: 'Advance Payment (Prepaid)',
};

export function isBillingArrangement(value: string): value is BillingArrangement {
  return (ALL_BILLING_ARRANGEMENTS as string[]).includes(value);
}

export const INVOICE_SCHEDULE_ARRANGEMENTS: BillingArrangement[] = [
  BILLING_ARRANGEMENTS.WEEKLY,
  BILLING_ARRANGEMENTS.BI_MONTHLY,
  BILLING_ARRANGEMENTS.MONTHLY,
  BILLING_ARRANGEMENTS.QUARTERLY_INVOICE,
];

export function isInvoiceScheduleArrangement(
  value: BillingArrangement | null | undefined,
): boolean {
  return Boolean(value && (INVOICE_SCHEDULE_ARRANGEMENTS as string[]).includes(value));
}

export const PRICE_SUBJECT_TYPES = {
  USER: 'user',
  ORGANIZATION: 'organization',
} as const;

export type PriceSubjectType =
  (typeof PRICE_SUBJECT_TYPES)[keyof typeof PRICE_SUBJECT_TYPES];

export interface CustomerPriceOverrideDto {
  id: string;
  subjectType: PriceSubjectType;
  subjectId: string;
  subjectLabel: string;
  treatmentPlanId: string;
  treatmentPlanName: string;
  price: number;
  currency: string;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const PREPAID_LEDGER_KINDS = {
  CREDIT: 'credit',
  DEBIT: 'debit',
} as const;

export type PrepaidLedgerKind =
  (typeof PREPAID_LEDGER_KINDS)[keyof typeof PREPAID_LEDGER_KINDS];

export interface PrepaidLedgerEntryDto {
  id: string;
  subjectType: PriceSubjectType;
  subjectId: string;
  kind: PrepaidLedgerKind;
  deltaCases: number;
  balanceAfter: number;
  caseId: string | null;
  reason: string;
  actorEmail: string | null;
  createdAt: string;
}

export const PAYMENT_PROVIDERS = {
  STRIPE: 'stripe',
  BANK_TRANSFER: 'bank_transfer',
  CUSTOM: 'custom',
} as const;

export type PaymentProviderId =
  (typeof PAYMENT_PROVIDERS)[keyof typeof PAYMENT_PROVIDERS];

export const ALL_PAYMENT_PROVIDERS: PaymentProviderId[] =
  Object.values(PAYMENT_PROVIDERS);

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProviderId, string> = {
  [PAYMENT_PROVIDERS.STRIPE]: 'Stripe',
  [PAYMENT_PROVIDERS.BANK_TRANSFER]: 'Bank Transfer',
  [PAYMENT_PROVIDERS.CUSTOM]: 'Custom Gateway',
};

export const PAYMENT_SESSION_STATUSES = {
  PENDING: 'pending',
  AWAITING_CONFIRMATION: 'awaiting_confirmation',
  PAID: 'paid',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;

export type PaymentSessionStatus =
  (typeof PAYMENT_SESSION_STATUSES)[keyof typeof PAYMENT_SESSION_STATUSES];

export interface PaymentProviderConfigDto {
  id: string;
  provider: PaymentProviderId;
  label: string;
  enabled: boolean;
  /** Non-secret instructions / public config (bank account details, etc.). */
  instructions: string;
  config: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSessionDto {
  id: string;
  status: PaymentSessionStatus;
  provider: PaymentProviderId | null;
  amount: number;
  currency: string;
  discountCode: string | null;
  treatmentPlanId: string | null;
  isDemo: boolean;
  checkoutUrl: string | null;
  bankReference: string | null;
  stripeSessionId: string | null;
  caseId: string | null;
  invoiceId: string | null;
  receiptId: string | null;
  createdAt: string;
  expiresAt: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
}

export interface ResolvedCasePricing {
  treatmentPlanId: string;
  treatmentPlanName: string;
  standardPrice: number;
  customerPrice: number | null;
  unitPrice: number;
  discountCode: string | null;
  discountAmount: number;
  finalPayableAmount: number;
  currency: string;
  priceSource: 'standard' | 'customer_override' | 'free_demo';
  isFreeDemoPlan: boolean;
}

export type CreateEligibilityReason =
  | 'demo'
  | 'prepaid'
  | 'invoice_schedule'
  | 'zero_amount'
  | 'must_pay';

export interface CreateCaseEligibility {
  allowedWithoutPayment: boolean;
  reason: CreateEligibilityReason;
  pricing: ResolvedCasePricing;
  prepaidBalance: number | null;
  billingArrangement: BillingArrangement | null;
  message: string;
}

export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  caseId: string | null;
  /** Human-readable case IDs covered by this invoice (batch or single). */
  caseIds: string[];
  paymentSessionId: string | null;
  customerUserId: string | null;
  customerEmail: string;
  customerName: string;
  currency: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  status: 'draft' | 'issued' | 'paid' | 'void';
  lineDescription: string;
  issuedAt: string;
  paidAt: string | null;
  createdAt: string;
}

export interface BatchInvoiceResult {
  invoices: InvoiceDto[];
  billedCaseIds: string[];
  skipped: Array<{ caseId: string; reason: string }>;
  message: string;
}

export interface PaymentReceiptDto {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  caseId: string | null;
  paymentSessionId: string | null;
  amount: number;
  currency: string;
  provider: PaymentProviderId | null;
  providerReference: string | null;
  paidAt: string;
  createdAt: string;
}

export const DEMO_CASE_MESSAGES = {
  contactWithinWorkingHours: 8,
  planReadyWithinWorkingDays: 2,
  /** Business hours for demo SLA (2 working days × 8h). */
  slaBusinessHours: 16,
  confirmation:
    'Your Demo Case was submitted. Our team will contact you within 8 working hours to gather requirements. A demo treatment plan will be ready within 2 working days after successful submission.',
} as const;

export function formatInvoiceNumber(seq: number): string {
  return `INV-${String(seq).padStart(8, '0')}`;
}

export function formatReceiptNumber(seq: number): string {
  return `RCPT-${String(seq).padStart(8, '0')}`;
}

export interface BillingProfileDto {
  subjectType: PriceSubjectType;
  subjectId: string;
  subjectLabel: string;
  billingArrangement: BillingArrangement | null;
  prepaidCaseBalance: number;
}
