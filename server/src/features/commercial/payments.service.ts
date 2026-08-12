import {
  AUDIT_ACTIONS,
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER_LABELS,
  PAYMENT_SESSION_STATUSES,
  PAYMENT_STATUSES,
  type CreateCaseInput,
  type PaymentProviderConfigDto,
  type PaymentProviderId,
  type PaymentSessionDto,
} from '@ayetis/shared';
import {
  PaymentProviderConfig,
  PaymentSession,
  type IPaymentSession,
} from '../../models/Commercial';
import { Case } from '../../models/Case';
import { User } from '../../models/User';
import { AppError } from '../../utils/AppError';
import { env } from '../../config/env';
import {
  recordActivity,
  type RequestAuditContext,
} from '../audit/audit.service';
import {
  createStripeCheckout,
  confirmStripeSession,
  isStripeConfigured,
} from './paymentProviders';
import { evaluateCreateEligibility, redeemDiscountCode } from './pricingBilling.service';
import { issueInvoiceAndReceipt } from './invoices.service';

export function paymentSessionDto(doc: IPaymentSession): PaymentSessionDto {
  return {
    id: doc.id,
    status: doc.status,
    provider: doc.provider ?? null,
    amount: doc.amount,
    currency: doc.currency,
    discountCode: doc.discountCode ?? null,
    treatmentPlanId: doc.treatmentPlanId ? String(doc.treatmentPlanId) : null,
    isDemo: Boolean(doc.isDemo),
    checkoutUrl: doc.checkoutUrl ?? null,
    bankReference: doc.bankReference ?? null,
    stripeSessionId: doc.stripeSessionId ?? null,
    caseId: doc.caseId ? String(doc.caseId) : null,
    invoiceId: doc.invoiceId ? String(doc.invoiceId) : null,
    receiptId: doc.receiptId ? String(doc.receiptId) : null,
    createdAt: doc.createdAt.toISOString(),
    expiresAt: doc.expiresAt ? doc.expiresAt.toISOString() : null,
  };
}

