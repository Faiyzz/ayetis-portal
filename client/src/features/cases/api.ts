import type {
  AddCaseNoteInput,
  CancelCaseInput,
  CaseDetailDto,
  CaseListResult,
  CasePriority,
  CaseStatus,
  CreateCaseInput,
  SoftDeleteCaseInput,
  UpdateCaseInput,
} from '@ayetis/shared';
import api from '@/lib/api';

export async function fetchCases(params: {
  page?: number;
  pageSize?: number;
  status?: CaseStatus | '';
  priority?: CasePriority | '';
  q?: string;
  includeDeleted?: boolean;
}): Promise<CaseListResult> {
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

export async function cancelCase(
  caseId: string,
  payload: CancelCaseInput,
): Promise<CaseDetailDto> {
  const { data } = await api.post(`/cases/${caseId}/cancel`, payload);
  return data.data;
}

export async function softDeleteCase(
  caseId: string,
  payload: SoftDeleteCaseInput,
): Promise<CaseDetailDto> {
  const { data } = await api.post(`/cases/${caseId}/delete`, payload);
  return data.data;
}

export async function addCaseNote(
  caseId: string,
  payload: AddCaseNoteInput,
): Promise<CaseDetailDto> {
  const { data } = await api.post(`/cases/${caseId}/notes`, payload);
  return data.data;
}
