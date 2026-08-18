import { describe, expect, it, vi } from 'vitest';
import { REFUND_STATUSES, ROLES } from '@ayetis/shared';

vi.mock('../../models/CancellationAudit', () => ({ CancellationAudit: { find: vi.fn() } }));
vi.mock('../../models/Case', () => ({ Case: { findById: vi.fn() } }));
vi.mock('../../models/Commercial', () => ({ PaymentSession: { findById: vi.fn() } }));
vi.mock('../commercial/paymentProviders', () => ({ refundStripePayment: vi.fn() }));
vi.mock('../audit/audit.service', () => ({ recordActivity: vi.fn() }));

import { toDto, summarizeDevice } from './cancellations.service';

describe('cancellation audit DTO', () => {
  it('redacts doctor name for non-admin viewers', () => {
    const doc = {
      id: 'c1',
      caseId: 'AYT-1',
      patientName: 'Jane',
      doctorUserId: 'doc-1',
      doctorName: 'Ada',
      doctorDisplayId: 'D-1',
      refundAmount: 50,
      refundStatus: REFUND_STATUSES.PENDING,
      cancellationReason: 'error',
      cancelledAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const coordinator = toDto(doc as never, { id: 'co', role: ROLES.COORDINATOR });
    expect(coordinator.doctorName).toBe('D-1');
    const admin = toDto(doc as never, { id: 'a', role: ROLES.ADMIN });
    expect(admin.doctorName).toBe('Ada');
    expect(coordinator.pendingRefundAmount).toBe(50);
  });

  it('summarizes devices from user agents', () => {
    expect(summarizeDevice(null)).toBeNull();
    expect(summarizeDevice('Mozilla/5.0 Chrome/120 Linux')).toContain('Chrome');
  });
});
