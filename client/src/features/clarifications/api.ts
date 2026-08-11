import type {
  ClarificationDto,
  CreateClarificationInput,
  EscalateClarificationInput,
  ReplyClarificationInput,
  UpdateClarificationDraftInput,
} from '@ayetis/shared';
import api from '@/lib/api';

export async function fetchCaseClarifications(caseId: string): Promise<ClarificationDto[]> {
  const { data } = await api.get(`/cases/${caseId}/clarifications`);
  return data.data;
}

export async function createClarification(
  caseId: string,
  payload: CreateClarificationInput,
): Promise<ClarificationDto> {
  const { data } = await api.post(`/cases/${caseId}/clarifications`, payload);
  return data.data;
}

export async function updateClarificationDraft(
  clarificationId: string,
  payload: UpdateClarificationDraftInput,
): Promise<ClarificationDto> {
  const { data } = await api.patch(`/clarifications/${clarificationId}/draft`, payload);
  return data.data;
}

export async function publishClarificationDraft(
  clarificationId: string,
): Promise<ClarificationDto> {
  const { data } = await api.post(`/clarifications/${clarificationId}/publish`);
  return data.data;
}

export async function replyToClarification(
  clarificationId: string,
  payload: ReplyClarificationInput,
): Promise<ClarificationDto> {
  const { data } = await api.post(`/clarifications/${clarificationId}/replies`, payload);
  return data.data;
}

export async function resolveClarification(clarificationId: string): Promise<ClarificationDto> {
  const { data } = await api.post(`/clarifications/${clarificationId}/resolve`);
  return data.data;
}

export async function markClarificationRead(clarificationId: string): Promise<ClarificationDto> {
  const { data } = await api.post(`/clarifications/${clarificationId}/read`);
  return data.data;
}

export async function escalateClarification(
  clarificationId: string,
  payload: EscalateClarificationInput = {},
): Promise<ClarificationDto> {
  const { data } = await api.post(`/clarifications/${clarificationId}/escalate`, payload);
  return data.data;
}

export async function uploadClarificationAttachment(
  clarificationId: string,
  file: File,
): Promise<ClarificationDto> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post(`/clarifications/${clarificationId}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: [
      (body: unknown, headers: Record<string, string>) => {
        if (body instanceof FormData) delete headers['Content-Type'];
        return body;
      },
    ],
  });
  return data.data;
}
