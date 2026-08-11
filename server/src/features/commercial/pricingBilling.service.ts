import {
  AUDIT_ACTIONS,
  BILLING_ARRANGEMENTS,
  DEMO_CASE_MESSAGES,
  INVOICE_SCHEDULE_ARRANGEMENTS,
  PREPAID_LEDGER_KINDS,
  PRICE_SUBJECT_TYPES,
  isBillingArrangement,
  type BillingArrangement,
  type BillingProfileDto,
  type CreateCaseEligibility,
  type CustomerPriceOverrideDto,
  type PrepaidLedgerEntryDto,
  type PriceSubjectType,
  type ResolvedCasePricing,
} from '@ayetis/shared';
import { CustomerPriceOverride, PrepaidLedgerEntry } from '../../models/Commercial';
import { DiscountCode } from '../../models/DiscountCode';
import { Organization } from '../../models/Organization';
import { TreatmentPlan } from '../../models/TreatmentPlan';
import { User } from '../../models/User';
import { AppError } from '../../utils/AppError';
import {
  recordActivity,
  type RequestAuditContext,
} from '../audit/audit.service';
import { validateDiscountCode } from './commercial.service';
export async function resolveCasePricing(input: {
  treatmentPlanId: string;
  discountCode?: string | null;
  customerUserId?: string;
  organizationId?: string | null;
  caseCategory?: string | null;
}): Promise<ResolvedCasePricing> {
  const plan = await TreatmentPlan.findById(input.treatmentPlanId);
  if (!plan || !plan.isActive || plan.archivedAt) {
    throw new AppError('Treatment plan not found or inactive', 404);
  }

  let unitPrice = plan.price;
  let customerPrice: number | null = null;
  let priceSource: ResolvedCasePricing['priceSource'] = plan.isFreeDemo
    ? 'free_demo'
    : 'standard';

  const now = new Date();
  const timeOk = {
    $and: [
      {
        $or: [
          { effectiveFrom: { $exists: false } },
          { effectiveFrom: null },
          { effectiveFrom: { $lte: now } },
        ],
      },
      {
        $or: [
          { effectiveUntil: { $exists: false } },
          { effectiveUntil: null },
          { effectiveUntil: { $gte: now } },
        ],
      },
    ],
  };

  if (input.customerUserId) {
    const userOverride = await CustomerPriceOverride.findOne({
      treatmentPlanId: plan._id,
      isActive: true,
      subjectType: PRICE_SUBJECT_TYPES.USER,
      subjectId: input.customerUserId,
      ...timeOk,
    });
    if (userOverride) {
      customerPrice = userOverride.price;
      unitPrice = userOverride.price;
      priceSource = 'customer_override';
    }
  }

  if (customerPrice == null && input.organizationId) {
    const orgOverride = await CustomerPriceOverride.findOne({
      treatmentPlanId: plan._id,
      isActive: true,
      subjectType: PRICE_SUBJECT_TYPES.ORGANIZATION,
      subjectId: input.organizationId,
      ...timeOk,
    });
    if (orgOverride) {
      customerPrice = orgOverride.price;
      unitPrice = orgOverride.price;
      priceSource = 'customer_override';
    }
  }

  if (plan.isFreeDemo) {
    unitPrice = 0;
    priceSource = 'free_demo';
  }

  let discountAmount = 0;
  let discountCode: string | null = null;
  if (input.discountCode?.trim()) {
    const discount = await validateDiscountCode(
      input.discountCode,
      input.customerUserId,
      {
        treatmentPlanId: plan.id,
        caseCategory: input.caseCategory ?? plan.caseCategory,
      },
    );
    discountCode = discount.code;
    if (discount.percentOff != null) {
      discountAmount = (unitPrice * discount.percentOff) / 100;
    } else if (discount.amountOff != null) {
      discountAmount = discount.amountOff;
    }
  }

  return {
    treatmentPlanId: plan.id,
    treatmentPlanName: plan.name,
    standardPrice: plan.price,
    customerPrice,
    unitPrice,
    discountCode,
    discountAmount: Number(discountAmount.toFixed(2)),
    finalPayableAmount: Math.max(0, Number((unitPrice - discountAmount).toFixed(2))),
    currency: plan.currency,
    priceSource,
    isFreeDemoPlan: Boolean(plan.isFreeDemo),
  };
}

