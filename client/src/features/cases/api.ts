import {
  CASE_PRIORITIES,
  CASE_PRIORITY_LABELS,
  formatHistoryValue,
  type CaseDetailDto,
  type CasePriority,
  type CreateCaseInput,
  type FileCategory,
  type SetCasePriorityInput,
  type UpdateCaseInput,
} from '@ayetis/shared';
import api from '@/lib/api';

export async function fetchCases(params: {
  page?: number;
  pageSize?: number;
  status?: string;
  priority?: string;
  q?: string;
  includeDeleted?: boolean;
  isDemo?: boolean;
}) {
  const { data } = await api.get('/cases', {
    params: {
      page: params.page,
      pageSize: params.pageSize,
      status: params.status || undefined,
      priority: params.priority || undefined,
      q: params.q || undefined,
      includeDeleted: params.includeDeleted || undefined,
      isDemo: params.isDemo === undefined ? undefined : params.isDemo ? 'true' : 'false',
    },
  });
  return data.data;
}

export async function fetchCase(caseId: string): Promise<CaseDetailDto> {
  const { data } = await api.get(`/cases/${caseId}`);
  return data.data;
}

export async function createCase(payload: CreateCaseInput): Promise<CaseDetailDto> {
  const { data } = await api.post('/cases', payload);
  return data.data;
}

export async function updateCase(
  caseId: string,
  payload: UpdateCaseInput,
): Promise<CaseDetailDto> {
  const { data } = await api.patch(`/cases/${caseId}`, payload);
  return data.data;
}

export async function setCasePriority(
  caseId: string,
  payload: SetCasePriorityInput,
): Promise<CaseDetailDto> {
  const { data } = await api.post(`/cases/${caseId}/priority`, payload);
  return data.data;
}

export async function markCaseUrgent(caseId: string): Promise<CaseDetailDto> {
  return setCasePriority(caseId, { priority: CASE_PRIORITIES.URGENT });
}

export async function clearCaseUrgent(caseId: string): Promise<CaseDetailDto> {
  return setCasePriority(caseId, { priority: CASE_PRIORITIES.NORMAL });
}

export async function cancelCase(
  caseId: string,
  payload: { reason: string },
): Promise<CaseDetailDto> {
  const { data } = await api.post(`/cases/${caseId}/cancel`, payload);
  return data.data;
}

export async function softDeleteCase(
  caseId: string,
  payload: { reason: string },
): Promise<{ pendingApproval: boolean; message?: string }> {
  const { data } = await api.post(`/cases/${caseId}/delete`, payload);
  return data.data;
}

export async function addCaseNote(
  caseId: string,
  payload: { body: string },
): Promise<CaseDetailDto> {
  const { data } = await api.post(`/cases/${caseId}/notes`, payload);
  return data.data;
}

export async function uploadCaseFiles(
  caseId: string,
  files: File[],
  options: { category?: FileCategory; note?: string } = {},
): Promise<CaseDetailDto> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  if (options.category) formData.append('category', options.category);
  if (options.note) formData.append('note', options.note);

  const { data } = await api.post(`/cases/${caseId}/files`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: [
      (body, headers) => {
        if (body instanceof FormData) {
          delete headers['Content-Type'];
        }
        return body;
      },
    ],
  });
  return data.data;
}

export async function attachCaseViewerLink(
  caseId: string,
  payload: { url: string; label?: string; note?: string },
): Promise<CaseDetailDto> {
  const { data } = await api.post(`/cases/${caseId}/files/link`, payload);
  return data.data;
}

export function caseFileDownloadUrl(caseId: string, fileId: string): string {
  return `/api/cases/${caseId}/files/${fileId}`;
}

