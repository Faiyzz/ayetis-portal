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
}) {
  const { data } = await api.get('/cases', {
    params: {
      page: params.page,
      pageSize: params.pageSize,
      status: params.status || undefined,
      priority: params.priority || undefined,
      q: params.q || undefined,
      includeDeleted: params.includeDeleted || undefined,
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
): Promise<CaseDetailDto> {
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

export function caseFileDownloadUrl(caseId: string, fileId: string): string {
  return `/api/cases/${caseId}/files/${fileId}`;
}

export async function downloadCaseFile(caseId: string, fileId: string, filename: string) {
  const token = localStorage.getItem('ayetis_token');
  const response = await fetch(caseFileDownloadUrl(caseId, fileId), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    throw new Error('Unable to download file');
  }

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

export { CASE_PRIORITY_LABELS, formatHistoryValue };
export type { CasePriority };
