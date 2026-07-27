import type {
  ClarificationDto,
  CreateClarificationInput,
  ReplyClarificationInput,
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