export async function downloadCaseFile(caseId: string, fileId: string, filename: string) {
  const { data } = await api.get(`/cases/${caseId}/files/${fileId}/signed-url`);
  const signed = data.data as { url: string };
  const resolved = signed.url.startsWith('http')
    ? signed.url
    : signed.url.startsWith('/api')
      ? signed.url
      : `/api${signed.url.startsWith('/') ? '' : '/'}${signed.url}`;

  const response = await fetch(resolved);
  if (!response.ok) {
    throw new Error('Unable to download file');
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function restoreCaseFile(caseId: string, fileId: string) {
  const { data } = await api.post(`/cases/${caseId}/files/${fileId}/restore`);
  return data.data as import('@ayetis/shared').CaseDetailDto;
}

export async function getCaseFileRestoreStatus(caseId: string, fileId: string) {
  const { data } = await api.get(`/cases/${caseId}/files/${fileId}/restore-status`);
  return data.data as import('@ayetis/shared').FileStorageStateDto & { fileId: string };
}

export async function restoreDeliveryVideo(caseId: string) {
  const { data } = await api.post(`/cases/${caseId}/delivery/video/restore`);
  return data.data as import('@ayetis/shared').CaseDetailDto;
}

export async function getDeliveryVideoRestoreStatus(caseId: string) {
  const { data } = await api.get(`/cases/${caseId}/delivery/video/restore-status`);
  return data.data as import('@ayetis/shared').FileStorageStateDto;
}

export async function downloadAllCaseFiles(caseId: string) {
  const token = localStorage.getItem('ayetis_token');
  const response = await fetch(`/api/cases/${caseId}/files/download-all`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    let message = 'Unable to download case files';
    let code: string | undefined;
    try {
      const body = (await response.json()) as { message?: string; code?: string };
      if (body.message) message = body.message;
      code = body.code;
    } catch {
      // ignore
    }
    const err = new Error(message) as Error & { code?: string };
    err.code = code;
    throw err;
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const filename = match?.[1] || `${caseId}-files.zip`;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function startProduction(
  caseId: string,
  payload: { notes?: string } = {},
): Promise<CaseDetailDto> {
  const { data } = await api.post(`/cases/${caseId}/production/start`, payload);
  return data.data;
}

export async function updateProductionNotes(
  caseId: string,
  payload: { notes?: string },
): Promise<CaseDetailDto> {
  const { data } = await api.post(`/cases/${caseId}/production/notes`, payload);
  return data.data;
}

export async function submitCaseToQc(
  caseId: string,
  payload: { notes?: string } = {},
): Promise<CaseDetailDto> {
  const { data } = await api.post(`/cases/${caseId}/production/submit-qc`, payload);
  return data.data;
}

export async function updateCasePayment(
  caseId: string,
  payload: import('@ayetis/shared').UpdateCasePaymentInput,
): Promise<CaseDetailDto> {
  const { data } = await api.patch(`/cases/${caseId}/payment`, payload);
  return data.data;
}

export async function updateTreatmentInstructions(
  caseId: string,
  payload: Partial<import('@ayetis/shared').TreatmentInstructions>,
): Promise<CaseDetailDto> {
  const { data } = await api.patch(`/cases/${caseId}/treatment-instructions`, payload);
  return data.data;
}

export async function fetchCoordinatorDashboard() {
  const { data } = await api.get('/cases/dashboard/coordinator');
  return data.data as import('@ayetis/shared').CoordinatorDashboardDto;
}

export async function fetchQcDashboard() {
  const { data } = await api.get('/cases/dashboard/qc');
  return data.data as import('@ayetis/shared').QcDashboardDto;
}

export async function fetchEscalatedQueue() {
  const { data } = await api.get('/cases/dashboard/escalated');
  return data.data as import('@ayetis/shared').QcQueueCaseDto[];
}

export async function addQcComment(
  caseId: string,
  payload: { comments: string },
): Promise<CaseDetailDto> {
  const { data } = await api.post(`/cases/${caseId}/qc/comments`, payload);
  return data.data;
}

export async function approveQcCase(
  caseId: string,
  payload: { comments?: string; deliveryViewLink?: string; video?: File | null },
): Promise<CaseDetailDto> {
  const form = new FormData();
  if (payload.comments?.trim()) form.append('comments', payload.comments.trim());
  if (payload.deliveryViewLink?.trim()) {
    form.append('deliveryViewLink', payload.deliveryViewLink.trim());
  }
  if (payload.video) form.append('video', payload.video);

  const { data } = await api.post(`/cases/${caseId}/qc/approve`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: [
      (body, headers) => {
        if (body instanceof FormData) {
          delete headers['Content-Type'];
        }
        return body;
      },
    ],
  });
  return data.data;
}

export async function rejectQcCase(
  caseId: string,
  payload: import('@ayetis/shared').RejectQcInput,
): Promise<CaseDetailDto> {
  const { data } = await api.post(`/cases/${caseId}/qc/reject`, payload);
  return data.data;
}

export async function fetchDesignerPerformance(month?: string) {
  const { data } = await api.get('/cases/reports/designer/me', {
    params: month ? { month } : undefined,
  });
  return data.data as import('@ayetis/shared').DesignerPerformanceDto;
}

export async function fetchQcPerformance(params?: {
  month?: string;
  view?: 'month' | 'quarter';
}) {
  const { data } = await api.get('/cases/reports/qc/me', { params });
  return data.data as import('@ayetis/shared').QcPerformanceDto;
}

export async function fetchConsultantDashboard() {
  const { data } = await api.get('/cases/dashboard/consultant');
  return data.data as import('@ayetis/shared').ConsultantDashboardDto;
}

export async function fetchConsultantPerformance(params?: {
  month?: string;
  view?: 'month' | 'quarter';
}) {
  const { data } = await api.get('/cases/reports/consultant/me', { params });
  return data.data as import('@ayetis/shared').ConsultantPerformanceDto;
}

export async function addClinicalRemark(
  caseId: string,
  payload: import('@ayetis/shared').AddClinicalRemarkInput,
): Promise<CaseDetailDto> {
  const { data } = await api.post(`/cases/${caseId}/clinical-remarks`, payload);
  return data.data;
}

export async function fetchDoctorDeliveries() {
  const { data } = await api.get('/cases/dashboard/doctor-deliveries');
  return data.data as import('@ayetis/shared').DoctorDeliveryQueueItemDto[];
}

export async function recordDoctorCaseView(caseId: string): Promise<CaseDetailDto> {
  const { data } = await api.post(`/cases/${caseId}/doctor/view`);
  return data.data;
}

export async function submitDoctorDecision(
  caseId: string,
  payload: import('@ayetis/shared').DoctorDecisionInput,
): Promise<CaseDetailDto> {
  const { data } = await api.post(`/cases/${caseId}/doctor/decision`, payload);
  return data.data;
}

export async function downloadDeliveryVideo(caseId: string) {
  const { data } = await api.get(`/cases/${caseId}/delivery/video/signed-url`);
  const signed = data.data as { url: string };
  const resolved = signed.url.startsWith('http')
    ? signed.url
    : signed.url.startsWith('/api')
      ? signed.url
      : `/api${signed.url.startsWith('/') ? '' : '/'}${signed.url}`;

  const response = await fetch(resolved);
  if (!response.ok) throw new Error('Unable to download delivery video');

  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const filename = match?.[1] || `${caseId}-delivery-video`;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function fetchDesignerAssignees() {
  const { data } = await api.get('/cases/assignees/designers');
  return data.data as import('@ayetis/shared').DesignerAssigneeDto[];
}

export async function fetchDoctorAssignees() {
  const { data } = await api.get('/cases/assignees/doctors');
  return data.data as import('@ayetis/shared').DoctorAssigneeDto[];
}

export async function startCaseValidation(caseId: string): Promise<CaseDetailDto> {
  const { data } = await api.post(`/cases/${caseId}/validation/start`);
  return data.data;
}

export async function markCaseValidated(
  caseId: string,
  payload: import('@ayetis/shared').ValidateCaseInput = {},
): Promise<CaseDetailDto> {
  const { data } = await api.post(`/cases/${caseId}/validate`, payload);
  return data.data;
}

export async function assignCase(
  caseId: string,
  payload: import('@ayetis/shared').AssignCaseInput,
): Promise<CaseDetailDto> {
  const { data } = await api.post(`/cases/${caseId}/assign`, payload);
  return data.data;
}

export { CASE_PRIORITY_LABELS, formatHistoryValue };
export type { CasePriority };
