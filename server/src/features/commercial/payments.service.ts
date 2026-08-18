import {
  AUDIT_ACTIONS,
  CASE_STATUSES,
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER_LABELS,
  PAYMENT_SESSION_STATUSES,
  PAYMENT_STATUSES,
  PERMISSIONS,
  permissionsInclude,
  type CreateCaseInput,
  type PaymentProviderConfigDto,
  type PaymentProviderId,
  type PaymentSessionDto,
} from '@ayetis/shared';
import { Types } from 'mongoose';
import {
  PaymentProviderConfig,
  PaymentSession,
  type IPaymentSession,
} from '../../models/Commercial';
import { Case, type ICase } from '../../models/Case';
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
  createPayload: CreateCaseInput & { draftId?: string; caseId?: string },
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
): Promise<PaymentSessionDto> {
  const planId = createPayload.commercial?.treatmentPlanId;
  if (!planId) throw new AppError('Treatment plan is required for payment', 400);

  const rawPayload = createPayload as unknown as Record<string, unknown>;
  const draftId = (rawPayload?.draftId as string) || (rawPayload?.caseId as string);

  let draftCaseDoc: ICase | null = null;
  if (draftId) {
    const { findCase } = await import('../cases/cases.service');
    draftCaseDoc = await findCase(draftId);
    if (!draftCaseDoc) {
      throw new AppError('Draft case not found', 404);
    }
    const isOwner = String(draftCaseDoc.doctorId) === actor.id;
    const { resolvePermissionsForUserId } = await import('../users/users.service');
    const userPerms = await resolvePermissionsForUserId(actor.id);
    const canManageAll = permissionsInclude(userPerms, PERMISSIONS.CASE_UPDATE);
    if (!isOwner && !canManageAll) {
      throw new AppError('You can only initiate payment for your own draft cases', 403);
    }
    if (draftCaseDoc.status !== CASE_STATUSES.SAVED_FOR_SUBMISSION) {
      throw new AppError('Only draft cases can be submitted through payment', 400);
    }

    // Check if there is already an active pending/awaiting session for this draft to reuse
    const existingSession = await PaymentSession.findOne({
      caseId: draftCaseDoc._id,
      status: {
        $in: [
          PAYMENT_SESSION_STATUSES.PENDING,
          PAYMENT_SESSION_STATUSES.AWAITING_CONFIRMATION,
        ],
      },
      expiresAt: { $gt: new Date() },
    });

    if (existingSession) {
      const eligibility = await evaluateCreateEligibility({
        userId,
        treatmentPlanId: planId,
        discountCode: createPayload.commercial?.discountCode,
        isDemo: createPayload.isDemo,
        caseCategory: createPayload.caseCategory,
      });
      existingSession.amount = eligibility.pricing.finalPayableAmount;
      existingSession.currency = eligibility.pricing.currency;
      existingSession.discountCode = eligibility.pricing.discountCode || undefined;
      existingSession.treatmentPlanId = new Types.ObjectId(planId);
      existingSession.createPayload = createPayload as unknown as Record<string, unknown>;
      await existingSession.save();
      return paymentSessionDto(existingSession);
    }
  }

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
    caseId: draftCaseDoc ? draftCaseDoc._id : undefined,
    expiresAt,
  });

  if (draftCaseDoc) {
    draftCaseDoc.paymentSessionId = session._id;
    await draftCaseDoc.save();
  }

  await recordActivity({
    action: AUDIT_ACTIONS.PAYMENT_SESSION_CREATE,
    summary: `${actor.email} created payment session ${session.id}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'payment',
    targetId: session.id,
    metadata: {
      amount: session.amount,
      currency: session.currency,
      draftId: draftCaseDoc?.caseId,
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return paymentSessionDto(session);
}

export async function listPaymentSessions(query: { status?: string } = {}) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  const items = await PaymentSession.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate({ path: 'userId', select: 'email firstName lastName' });

  return items.map((doc) => {
    const user = doc.userId as unknown as {
      email?: string;
      firstName?: string;
      lastName?: string;
    } | null;
    const name = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '';
    return {
      ...paymentSessionDto(doc),
      customerEmail: user?.email ?? null,
      customerName: name || null,
    };
  });
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
    const existingCase = await Case.findById(session.caseId);
    if (existingCase && existingCase.status !== CASE_STATUSES.SAVED_FOR_SUBMISSION) {
      return paymentSessionDto(session);
    }
  }

  const now = new Date();
  const lockExpiry = new Date(now.getTime() - 30000);
  const claimed = await PaymentSession.findOneAndUpdate(
    {
      _id: session._id,
      $or: [
        { isFulfilling: { $ne: true }, status: { $ne: PAYMENT_SESSION_STATUSES.PAID } },
        { isFulfilling: true, fulfillingAt: { $lt: lockExpiry }, status: { $ne: PAYMENT_SESSION_STATUSES.PAID } },
      ],
    },
    {
      $set: { isFulfilling: true, fulfillingAt: now },
    },
    { new: true },
  );

  if (!claimed) {
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const current = await PaymentSession.findById(session._id);
      if (current && current.status === PAYMENT_SESSION_STATUSES.PAID && current.caseId) {
        return paymentSessionDto(current);
      }
    }
    const finalSession = await PaymentSession.findById(session._id);
    if (finalSession && finalSession.status === PAYMENT_SESSION_STATUSES.PAID) {
      return paymentSessionDto(finalSession);
    }
  }

  try {
    const payload = session.createPayload as unknown as CreateCaseInput;
    const rawPayload = session.createPayload as Record<string, unknown>;
    const draftId =
      (rawPayload?.draftId as string) ||
      (rawPayload?.caseId as string) ||
      (session.caseId ? String(session.caseId) : undefined);

    const { createCase, updateDraftCase, resolveCaseActor, findCase } = await import(
      '../cases/cases.service'
    );

    const user = await User.findById(session.userId);
    if (!user) throw new AppError('Session user not found', 404);

    const actor = opts.actor ?? {
      id: String(user._id),
      email: user.email,
      role: user.role,
    };
    const caseActor = await resolveCaseActor(String(user._id));

    let caseDoc: ICase | null = null;
    let caseIdStr: string = '';

    if (draftId) {
      const existingDraft = await findCase(draftId);
      if (existingDraft) {
        if (existingDraft.status === CASE_STATUSES.SAVED_FOR_SUBMISSION) {
          const updated = await updateDraftCase(
            caseActor,
            existingDraft.caseId,
            {
              ...payload,
              asDraft: false,
              paymentSessionId: session.id,
            },
            opts.audit,
          );
          caseIdStr = updated.caseId;
          caseDoc = await Case.findOne({ caseId: caseIdStr });
        } else if (
          existingDraft.status === CASE_STATUSES.NEW_CASE &&
          String(existingDraft.paymentSessionId) === session.id
        ) {
          caseDoc = existingDraft;
          caseIdStr = existingDraft.caseId;
        }
      }
    }

    if (!caseDoc) {
      const created = await createCase(
        caseActor,
        {
          ...payload,
          asDraft: false,
          paymentSessionId: session.id,
        },
        opts.audit,
      );
      caseIdStr = created.caseId;
      caseDoc = await Case.findOne({ caseId: caseIdStr });
    }

    if (!caseDoc) throw new AppError('Case document not found after payment fulfillment', 500);

    const docs = await issueInvoiceAndReceipt({
      caseId: caseDoc.id,
      billedCaseIds: [caseDoc.caseId],
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
      lineDescription: payload.commercial?.treatmentPlanName || `Case ${caseDoc.caseId}`,
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
    session.isFulfilling = false;
    session.fulfillingAt = undefined;
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
      summary: `Payment session ${session.id} paid; case ${caseDoc.caseId} submitted`,
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      targetType: 'payment',
      targetId: session.id,
      metadata: { caseId: caseDoc.caseId, invoiceId: docs.invoice.id },
      ipAddress: opts.audit?.ipAddress,
      userAgent: opts.audit?.userAgent,
    });

    return paymentSessionDto(session);
  } catch (error) {
    await PaymentSession.updateOne(
      { _id: session._id, isFulfilling: true },
      { $set: { isFulfilling: false } },
    ).catch(() => undefined);
    throw error;
  }
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
