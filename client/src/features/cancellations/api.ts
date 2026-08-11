import type {
  CancellationAuditDto,
  CancellationReportResult,
  CancellationTrendGranularity,
  RefundStatus,
} from '@ayetis/shared';
import api from '@/lib/api';

export type { CancellationAuditDto, CancellationReportResult };

export interface CancellationReportFilters {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  caseId?: string;
  doctorId?: string;
  coordinatorId?: string;
  companyName?: string;
  treatmentPlanName?: string;
  cancellationReason?: string;
  caseCategory?: string;
  refundStatus?: string;
  paymentStatus?: string;
  trend?: CancellationTrendGranularity | string;
  q?: string;
}

function toParams(params: CancellationReportFilters) {
  return {
    page: params.page,
    pageSize: params.pageSize,
    from: params.from || undefined,
    to: params.to || undefined,
    caseId: params.caseId || undefined,
    doctorId: params.doctorId || undefined,
    coordinatorId: params.coordinatorId || undefined,
    companyName: params.companyName || undefined,
    treatmentPlanName: params.treatmentPlanName || undefined,
    cancellationReason: params.cancellationReason || undefined,
    caseCategory: params.caseCategory || undefined,
    refundStatus: params.refundStatus || undefined,
    paymentStatus: params.paymentStatus || undefined,
    trend: params.trend || undefined,
    q: params.q || undefined,
  };
}

export async function fetchCancellationAudits(
  params: CancellationReportFilters,
): Promise<CancellationReportResult> {
  const { data } = await api.get('/cancellations', { params: toParams(params) });
  return data.data;
}

async function downloadExport(path: string, params: CancellationReportFilters, filename: string) {
  const { data } = await api.get(path, {
    params: toParams(params),
    responseType: 'blob',
  });
  const blob = data as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportCancellationCsv(params: CancellationReportFilters) {
  await downloadExport('/cancellations/export.csv', params, 'cancellation-audit.csv');
}

export async function exportCancellationExcel(params: CancellationReportFilters) {
  await downloadExport('/cancellations/export.xls', params, 'cancellation-audit.xls');
}

export async function openCancellationPrintHtml(params: CancellationReportFilters) {
  const { data } = await api.get('/cancellations/export.html', {
    params: toParams(params),
    responseType: 'text',
  });
  const blob = new Blob([data as string], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function updateCancellationRefund(
  id: string,
  payload: { refundStatus: RefundStatus; refundTransactionReference?: string },
): Promise<CancellationAuditDto> {
  const { data } = await api.patch(`/cancellations/${id}/refund`, payload);
  return data.data;
}