export async function loadBillingSubject(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);

  if (user.organizationId) {
    const org = await Organization.findById(user.organizationId);
    if (org) {
      const arr =
        org.billingArrangement && isBillingArrangement(org.billingArrangement)
          ? org.billingArrangement
          : user.billingArrangement && isBillingArrangement(user.billingArrangement)
            ? user.billingArrangement
            : null;
      return {
        subjectType: PRICE_SUBJECT_TYPES.ORGANIZATION as PriceSubjectType,
        subjectId: org.id,
        label: org.companyName,
        billingArrangement: arr as BillingArrangement | null,
        prepaidCaseBalance: org.prepaidCaseBalance ?? 0,
        organizationId: org.id as string | null,
      };
    }
  }

  return {
    subjectType: PRICE_SUBJECT_TYPES.USER as PriceSubjectType,
    subjectId: user.id,
    label: `${user.firstName} ${user.lastName}`.trim() || user.email,
    billingArrangement:
      user.billingArrangement && isBillingArrangement(user.billingArrangement)
        ? user.billingArrangement
        : null,
    prepaidCaseBalance: user.prepaidCaseBalance ?? 0,
    organizationId: null as string | null,
  };
}

export async function evaluateCreateEligibility(input: {
  userId: string;
  treatmentPlanId: string;
  discountCode?: string | null;
  isDemo?: boolean;
  caseCategory?: string | null;
}): Promise<CreateCaseEligibility> {
  const subject = await loadBillingSubject(input.userId);
  const pricing = await resolveCasePricing({
    treatmentPlanId: input.treatmentPlanId,
    discountCode: input.discountCode,
    customerUserId: input.userId,
    organizationId: subject.organizationId,
    caseCategory: input.caseCategory,
  });

  if (input.isDemo || pricing.isFreeDemoPlan) {
    return {
      allowedWithoutPayment: true,
      reason: 'demo',
      pricing: {
        ...pricing,
        finalPayableAmount: 0,
        unitPrice: 0,
        discountAmount: pricing.standardPrice,
      },
      prepaidBalance: subject.prepaidCaseBalance,
      billingArrangement: subject.billingArrangement,
      message: DEMO_CASE_MESSAGES.confirmation,
    };
  }

  if (pricing.finalPayableAmount <= 0) {
    return {
      allowedWithoutPayment: true,
      reason: 'zero_amount',
      pricing,
      prepaidBalance: subject.prepaidCaseBalance,
      billingArrangement: subject.billingArrangement,
      message: 'No payment required for this case.',
    };
  }

  if (
    subject.billingArrangement === BILLING_ARRANGEMENTS.ADVANCE_PAYMENT &&
    subject.prepaidCaseBalance > 0
  ) {
    return {
      allowedWithoutPayment: true,
      reason: 'prepaid',
      pricing,
      prepaidBalance: subject.prepaidCaseBalance,
      billingArrangement: subject.billingArrangement,
      message: 'Case will debit 1 from your prepaid balance.',
    };
  }

  if (
    subject.billingArrangement &&
    (INVOICE_SCHEDULE_ARRANGEMENTS as string[]).includes(subject.billingArrangement)
  ) {
    return {
      allowedWithoutPayment: true,
      reason: 'invoice_schedule',
      pricing,
      prepaidBalance: subject.prepaidCaseBalance,
      billingArrangement: subject.billingArrangement,
      message: `Billed under ${subject.billingArrangement} arrangement.`,
    };
  }

  return {
    allowedWithoutPayment: false,
    reason: 'must_pay',
    pricing,
    prepaidBalance: subject.prepaidCaseBalance,
    billingArrangement: subject.billingArrangement,
    message: 'Payment is required before this case can be created.',
  };
}