export function providerConfigDto(
  doc: InstanceType<typeof PaymentProviderConfig>,
): PaymentProviderConfigDto {
  const raw = (doc.config ?? {}) as Record<string, string>;
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (/secret|key|token|password/i.test(key)) continue;
    safe[key] = value;
  }
  return {
    id: doc.id,
    provider: doc.provider,
    label: doc.label,
    enabled: doc.enabled,
    instructions: doc.instructions ?? '',
    config: safe,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function ensureDefaultProviders() {
  const defaults: Array<{
    provider: PaymentProviderId;
    label: string;
    instructions: string;
  }> = [
    {
      provider: PAYMENT_PROVIDERS.STRIPE,
      label: PAYMENT_PROVIDER_LABELS.stripe,
      instructions: isStripeConfigured()
        ? 'Pay securely with Stripe Checkout.'
        : 'Stripe is in mock mode (STRIPE_SECRET_KEY not set). Admins can mark paid in non-prod.',
    },
    {
      provider: PAYMENT_PROVIDERS.BANK_TRANSFER,
      label: PAYMENT_PROVIDER_LABELS.bank_transfer,
      instructions:
        'Transfer the amount to the Ayetis business account and submit your payment reference. An admin will confirm receipt.',
    },
  ];

  for (const item of defaults) {
    await PaymentProviderConfig.findOneAndUpdate(
      { provider: item.provider },
      {
        $setOnInsert: {
          provider: item.provider,
          label: item.label,
          enabled: true,
          instructions: item.instructions,
          config: {},
        },
      },
      { upsert: true },
    );
  }
}

export async function listPaymentProviders(enabledOnly = false) {
  await ensureDefaultProviders();
  const filter = enabledOnly ? { enabled: true } : {};
  const items = await PaymentProviderConfig.find(filter).sort({ label: 1 });
  return items.map(providerConfigDto);
}

export async function upsertPaymentProvider(
  input: {
    id?: string;
    provider: PaymentProviderId;
    label: string;
    enabled?: boolean;
    instructions?: string;
    config?: Record<string, string>;
  },
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
) {
  let doc = input.id
    ? await PaymentProviderConfig.findById(input.id)
    : await PaymentProviderConfig.findOne({ provider: input.provider });

  if (input.id && !doc) throw new AppError('Provider config not found', 404);
  if (!doc) {
    doc = new PaymentProviderConfig({ provider: input.provider, label: input.label });
  }

  doc.label = input.label;
  if (input.enabled !== undefined) doc.enabled = input.enabled;
  if (input.instructions !== undefined) doc.instructions = input.instructions;
  if (input.config) doc.config = input.config;
  await doc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.PAYMENT_PROVIDER_UPSERT,
    summary: `${actor.email} saved payment provider ${doc.label}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'system',
    targetId: doc.id,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return providerConfigDto(doc);
}

export async function createPaymentSession(
  userId: string,
  createPayload: CreateCaseInput,
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
): Promise<PaymentSessionDto> {
  const planId = createPayload.commercial?.treatmentPlanId;
  if (!planId) throw new AppError('Treatment plan is required for payment', 400);

  const eligibility = await evaluateCreateEligibility({
    userId,
    treatmentPlanId: planId,
    discountCode: createPayload.commercial?.discountCode,
    isDemo: createPayload.isDemo,
    caseCategory: createPayload.caseCategory,
  });

  if (eligibility.allowedWithoutPayment) {
    throw new AppError(
      eligibility.message || 'Payment session is not required for this case',
      400,
    );
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session = await PaymentSession.create({
    userId,
    status: PAYMENT_SESSION_STATUSES.PENDING,
    amount: eligibility.pricing.finalPayableAmount,
    currency: eligibility.pricing.currency,
    discountCode: eligibility.pricing.discountCode || undefined,
    treatmentPlanId: planId,
    isDemo: Boolean(createPayload.isDemo),
    createPayload: createPayload as unknown as Record<string, unknown>,
    expiresAt,
  });

  await recordActivity({
    action: AUDIT_ACTIONS.PAYMENT_SESSION_CREATE,
    summary: `${actor.email} created payment session ${session.id}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'payment',
    targetId: session.id,
    metadata: { amount: session.amount, currency: session.currency },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return paymentSessionDto(session);
}

export async function getPaymentSession(
  sessionId: string,
  requesterId: string,
  canViewAll: boolean,
) {
  const session = await PaymentSession.findById(sessionId);
  if (!session) throw new AppError('Payment session not found', 404);
  if (!canViewAll && String(session.userId) !== requesterId) {
    throw new AppError('Payment session not found', 404);
  }
  return paymentSessionDto(session);
}

export async function selectPaymentProvider(
  sessionId: string,
  provider: PaymentProviderId,
  requesterId: string,
): Promise<PaymentSessionDto> {
  const session = await PaymentSession.findById(sessionId);
  if (!session) throw new AppError('Payment session not found', 404);
  if (String(session.userId) !== requesterId) {
    throw new AppError('Not allowed', 403);
  }
  if (
    session.status !== PAYMENT_SESSION_STATUSES.PENDING &&
    session.status !== PAYMENT_SESSION_STATUSES.AWAITING_CONFIRMATION
  ) {
    throw new AppError('Payment session is no longer payable', 400);
  }

  await ensureDefaultProviders();
  const config = await PaymentProviderConfig.findOne({ provider, enabled: true });
  if (!config && provider !== PAYMENT_PROVIDERS.CUSTOM) {
    throw new AppError('Payment provider is not enabled', 400);
  }

  session.provider = provider;

  if (provider === PAYMENT_PROVIDERS.STRIPE) {
    const checkout = await createStripeCheckout(session);
    session.checkoutUrl = checkout.checkoutUrl;
    session.stripeSessionId = checkout.stripeSessionId;
    session.status = PAYMENT_SESSION_STATUSES.PENDING;
  } else if (provider === PAYMENT_PROVIDERS.BANK_TRANSFER) {
    session.checkoutUrl = undefined;
    session.status = PAYMENT_SESSION_STATUSES.AWAITING_CONFIRMATION;
  } else {
    session.status = PAYMENT_SESSION_STATUSES.AWAITING_CONFIRMATION;
  }

  await session.save();
  return paymentSessionDto(session);
}

export async function submitBankReference(
  sessionId: string,
  bankReference: string,
  requesterId: string,
): Promise<PaymentSessionDto> {
  const session = await PaymentSession.findById(sessionId);
  if (!session) throw new AppError('Payment session not found', 404);
  if (String(session.userId) !== requesterId) throw new AppError('Not allowed', 403);
  if (session.provider !== PAYMENT_PROVIDERS.BANK_TRANSFER) {
    throw new AppError('Bank reference only applies to bank transfer', 400);
  }
  session.bankReference = bankReference.trim();
  session.status = PAYMENT_SESSION_STATUSES.AWAITING_CONFIRMATION;
  await session.save();
  return paymentSessionDto(session);
}

async function fulfillPaidSession(
  session: IPaymentSession,
  opts: {
    providerReference?: string;
    actor?: { id: string; email: string; role: string };
    audit?: RequestAuditContext;
  },
): Promise<PaymentSessionDto> {
  if (session.status === PAYMENT_SESSION_STATUSES.PAID && session.caseId) {
    return paymentSessionDto(session);
  }

  const payload = session.createPayload as unknown as CreateCaseInput;
  const { createCase } = await import('../cases/cases.service');

  const user = await User.findById(session.userId);
  if (!user) throw new AppError('Session user not found', 404);

  const actor = opts.actor ?? {
    id: String(user._id),
    email: user.email,
    role: user.role,
  };

  const created = await createCase(
    await (await import('../cases/cases.service')).resolveCaseActor(String(user._id)),
    {
      ...payload,
      asDraft: false,
      paymentSessionId: session.id,
    },
    opts.audit,
  );

  const caseDoc = await Case.findOne({ caseId: created.caseId });
  if (!caseDoc) throw new AppError('Created case not found', 500);

  const docs = await issueInvoiceAndReceipt({
    caseId: caseDoc.id,
    billedCaseIds: [created.caseId],
    paymentSessionId: session.id,
    customerUserId: String(user._id),
    customerEmail: user.email,
    customerName: `${user.firstName} ${user.lastName}`.trim(),
    currency: session.currency,
    subtotal:
      Number(payload.commercial?.unitPrice ?? session.amount) +
      Number(payload.commercial?.discountAmount ?? 0),
    discountAmount: Number(payload.commercial?.discountAmount ?? 0),
    total: session.amount,
    lineDescription: payload.commercial?.treatmentPlanName || `Case ${created.caseId}`,
    provider: session.provider,
    providerReference: opts.providerReference || session.stripeSessionId || session.bankReference,
    markPaid: true,
    actor,
    audit: opts.audit,
  });

  if (session.discountCode) {
    await redeemDiscountCode(session.discountCode);
  }

  caseDoc.payment = {
    ...caseDoc.payment,
    status: PAYMENT_STATUSES.PAID,
    currency: session.currency,
    amountDue: session.amount,
    amountPaid: session.amount,
    invoiceNumber: docs.invoice.invoiceNumber,
    notes: caseDoc.payment?.notes ?? '',
  };
  caseDoc.invoiceId = docs.invoice.id as never;
  caseDoc.paymentSessionId = session._id;
  await caseDoc.save();

  session.status = PAYMENT_SESSION_STATUSES.PAID;
  session.paidAt = new Date();
  session.caseId = caseDoc._id;
  session.invoiceId = docs.invoice.id as never;
  session.receiptId = docs.receipt?.id as never;
  if (opts.providerReference) {
    session.stripePaymentIntentId = opts.providerReference;
  }
  await session.save();

  await recordActivity({
    action: AUDIT_ACTIONS.PAYMENT_SESSION_PAID,
    summary: `Payment session ${session.id} paid; case ${created.caseId} created`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'payment',
    targetId: session.id,
    metadata: { caseId: created.caseId, invoiceId: docs.invoice.id },
    ipAddress: opts.audit?.ipAddress,
    userAgent: opts.audit?.userAgent,
  });

  return paymentSessionDto(session);
}

export async function confirmPaymentSession(
  sessionId: string,
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
  opts?: { mockStripe?: boolean },
): Promise<PaymentSessionDto> {
  const session = await PaymentSession.findById(sessionId);
  if (!session) throw new AppError('Payment session not found', 404);

  if (
    session.provider === PAYMENT_PROVIDERS.STRIPE &&
    opts?.mockStripe &&
    !isStripeConfigured() &&
    env.isDev
  ) {
    return fulfillPaidSession(session, {
      providerReference: session.stripeSessionId || `mock_${session.id}`,
      actor,
      audit,
    });
  }

  if (session.provider === PAYMENT_PROVIDERS.BANK_TRANSFER) {
    if (!session.bankReference?.trim()) {
      throw new AppError('Bank transfer reference is required before confirmation', 400);
    }
    return fulfillPaidSession(session, {
      providerReference: session.bankReference,
      actor,
      audit,
    });
  }

  if (session.provider === PAYMENT_PROVIDERS.STRIPE && !isStripeConfigured() && env.isDev) {
    return fulfillPaidSession(session, {
      providerReference: session.stripeSessionId || `mock_${session.id}`,
      actor,
      audit,
    });
  }

  throw new AppError('Manual confirm is only for bank transfer or Stripe mock mode', 400);
}

export async function handleStripeWebhook(
  body: Buffer,
  signature: string | undefined,
): Promise<{ handled: boolean }> {
  const parsed = await confirmStripeSession(body, signature);
  if (!parsed) return { handled: false };

  const session = await PaymentSession.findById(parsed.paymentSessionId);
  if (!session) throw new AppError('Payment session not found', 404);
  session.stripeSessionId = parsed.stripeSessionId;
  session.provider = PAYMENT_PROVIDERS.STRIPE;
  await session.save();
  await fulfillPaidSession(session, { providerReference: parsed.stripeSessionId });
  return { handled: true };
}
