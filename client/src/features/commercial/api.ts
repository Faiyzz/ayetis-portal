import type {
  BatchInvoiceResult,
  BillingArrangement,
  BillingProfileDto,
  CreateCaseEligibility,
  CreateCaseInput,
  CustomerPriceOverrideDto,
  DiscountCodeDto,
  InvoiceDto,
  PaymentProviderConfigDto,
  PaymentSessionDto,
  PrepaidLedgerEntryDto,
  PriceSubjectType,
  ResolvedCasePricing,
  TreatmentPlanDto,
} from '@ayetis/shared';
import api from '@/lib/api';

export async function fetchTreatmentPlans(activeOnly = false): Promise<TreatmentPlanDto[]> {
  const { data } = await api.get('/commercial/treatment-plans', {
    params: { activeOnly: activeOnly ? 'true' : 'false' },
  });
  return data.data;
}

export async function upsertTreatmentPlan(payload: {
  id?: string;
  name: string;
  caseCategory?: string | null;
  description?: string;
  price: number;
  currency?: string;
  estimatedDeliveryHours?: number | null;
  isActive?: boolean;
  isDefault?: boolean;
  isFreeDemo?: boolean;
  archived?: boolean;
}): Promise<TreatmentPlanDto> {
  const { data } = await api.post('/commercial/treatment-plans', payload);
  return data.data;
}

export async function fetchDiscountCodes(): Promise<DiscountCodeDto[]> {
  const { data } = await api.get('/commercial/discount-codes');
  return data.data;
}

export async function upsertDiscountCode(payload: {
  id?: string;
  code: string;
  description?: string;
  percentOff?: number | null;
  amountOff?: number | null;
  currency?: string;
  customerUserId?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  isActive?: boolean;
  maxUses?: number | null;
  applicableCaseCategories?: string[];
  applicablePlanIds?: string[];
}): Promise<DiscountCodeDto> {
  const { data } = await api.post('/commercial/discount-codes', payload);
  return data.data;
}

export async function validateDiscountCode(
  code: string,
  opts?: { treatmentPlanId?: string; caseCategory?: string | null },
): Promise<DiscountCodeDto> {
  const { data } = await api.post('/commercial/discount-codes/validate', {
    code,
    ...opts,
  });
  return data.data;
}

export async function updateDoctorSlaHours(
  userId: string,
  slaBusinessHours: number,
): Promise<{ id: string; slaBusinessHours: number }> {
  const { data } = await api.patch(`/commercial/users/${userId}/sla`, { slaBusinessHours });
  return data.data;
}

export async function resolvePricing(payload: {
  treatmentPlanId: string;
  discountCode?: string | null;
  caseCategory?: string | null;
}): Promise<ResolvedCasePricing> {
  const { data } = await api.post('/commercial/pricing/resolve', payload);
  return data.data;
}

export async function checkCreateEligibility(payload: {
  treatmentPlanId: string;
  discountCode?: string | null;
  isDemo?: boolean;
  caseCategory?: string | null;
}): Promise<CreateCaseEligibility> {
  const { data } = await api.post('/commercial/eligibility', payload);
  return data.data;
}

export async function fetchCustomerPrices(): Promise<CustomerPriceOverrideDto[]> {
  const { data } = await api.get('/commercial/customer-prices');
  return data.data;
}

export async function upsertCustomerPrice(payload: {
  id?: string;
  subjectType: PriceSubjectType;
  subjectId: string;
  treatmentPlanId: string;
  price: number;
  currency?: string;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  isActive?: boolean;
}): Promise<CustomerPriceOverrideDto> {
  const { data } = await api.post('/commercial/customer-prices', payload);
  return data.data;
}

export async function fetchBillingProfile(
  subjectType: PriceSubjectType,
  subjectId: string,
): Promise<BillingProfileDto> {
  const { data } = await api.get(`/commercial/billing/${subjectType}/${subjectId}`);
  return data.data;
}

export async function updateBillingArrangement(payload: {
  subjectType: PriceSubjectType;
  subjectId: string;
  billingArrangement: BillingArrangement | null;
}): Promise<BillingProfileDto> {
  const { data } = await api.put('/commercial/billing', payload);
  return data.data;
}

export async function creditPrepaid(payload: {
  subjectType: PriceSubjectType;
  subjectId: string;
  cases: number;
  reason?: string;
}): Promise<PrepaidLedgerEntryDto> {
  const { data } = await api.post('/commercial/prepaid/credit', payload);
  return data.data;
}

export async function fetchPrepaidLedger(
  subjectType: PriceSubjectType,
  subjectId: string,
): Promise<PrepaidLedgerEntryDto[]> {
  const { data } = await api.get(`/commercial/prepaid/${subjectType}/${subjectId}/ledger`);
  return data.data;
}

export async function fetchPaymentProviders(): Promise<PaymentProviderConfigDto[]> {
  const { data } = await api.get('/commercial/payment-providers');
  return data.data;
}

export async function upsertPaymentProvider(payload: {
  id?: string;
  provider: string;
  label: string;
  enabled?: boolean;
  instructions?: string;
  config?: Record<string, string>;
}): Promise<PaymentProviderConfigDto> {
  const { data } = await api.post('/commercial/payment-providers', payload);
  return data.data;
}

export async function createPaymentSession(
  createPayload: CreateCaseInput,
): Promise<PaymentSessionDto> {
  const { data } = await api.post('/commercial/payment-sessions', { createPayload });
  return data.data;
}

export async function fetchPaymentSession(sessionId: string): Promise<PaymentSessionDto> {
  const { data } = await api.get(`/commercial/payment-sessions/${sessionId}`);
  return data.data;
}

export async function selectPaymentProvider(
  sessionId: string,
  provider: string,
): Promise<PaymentSessionDto> {
  const { data } = await api.post(`/commercial/payment-sessions/${sessionId}/provider`, {
    provider,
  });
  return data.data;
}

export async function submitBankReference(
  sessionId: string,
  bankReference: string,
): Promise<PaymentSessionDto> {
  const { data } = await api.post(`/commercial/payment-sessions/${sessionId}/bank-reference`, {
    bankReference,
  });
  return data.data;
}

export async function confirmPaymentSession(
  sessionId: string,
  opts?: { mockStripe?: boolean },
): Promise<PaymentSessionDto> {
  const path = opts?.mockStripe
    ? `/commercial/payment-sessions/${sessionId}/mock-pay`
    : `/commercial/payment-sessions/${sessionId}/confirm`;
  const { data } = await api.post(path, opts ?? {});
  return data.data;
}

export async function fetchInvoices(params?: {
  caseId?: string;
  customerUserId?: string;
}): Promise<InvoiceDto[]> {
  const { data } = await api.get('/commercial/invoices', { params });
  return data.data;
}

export async function fetchInvoice(id: string): Promise<InvoiceDto> {
  const { data } = await api.get(`/commercial/invoices/${id}`);
  return data.data;
}

export function invoiceHtmlUrl(id: string) {
  return `/api/commercial/invoices/${id}/html`;
}

export function receiptHtmlUrl(id: string) {
  return `/api/commercial/receipts/${id}/html`;
}

export async function generateBatchInvoices(caseIds?: string[]): Promise<BatchInvoiceResult> {
  const { data } = await api.post('/commercial/invoices/batch', {
    caseIds: caseIds ?? [],
  });
  return data.data;
}