export async function creditPrepaid(
  input: {
    subjectType: PriceSubjectType;
    subjectId: string;
    cases: number;
    reason?: string;
  },
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
): Promise<PrepaidLedgerEntryDto> {
  if (!Number.isFinite(input.cases) || input.cases < 1) {
    throw new AppError('Credit at least 1 case', 400);
  }

  let balanceAfter = 0;
  if (input.subjectType === PRICE_SUBJECT_TYPES.ORGANIZATION) {
    const org = await Organization.findById(input.subjectId);
    if (!org) throw new AppError('Organization not found', 404);
    org.prepaidCaseBalance = (org.prepaidCaseBalance ?? 0) + input.cases;
    await org.save();
    balanceAfter = org.prepaidCaseBalance;
  } else {
    const user = await User.findById(input.subjectId);
    if (!user) throw new AppError('User not found', 404);
    user.prepaidCaseBalance = (user.prepaidCaseBalance ?? 0) + input.cases;
    await user.save();
    balanceAfter = user.prepaidCaseBalance;
  }

  const entry = await PrepaidLedgerEntry.create({
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    kind: PREPAID_LEDGER_KINDS.CREDIT,
    deltaCases: input.cases,
    balanceAfter,
    reason: input.reason || 'Admin credit',
    actorId: actor.id,
    actorEmail: actor.email,
  });

  await recordActivity({
    action: AUDIT_ACTIONS.PREPAID_CREDIT,
    summary: `${actor.email} credited ${input.cases} prepaid case(s)`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'system',
    targetId: entry.id,
    metadata: { subjectType: input.subjectType, subjectId: input.subjectId, balanceAfter },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return {
    id: entry.id,
    subjectType: entry.subjectType,
    subjectId: String(entry.subjectId),
    kind: entry.kind,
    deltaCases: entry.deltaCases,
    balanceAfter: entry.balanceAfter,
    caseId: null,
    reason: entry.reason,
    actorEmail: entry.actorEmail ?? null,
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function debitPrepaidForCase(
  userId: string,
  caseMongoId: string,
  actorEmail: string,
): Promise<boolean> {
  const subject = await loadBillingSubject(userId);
  if (
    subject.billingArrangement !== BILLING_ARRANGEMENTS.ADVANCE_PAYMENT ||
    subject.prepaidCaseBalance < 1
  ) {
    return false;
  }

  let balanceAfter = 0;
  if (subject.subjectType === PRICE_SUBJECT_TYPES.ORGANIZATION) {
    const org = await Organization.findOneAndUpdate(
      { _id: subject.subjectId, prepaidCaseBalance: { $gte: 1 } },
      { $inc: { prepaidCaseBalance: -1 } },
      { new: true },
    );
    if (!org) return false;
    balanceAfter = org.prepaidCaseBalance;
  } else {
    const user = await User.findOneAndUpdate(
      { _id: subject.subjectId, prepaidCaseBalance: { $gte: 1 } },
      { $inc: { prepaidCaseBalance: -1 } },
      { new: true },
    );
    if (!user) return false;
    balanceAfter = user.prepaidCaseBalance;
  }

  await PrepaidLedgerEntry.create({
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
    kind: PREPAID_LEDGER_KINDS.DEBIT,
    deltaCases: -1,
    balanceAfter,
    caseId: caseMongoId,
    reason: 'Case submission debit',
    actorEmail,
  });

  await recordActivity({
    action: AUDIT_ACTIONS.PREPAID_DEBIT,
    summary: `Prepaid debit for case ${caseMongoId}`,
    actorEmail,
    targetType: 'case',
    targetId: caseMongoId,
    metadata: { balanceAfter },
  });

  return true;
}

export async function updateBillingArrangement(
  input: {
    subjectType: PriceSubjectType;
    subjectId: string;
    billingArrangement: BillingArrangement | null;
  },
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
): Promise<BillingProfileDto> {
  if (input.billingArrangement && !isBillingArrangement(input.billingArrangement)) {
    throw new AppError('Invalid billing arrangement', 400);
  }

  let label = '';
  if (input.subjectType === PRICE_SUBJECT_TYPES.ORGANIZATION) {
    const org = await Organization.findById(input.subjectId);
    if (!org) throw new AppError('Organization not found', 404);
    org.billingArrangement = input.billingArrangement || undefined;
    await org.save();
    label = org.companyName;
    await recordActivity({
      action: AUDIT_ACTIONS.BILLING_ARRANGE_UPDATE,
      summary: `${actor.email} set billing for ${label} to ${input.billingArrangement ?? 'none'}`,
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      targetType: 'system',
      targetId: input.subjectId,
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });
    return {
      subjectType: PRICE_SUBJECT_TYPES.ORGANIZATION,
      subjectId: input.subjectId,
      subjectLabel: label,
      billingArrangement: input.billingArrangement,
      prepaidCaseBalance: org.prepaidCaseBalance ?? 0,
    };
  }

  const user = await User.findById(input.subjectId);
  if (!user) throw new AppError('User not found', 404);
  user.billingArrangement = input.billingArrangement || undefined;
  await user.save();
  label = `${user.firstName} ${user.lastName}`.trim();
  await recordActivity({
    action: AUDIT_ACTIONS.BILLING_ARRANGE_UPDATE,
    summary: `${actor.email} set billing for ${label} to ${input.billingArrangement ?? 'none'}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'user',
    targetId: input.subjectId,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });
  return {
    subjectType: PRICE_SUBJECT_TYPES.USER,
    subjectId: input.subjectId,
    subjectLabel: label,
    billingArrangement: input.billingArrangement,
    prepaidCaseBalance: user.prepaidCaseBalance ?? 0,
  };
}

export async function getBillingProfile(
  subjectType: PriceSubjectType,
  subjectId: string,
): Promise<BillingProfileDto> {
  if (subjectType === PRICE_SUBJECT_TYPES.ORGANIZATION) {
    const org = await Organization.findById(subjectId);
    if (!org) throw new AppError('Organization not found', 404);
    return {
      subjectType,
      subjectId,
      subjectLabel: org.companyName,
      billingArrangement:
        org.billingArrangement && isBillingArrangement(org.billingArrangement)
          ? org.billingArrangement
          : null,
      prepaidCaseBalance: org.prepaidCaseBalance ?? 0,
    };
  }
  const user = await User.findById(subjectId);
  if (!user) throw new AppError('User not found', 404);
  return {
    subjectType,
    subjectId,
    subjectLabel: `${user.firstName} ${user.lastName}`.trim(),
    billingArrangement:
      user.billingArrangement && isBillingArrangement(user.billingArrangement)
        ? user.billingArrangement
        : null,
    prepaidCaseBalance: user.prepaidCaseBalance ?? 0,
  };
}

export async function listPrepaidLedger(
  subjectType: PriceSubjectType,
  subjectId: string,
): Promise<PrepaidLedgerEntryDto[]> {
  const items = await PrepaidLedgerEntry.find({ subjectType, subjectId }).sort({
    createdAt: -1,
  });
  return items.map((entry) => ({
    id: entry.id,
    subjectType: entry.subjectType,
    subjectId: String(entry.subjectId),
    kind: entry.kind,
    deltaCases: entry.deltaCases,
    balanceAfter: entry.balanceAfter,
    caseId: entry.caseId ? String(entry.caseId) : null,
    reason: entry.reason,
    actorEmail: entry.actorEmail ?? null,
    createdAt: entry.createdAt.toISOString(),
  }));
}

export async function upsertCustomerPrice(
  input: {
    id?: string;
    subjectType: PriceSubjectType;
    subjectId: string;
    treatmentPlanId: string;
    price: number;
    currency?: string;
    effectiveFrom?: string | null;
    effectiveUntil?: string | null;
    isActive?: boolean;
  },
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
): Promise<CustomerPriceOverrideDto> {
  let doc = input.id
    ? await CustomerPriceOverride.findById(input.id)
    : await CustomerPriceOverride.findOne({
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        treatmentPlanId: input.treatmentPlanId,
      });

  if (input.id && !doc) throw new AppError('Price override not found', 404);
  if (!doc) {
    doc = new CustomerPriceOverride({
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      treatmentPlanId: input.treatmentPlanId,
    });
  }

  doc.price = input.price;
  doc.currency = (input.currency ?? 'USD').toUpperCase();
  doc.effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : undefined;
  doc.effectiveUntil = input.effectiveUntil ? new Date(input.effectiveUntil) : undefined;
  if (input.isActive !== undefined) doc.isActive = input.isActive;
  await doc.save();

  const plan = await TreatmentPlan.findById(doc.treatmentPlanId);
  let subjectLabel = String(doc.subjectId);
  if (doc.subjectType === PRICE_SUBJECT_TYPES.USER) {
    const user = await User.findById(doc.subjectId);
    subjectLabel = user ? `${user.firstName} ${user.lastName}`.trim() : subjectLabel;
  } else {
    const org = await Organization.findById(doc.subjectId);
    subjectLabel = org?.companyName ?? subjectLabel;
  }

  await recordActivity({
    action: AUDIT_ACTIONS.CUSTOMER_PRICE_UPSERT,
    summary: `${actor.email} set custom price for ${subjectLabel}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'system',
    targetId: doc.id,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return {
    id: doc.id,
    subjectType: doc.subjectType,
    subjectId: String(doc.subjectId),
    subjectLabel,
    treatmentPlanId: String(doc.treatmentPlanId),
    treatmentPlanName: plan?.name ?? '',
    price: doc.price,
    currency: doc.currency,
    effectiveFrom: doc.effectiveFrom ? doc.effectiveFrom.toISOString() : null,
    effectiveUntil: doc.effectiveUntil ? doc.effectiveUntil.toISOString() : null,
    isActive: doc.isActive,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listCustomerPrices(): Promise<CustomerPriceOverrideDto[]> {
  const items = await CustomerPriceOverride.find().sort({ updatedAt: -1 });
  const result: CustomerPriceOverrideDto[] = [];
  for (const doc of items) {
    const plan = await TreatmentPlan.findById(doc.treatmentPlanId);
    let subjectLabel = String(doc.subjectId);
    if (doc.subjectType === PRICE_SUBJECT_TYPES.USER) {
      const user = await User.findById(doc.subjectId);
      subjectLabel = user ? `${user.firstName} ${user.lastName}`.trim() : subjectLabel;
    } else {
      const org = await Organization.findById(doc.subjectId);
      subjectLabel = org?.companyName ?? subjectLabel;
    }
    result.push({
      id: doc.id,
      subjectType: doc.subjectType,
      subjectId: String(doc.subjectId),
      subjectLabel,
      treatmentPlanId: String(doc.treatmentPlanId),
      treatmentPlanName: plan?.name ?? '',
      price: doc.price,
      currency: doc.currency,
      effectiveFrom: doc.effectiveFrom ? doc.effectiveFrom.toISOString() : null,
      effectiveUntil: doc.effectiveUntil ? doc.effectiveUntil.toISOString() : null,
      isActive: doc.isActive,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    });
  }
  return result;
}

export async function redeemDiscountCode(code: string) {
  await DiscountCode.updateOne(
    { code: code.trim().toUpperCase() },
    { $inc: { usageCount: 1 } },
  );
}

