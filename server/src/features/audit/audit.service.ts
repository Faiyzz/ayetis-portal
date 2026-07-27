import {
  AUDIT_ACTION_LABELS,
  type ActivityLogDto,
  type ActivityLogListResult,
  type AuditAction,
  type AuditTargetType,
} from '@ayetis/shared';
import type { Request } from 'express';
import { ActivityLog, type IActivityLog } from '../../models/ActivityLog';

export interface RequestAuditContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface RecordActivityInput {
  action: AuditAction;
  summary: string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  targetType: AuditTargetType;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export function getRequestAuditContext(req: Request): RequestAuditContext {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(',')[0]?.trim();

  return {
    ipAddress: forwardedIp || req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent') ?? undefined,
  };
}

function toDto(entry: IActivityLog): ActivityLogDto {
  return {
    id: entry.id,
    action: entry.action,
    actionLabel: AUDIT_ACTION_LABELS[entry.action] ?? entry.action,
    actorId: entry.actorId ? String(entry.actorId) : null,
    actorEmail: entry.actorEmail ?? null,
    actorName: entry.actorName ?? null,
    actorRole: entry.actorRole ?? null,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    summary: entry.summary,
    metadata: (entry.metadata ?? {}) as Record<string, unknown>,
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
    createdAt: entry.createdAt.toISOString(),
  };
}

/**
 * Best-effort audit write — never blocks the primary business action.
 */
export async function recordActivity(input: RecordActivityInput): Promise<void> {
  try {
    await ActivityLog.create({
      action: input.action,
      actorId: input.actorId ?? undefined,
      actorEmail: input.actorEmail?.toLowerCase() ?? undefined,
      actorName: input.actorName ?? undefined,
      actorRole: input.actorRole ?? undefined,
      targetType: input.targetType,
      targetId: input.targetId ?? undefined,
      summary: input.summary,
      metadata: input.metadata ?? {},
      ipAddress: input.ipAddress ?? undefined,
      userAgent: input.userAgent ?? undefined,
    });
  } catch (error) {
    console.error('[audit] failed to record activity', error);
  }
}

export async function listActivityLogs(query: {
  page?: number;
  pageSize?: number;
  action?: AuditAction;
  actorEmail?: string;
  q?: string;
  from?: string;
  to?: string;
}): Promise<ActivityLogListResult> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  const filter: Record<string, unknown> = {};

  if (query.action) {
    filter.action = query.action;
  }

  if (query.actorEmail) {
    filter.actorEmail = query.actorEmail.toLowerCase().trim();
  }

  if (query.q?.trim()) {
    const term = query.q.trim();
    filter.$or = [
      { summary: { $regex: term, $options: 'i' } },
      { actorEmail: { $regex: term, $options: 'i' } },
      { actorName: { $regex: term, $options: 'i' } },
      { targetId: { $regex: term, $options: 'i' } },
    ];
  }

  const createdAt: Record<string, Date> = {};
  if (query.from) {
    const from = new Date(query.from);
    if (!Number.isNaN(from.getTime())) createdAt.$gte = from;
  }
  if (query.to) {
    const to = new Date(query.to);
    if (!Number.isNaN(to.getTime())) {
      // Inclusive end-of-day when only a date is provided
      if (/^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
        to.setUTCHours(23, 59, 59, 999);
      }
      createdAt.$lte = to;
    }
  }
  if (Object.keys(createdAt).length) {
    filter.createdAt = createdAt;
  }

  const [items, total] = await Promise.all([
    ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    ActivityLog.countDocuments(filter),
  ]);

  return {
    items: items.map(toDto),
    total,
    page,
    pageSize,
  };
}
