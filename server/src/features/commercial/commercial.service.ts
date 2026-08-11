import {
  AUDIT_ACTIONS,
  ALL_CASE_CATEGORIES,
  isCaseCategory,
  type CaseCategory,
  type DiscountCodeDto,
  type TreatmentPlanDto,
} from '@ayetis/shared';
import { DiscountCode } from '../../models/DiscountCode';
import { TreatmentPlan } from '../../models/TreatmentPlan';
import { User } from '../../models/User';
import { AppError } from '../../utils/AppError';
import {
  recordActivity,
  type RequestAuditContext,
} from '../audit/audit.service';

export function planDto(doc: InstanceType<typeof TreatmentPlan>): TreatmentPlanDto {
  return {
    id: doc.id,
    name: doc.name,
    caseCategory: doc.caseCategory ?? null,
    description: doc.description,
    price: doc.price,
    currency: doc.currency,
    estimatedDeliveryHours: doc.estimatedDeliveryHours ?? null,
    isActive: doc.isActive,
    isDefault: Boolean(doc.isDefault),
    isFreeDemo: Boolean(doc.isFreeDemo),
    archivedAt: doc.archivedAt ? doc.archivedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function discountDto(doc: InstanceType<typeof DiscountCode>): DiscountCodeDto {
  return {
    id: doc.id,
    code: doc.code,
    description: doc.description,
    percentOff: doc.percentOff ?? null,
    amountOff: doc.amountOff ?? null,
    currency: doc.currency,
    customerUserId: doc.customerUserId ? String(doc.customerUserId) : null,
    validFrom: doc.validFrom ? doc.validFrom.toISOString() : null,
    validUntil: doc.validUntil ? doc.validUntil.toISOString() : null,
    isActive: doc.isActive,
    maxUses: doc.maxUses ?? null,
    usageCount: doc.usageCount ?? 0,
    applicableCaseCategories: doc.applicableCaseCategories ?? [],
    applicablePlanIds: (doc.applicablePlanIds ?? []).map(String),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listTreatmentPlans(activeOnly = false) {
  const filter: Record<string, unknown> = activeOnly
    ? {
        isActive: true,
        $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }],
      }
    : {};
  const items = await TreatmentPlan.find(filter).sort({ name: 1 });
  return items.map(planDto);
}

export async function upsertTreatmentPlan(
  input: {
    id?: string;
    name: string;
    caseCategory?: CaseCategory | null;
    description?: string;
    price: number;
    currency?: string;
    estimatedDeliveryHours?: number | null;
    isActive?: boolean;
    isDefault?: boolean;
    isFreeDemo?: boolean;
    archived?: boolean;
  },
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
) {
  if (input.caseCategory && !isCaseCategory(input.caseCategory)) {
    throw new AppError('Invalid case category', 400);
  }

  let doc;
  if (input.id) {
    doc = await TreatmentPlan.findById(input.id);
    if (!doc) throw new AppError('Treatment plan not found', 404);
    doc.name = input.name;
    doc.caseCategory = input.caseCategory ?? undefined;
    doc.description = input.description ?? '';
    doc.price = input.price;
    doc.currency = (input.currency ?? 'USD').toUpperCase();
    doc.estimatedDeliveryHours = input.estimatedDeliveryHours ?? undefined;
    if (input.isActive !== undefined) doc.isActive = input.isActive;
    if (input.isDefault !== undefined) doc.isDefault = input.isDefault;
    if (input.isFreeDemo !== undefined) doc.isFreeDemo = input.isFreeDemo;
    if (input.archived === true) doc.archivedAt = new Date();
    if (input.archived === false) doc.archivedAt = undefined;
    await doc.save();
  } else {
    doc = await TreatmentPlan.create({
      name: input.name,
      caseCategory: input.caseCategory ?? undefined,
      description: input.description ?? '',
      price: input.price,
      currency: (input.currency ?? 'USD').toUpperCase(),
      estimatedDeliveryHours: input.estimatedDeliveryHours ?? undefined,
      isActive: input.isActive ?? true,
      isDefault: input.isDefault ?? false,
      isFreeDemo: input.isFreeDemo ?? false,
    });
  }

  if (doc.isDefault) {
    await TreatmentPlan.updateMany(
      { _id: { $ne: doc._id }, isDefault: true },
      { $set: { isDefault: false } },
    );
  }

  await recordActivity({
    action: AUDIT_ACTIONS.TREATMENT_PLAN_UPSERT,
    summary: `${actor.email} saved treatment plan ${doc.name}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'system',
    targetId: doc.id,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return planDto(doc);
}

export async function listDiscountCodes() {
  const items = await DiscountCode.find().sort({ code: 1 });
  return items.map(discountDto);
}

export async function upsertDiscountCode(
  input: {
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
    applicableCaseCategories?: CaseCategory[];
    applicablePlanIds?: string[];
  },
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
) {
  const code = input.code.trim().toUpperCase();
  let doc;
  if (input.id) {
    doc = await DiscountCode.findById(input.id);
    if (!doc) throw new AppError('Discount code not found', 404);
  } else {
    doc = new DiscountCode({ code });
  }

  doc.code = code;
  doc.description = input.description ?? '';
  doc.percentOff = input.percentOff ?? undefined;
  doc.amountOff = input.amountOff ?? undefined;
  doc.currency = (input.currency ?? 'USD').toUpperCase();
  doc.customerUserId = input.customerUserId ? (input.customerUserId as never) : undefined;
  doc.validFrom = input.validFrom ? new Date(input.validFrom) : undefined;
  doc.validUntil = input.validUntil ? new Date(input.validUntil) : undefined;
  if (input.isActive !== undefined) doc.isActive = input.isActive;
  doc.maxUses = input.maxUses ?? undefined;
  doc.applicableCaseCategories = input.applicableCaseCategories ?? [];
  doc.applicablePlanIds = (input.applicablePlanIds ?? []) as never;
  await doc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.DISCOUNT_CODE_UPSERT,
    summary: `${actor.email} saved discount code ${doc.code}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'system',
    targetId: doc.id,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return discountDto(doc);
}

export async function validateDiscountCode(
  code: string,
  customerUserId?: string,
  opts?: { treatmentPlanId?: string; caseCategory?: string | null },
) {
  const doc = await DiscountCode.findOne({
    code: code.trim().toUpperCase(),
    isActive: true,
  });
  if (!doc) throw new AppError('Invalid discount code', 400);

  const now = new Date();
  if (doc.validFrom && doc.validFrom > now) throw new AppError('Discount code is not yet valid', 400);
  if (doc.validUntil && doc.validUntil < now) throw new AppError('Discount code has expired', 400);
  if (doc.customerUserId && customerUserId && String(doc.customerUserId) !== customerUserId) {
    throw new AppError('Discount code is not assigned to this account', 400);
  }
  if (doc.maxUses != null && doc.usageCount >= doc.maxUses) {
    throw new AppError('Discount code has reached its usage limit', 400);
  }
  if (opts?.caseCategory && doc.applicableCaseCategories?.length) {
    if (!doc.applicableCaseCategories.includes(opts.caseCategory as CaseCategory)) {
      throw new AppError('Discount code is not valid for this case category', 400);
    }
  }
  if (opts?.treatmentPlanId && doc.applicablePlanIds?.length) {
    const allowed = doc.applicablePlanIds.map(String);
    if (!allowed.includes(opts.treatmentPlanId)) {
      throw new AppError('Discount code is not valid for this treatment plan', 400);
    }
  }

  return discountDto(doc);
}

export async function updateDoctorSlaHours(
  userId: string,
  slaBusinessHours: number,
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
) {
  if (!Number.isFinite(slaBusinessHours) || slaBusinessHours < 1) {
    throw new AppError('SLA hours must be at least 1', 400);
  }
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);
  user.slaBusinessHours = slaBusinessHours;
  await user.save();

  await recordActivity({
    action: AUDIT_ACTIONS.SLA_CONFIG_UPDATE,
    summary: `${actor.email} set SLA ${slaBusinessHours}h for ${user.email}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'user',
    targetId: user.id,
    metadata: { slaBusinessHours },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return { id: user.id, slaBusinessHours: user.slaBusinessHours };
}

export { ALL_CASE_CATEGORIES };
