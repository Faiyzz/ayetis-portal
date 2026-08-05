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

function planDto(doc: InstanceType<typeof TreatmentPlan>): TreatmentPlanDto {
  return {
    id: doc.id,
    name: doc.name,
    caseCategory: doc.caseCategory ?? null,
    description: doc.description,
    price: doc.price,
    currency: doc.currency,
    estimatedDeliveryHours: doc.estimatedDeliveryHours ?? null,
    isActive: doc.isActive,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function discountDto(doc: InstanceType<typeof DiscountCode>): DiscountCodeDto {
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
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listTreatmentPlans(activeOnly = false) {
  const filter = activeOnly ? { isActive: true } : {};
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
    });
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

export async function validateDiscountCode(code: string, customerUserId?: string) {
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
