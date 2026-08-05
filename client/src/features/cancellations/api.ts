import type { RefundStatus } from '@ayetis/shared';
import api from '@/lib/api';

export interface CancellationAuditDto {
  id: string;
  caseId: string;
  patientName: string;
  doctorName: string;
  doctorDisplayId: string | null;
  companyName: string | null;
  accountType: string | null;
  caseCategory: string | null;
  caseType: string | null;
  treatmentPlanName: string | null;
  caseValue: number | null;
  invoiceNumber: string | null;
  paymentStatus: string | null;
  refundAmount: number;
  refundStatus: RefundStatus;
  cancellationReason: string;
  cancellationRemarks: string | null;
  statusAtCancellation: string;
  submittedAt: string | null;
  cancelledAt: string;
  remainingWindowSeconds: number;
  cancelledByName: string;
  cancelledByEmail: string | null;
  paymentTransactionReference: string | null;
  refundTransactionReference: string | null;
  createdAt: string;
}

export interface CancellationReportResult {
  items: CancellationAuditDto[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    totalCancelled: number;
    totalRefundAmount: number;
    refundsPending: number;
    refundsProcessed: number;
    refundStatuses: RefundStatus[];
  };
}

export async function fetchCancellationAudits(params: {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  caseId?: string;
  doctorId?: string;
  caseCategory?: string;
  refundStatus?: string;
  q?: string;
}): Promise<CancellationReportResult> {
  const { data } = await api.get('/cancellations', {
    params: {
      page: params.page,
      pageSize: params.pageSize,
      from: params.from || undefined,
      to: params.to || undefined,
      caseId: params.caseId || undefined,
      doctorId: params.doctorId || undefined,
      caseCategory: params.caseCategory || undefined,
      refundStatus: params.refundStatus || undefined,
      q: params.q || undefined,
    },
  });
  return data.data;
}

export async function exportCancellationCsv(params: {
  from?: string;
  to?: string;
  caseCategory?: string;
  refundStatus?: string;
  q?: string;
}): Promise<Blob> {
  const { data } = await api.get('/cancellations/export.csv', {
    params: {
      from: params.from || undefined,
      to: params.to || undefined,
      caseCategory: params.caseCategory || undefined,
      refundStatus: params.refundStatus || undefined,
      q: params.q || undefined,
    },
    responseType: 'blob',
  });
  return data as Blob;
}

export async function updateCancellationRefund(
  id: string,
  payload: { refundStatus: RefundStatus; refundTransactionReference?: string },
): Promise<CancellationAuditDto> {
  const { data } = await api.patch(`/cancellations/${id}/refund`, payload);
  return data.data;
}
