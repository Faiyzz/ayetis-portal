import type { DiscountCodeDto, TreatmentPlanDto } from '@ayetis/shared';
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
}): Promise<DiscountCodeDto> {
  const { data } = await api.post('/commercial/discount-codes', payload);
  return data.data;
}

export async function validateDiscountCode(code: string): Promise<DiscountCodeDto> {
  const { data } = await api.post('/commercial/discount-codes/validate', { code });
  return data.data;
}

export async function updateDoctorSlaHours(
  userId: string,
  slaBusinessHours: number,
): Promise<{ id: string; slaBusinessHours: number }> {
  const { data } = await api.patch(`/commercial/users/${userId}/sla`, { slaBusinessHours });
  return data.data;
}
