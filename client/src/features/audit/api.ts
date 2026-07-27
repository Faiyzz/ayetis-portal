import {
  ALL_AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
  type ActivityLogDto,
  type ActivityLogListResult,
  type AuditAction,
} from '@ayetis/shared';
import api from '@/lib/api';

export async function fetchActivityLogs(params: {
  page?: number;
  pageSize?: number;
  action?: AuditAction | '';
  actorEmail?: string;
  q?: string;
}): Promise<ActivityLogListResult> {
  const { data } = await api.get('/activity', {
    params: {
      page: params.page,
      pageSize: params.pageSize,
      action: params.action || undefined,
      actorEmail: params.actorEmail || undefined,
      q: params.q || undefined,
    },
  });
  return data.data;
}

export type { ActivityLogDto, AuditAction };

export const AUDIT_ACTION_OPTIONS = ALL_AUDIT_ACTIONS.map((action) => ({
  value: action,
  label: AUDIT_ACTION_LABELS[action],
}));
