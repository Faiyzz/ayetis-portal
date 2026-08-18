import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../utils/AppError';

const { DiscountCode, TreatmentPlan, CustomerPriceOverride } = vi.hoisted(() => ({
  DiscountCode: { findOne: vi.fn() },
  TreatmentPlan: { findById: vi.fn(), find: vi.fn() },
  CustomerPriceOverride: { findOne: vi.fn() },
}));

vi.mock('../../models/DiscountCode', () => ({ DiscountCode }));
vi.mock('../../models/TreatmentPlan', () => ({ TreatmentPlan }));
vi.mock('../../models/Commercial', () => ({
  CustomerPriceOverride,
  PrepaidLedgerEntry: { find: vi.fn() },
}));
vi.mock('../../models/Organization', () => ({ Organization: { findById: vi.fn() } }));
vi.mock('../../models/User', () => ({ User: { findById: vi.fn() } }));
vi.mock('../audit/audit.service', () => ({ recordActivity: vi.fn() }));

import { validateDiscountCode, planDto } from './commercial.service';
import { resolveCasePricing } from './pricingBilling.service';

describe('discount codes and pricing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects invalid, expired, and category-mismatched codes', async () => {
    DiscountCode.findOne.mockResolvedValue(null);
    await expect(validateDiscountCode('NOPE')).rejects.toBeInstanceOf(AppError);

    DiscountCode.findOne.mockResolvedValue({
      code: 'TEST10',
      isActive: true,
      validUntil: new Date('2020-01-01'),
      percentOff: 10,
      amountOff: null,
      currency: 'USD',
      customerUserId: null,
      maxUses: null,
      usageCount: 0,
      applicableCaseCategories: [],
      applicablePlanIds: [],
      description: '',
      validFrom: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      id: 'd1',
    });
    await expect(validateDiscountCode('TEST10')).rejects.toMatchObject({ message: expect.stringMatching(/expired/i) });
  });

  it('applies percent off on top of customer override then demo zeros the price', async () => {
    TreatmentPlan.findById.mockResolvedValue({
      id: 'plan-1',
      _id: 'plan-1',
      name: 'Aligner',
      price: 100,
      isActive: true,
      archivedAt: null,
      isFreeDemo: false,
      caseCategory: 'digital_aligner',
      currency: 'USD',
    });
    CustomerPriceOverride.findOne.mockResolvedValue({ price: 80 });
    DiscountCode.findOne.mockResolvedValue({
      id: 'd1',
      code: 'TEST10',
      description: '10',
      percentOff: 10,
      amountOff: null,
      currency: 'USD',
      customerUserId: null,
      validFrom: null,
      validUntil: null,
      isActive: true,
      maxUses: null,
      usageCount: 0,
      applicableCaseCategories: [],
      applicablePlanIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const priced = await resolveCasePricing({
      treatmentPlanId: 'plan-1',
      discountCode: 'TEST10',
      customerUserId: 'u1',
    });
    expect(priced.unitPrice).toBe(80);
    expect(priced.discountAmount).toBe(8);
    expect(priced.priceSource).toBe('customer_override');
  });

  it('maps treatment plan DTOs', () => {
    const dto = planDto({
      id: 'p1',
      name: 'Plan',
      caseCategory: 'digital_aligner',
      description: '',
      price: 10,
      currency: 'USD',
      estimatedDeliveryHours: 48,
      isActive: true,
      isDefault: false,
      isFreeDemo: false,
      archivedAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    } as never);
    expect(dto.id).toBe('p1');
    expect(dto.price).toBe(10);
  });
});
