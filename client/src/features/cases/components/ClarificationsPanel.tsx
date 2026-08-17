import {
  ALL_CLARIFICATION_PRIORITIES,
  CLARIFICATION_ESCALATION_STATUSES,
  CLARIFICATION_MESSAGE_KINDS,
  CLARIFICATION_PRIORITIES,
  CLARIFICATION_PRIORITY_LABELS,
  CLARIFICATION_SENDER_ROLE_LABELS,
  CLARIFICATION_STATUS_LABELS,
  CLARIFICATION_TYPES_BY_SENDER,
  PERMISSIONS,
  ROLE_LABELS,
  resolveClarificationSenderRole,
  type ClarificationDto,
  type ClarificationPriority,
  type ClarificationSenderRole,
  type Role,
} from '@ayetis/shared';
import { useEffect, useMemo, useState } from 'react';
import { AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import { useAuthStore } from '@/features/auth/store';
import {
  createClarification,
  escalateClarification,
  markClarificationRead,
  publishClarificationDraft,
  replyToClarification,
  resolveClarification,
  updateClarificationDraft,
  uploadClarificationAttachment,
} from '@/features/clarifications/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export function ClarificationsPanel({
  caseId,
  clarifications,
  onChanged,
  readOnly = false,
}: {
  caseId: string;
  clarifications: ClarificationDto[];
  onChanged: () => Promise<void> | void;
  readOnly?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const { can } = usePermissions();
  const canCreate = !readOnly && can(PERMISSIONS.CLARIFICATION_CREATE);
  const canReply =
    !readOnly && (can(PERMISSIONS.CLARIFICATION_REPLY) || can(PERMISSIONS.CLARIFICATION_CREATE));
  const canResolve = !readOnly && can(PERMISSIONS.CLARIFICATION_RESOLVE);

  const defaultSender =
    resolveClarificationSenderRole(user?.role ?? '') ?? ('coordinator' as ClarificationSenderRole);

  const [subject, setSubject] = useState('');
  const [requiredInfo, setRequiredInfo] = useState('');
  const [senderRole, setSenderRole] = useState<ClarificationSenderRole>(defaultSender);
  const [clarificationType, setClarificationType] = useState(
    CLARIFICATION_TYPES_BY_SENDER[defaultSender][0]?.type ?? 'missing_records',
  );
  const [priority, setPriority] = useState<ClarificationPriority>(CLARIFICATION_PRIORITIES.NORMAL);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(clarifications[0]?.id ?? null);
  const [responseDraft, setResponseDraft] = useState('');

  const typeOptions = useMemo(
    () => CLARIFICATION_TYPES_BY_SENDER[senderRole] ?? [],
    [senderRole],
  );

  useEffect(() => {
    if (!typeOptions.some((t) => t.type === clarificationType)) {
      setClarificationType(typeOptions[0]?.type ?? 'missing_records');
    }
  }, [typeOptions, clarificationType]);

  useEffect(() => {
    if (clarifications.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !clarifications.some((c) => c.id === selectedId)) {
      setSelectedId(clarifications[0]!.id);
    }
  }, [clarifications, selectedId]);

  const selected = clarifications.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      setResponseDraft('');
      return;
    }
    setResponseDraft(selected.doctorResponseDraft ?? '');
    if (!selected.doctorReadAt && can(PERMISSIONS.CASE_VIEW_OWN)) {
      void markClarificationRead(selected.id).catch(() => undefined);
    }
  }, [selected?.id]);

  const threadMessages = useMemo(() => {
    if (!selected) return [];
    const opener = {
      id: `open-${selected.id}`,
      kind: 'request',
      body: selected.requiredInfo,
      authorName: selected.createdByName,
      authorRole: selected.createdByRole,
      createdAt: selected.createdAt,
    };
    return [opener, ...selected.messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [selected]);

  async function handleCreate(asDraft: boolean) {
    setCreating(true);
    try {
      await createClarification(caseId, {
        subject: subject.trim(),
        requiredInfo: requiredInfo.trim(),
        clarificationType,
        senderRole,
        priority,
        asDraft,
      });
      setSubject('');
      setRequiredInfo('');
      setShowCreate(false);
      toast().success(asDraft ? 'Draft saved' : 'Clarification request sent');
      await onChanged();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to create clarification'));
    } finally {
      setCreating(false);
    }
  }

  async function handleReply(clarificationId: string) {
    const body = responseDraft.trim();
    if (!body) {
      toast().warning('Enter a reply');
      return;
    }
    setBusyId(clarificationId);
    try {
      await replyToClarification(clarificationId, { body });
      setResponseDraft('');
      toast().success('Reply sent');
      await onChanged();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to send reply'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveResponseDraft(clarificationId: string) {
    setBusyId(clarificationId);
    try {
      await updateClarificationDraft(clarificationId, {
        doctorResponseDraft: responseDraft,
      });
      toast().success('Response draft saved');
      await onChanged();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to save draft'));
    } finally {
      setBusyId(null);
    }
  }

  async function handlePublish(clarificationId: string) {
    setBusyId(clarificationId);
    try {
      await publishClarificationDraft(clarificationId);
      toast().success('Clarification published');
      await onChanged();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to publish'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleResolve(clarificationId: string) {
    setBusyId(clarificationId);
    try {
      await resolveClarification(clarificationId);
      toast().success('Clarification resolved');
      await onChanged();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to resolve clarification'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleEscalate(clarificationId: string, escalate: boolean) {
    setBusyId(clarificationId);
    try {
      await escalateClarification(clarificationId, {
        escalate,
        reason: escalate ? 'Escalated for oversight' : undefined,
      });
      toast().success(escalate ? 'Escalated' : 'De-escalated');
      await onChanged();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to update escalation'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpload(clarificationId: string, file: File | null) {
    if (!file) return;
    setBusyId(clarificationId);
    try {
      await uploadClarificationAttachment(clarificationId, file);
      toast().success('Attachment uploaded');
      await onChanged();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to upload attachment'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
        <h2 className="text-base font-semibold text-ink">Clarifications</h2>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface"
          >
            {showCreate ? 'Cancel' : 'New request'}
          </button>
        ) : null}
      </div>

      {showCreate && canCreate ? (
        <form className="space-y-3 border-t border-line px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="text-xs text-muted">Sender</span>
              <select
                value={senderRole}
                onChange={(e) => setSenderRole(e.target.value as ClarificationSenderRole)}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2"
                disabled={Boolean(resolveClarificationSenderRole(user?.role ?? ''))}
              >
                {(Object.keys(CLARIFICATION_TYPES_BY_SENDER) as ClarificationSenderRole[]).map(
                  (role) => (
                    <option key={role} value={role}>
                      {CLARIFICATION_SENDER_ROLE_LABELS[role]}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-xs text-muted">Type</span>
              <select
                value={clarificationType}
                onChange={(e) => setClarificationType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2"
              >
                {typeOptions.map((opt) => (
                  <option key={opt.type} value={opt.type}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-xs text-muted">Priority</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ClarificationPriority)}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2"
              >
                {ALL_CLARIFICATION_PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {CLARIFICATION_PRIORITY_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <TextField
            label="Subject"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Missing upper arch STL"
          />
          <label className="block">
            <span className="text-xs text-muted">Required information</span>
            <textarea
              required
              rows={3}
              value={requiredInfo}
              onChange={(e) => setRequiredInfo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <AuthButton type="button" loading={creating} onClick={() => void handleCreate(false)}>
              Send
            </AuthButton>
            <AuthButton
              type="button"
              variant="ghost"
              loading={creating}
              onClick={() => void handleCreate(true)}
            >
              Save draft
            </AuthButton>
          </div>
        </form>
      ) : null}

      {clarifications.length === 0 ? (
        <div className="border-t border-line px-5 py-10">
          <p className="text-sm text-muted">No clarification requests yet.</p>
        </div>
      ) : (
        <div className="grid border-t border-line lg:grid-cols-[15rem_minmax(0,1fr)]">
          <ul className="max-h-[36rem] overflow-y-auto lg:border-r lg:border-line">
            {clarifications.map((item) => {
              const active = item.id === selectedId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full px-4 py-3 text-left ${
                      active ? 'bg-surface' : 'hover:bg-surface/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-medium text-ink">{item.subject}</p>
                      {item.status !== 'resolved' && !item.isDraft ? (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {CLARIFICATION_STATUS_LABELS[item.status]}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>

          {selected ? (
            <div className="flex min-h-[28rem] flex-col">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{selected.subject}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {selected.clarificationTypeLabel}
                    <span className="mx-1.5">·</span>
                    {CLARIFICATION_PRIORITY_LABELS[selected.priority]}
                    <span className="mx-1.5">·</span>
                    {CLARIFICATION_STATUS_LABELS[selected.status]}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected.isDraft && canCreate ? (
                    <AuthButton
                      type="button"
                      loading={busyId === selected.id}
                      onClick={() => void handlePublish(selected.id)}
                    >
                      Publish
                    </AuthButton>
                  ) : null}
                  {canCreate &&
                  selected.escalationStatus !== CLARIFICATION_ESCALATION_STATUSES.ESCALATED ? (
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-surface hover:text-ink"
                      onClick={() => void handleEscalate(selected.id, true)}
                    >
                      Escalate
                    </button>
                  ) : null}
                  {canCreate &&
                  selected.escalationStatus === CLARIFICATION_ESCALATION_STATUSES.ESCALATED ? (
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-surface hover:text-ink"
                      onClick={() => void handleEscalate(selected.id, false)}
                    >
                      De-escalate
                    </button>
                  ) : null}
                  {canResolve && !selected.isDraft ? (
                    <button
                      type="button"
                      className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface"
                      onClick={() => void handleResolve(selected.id)}
                    >
                      Resolve
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {threadMessages.map((message) => {
                  const isReply =
                    'kind' in message &&
                    message.kind === CLARIFICATION_MESSAGE_KINDS.REPLY;
                  return (
                    <div key={message.id} className="flex gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                          isReply ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {initials(message.authorName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <p className="text-sm font-medium text-ink">{message.authorName}</p>
                          <p className="text-xs text-muted">
                            {ROLE_LABELS[message.authorRole as Role] ?? message.authorRole}
                          </p>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                          {message.body}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {selected.attachments.length > 0 ? (
                  <ul className="space-y-1 border-t border-line pt-3">
                    {selected.attachments.map((file) => (
                      <li key={file.id} className="text-sm text-ink">
                        {file.originalName}
                        <span className="ml-2 text-xs text-muted">
                          {Math.round(file.sizeBytes / 1024)} KB
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {!readOnly ? (
                  <label className="block text-sm">
                    <span className="text-xs font-medium text-ink">Attach file</span>
                    <input
                      type="file"
                      className="mt-1 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
                      onChange={(e) =>
                        void handleUpload(selected.id, e.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                ) : null}
              </div>

              {canReply && selected.status !== 'resolved' && !selected.isDraft ? (
                <div className="border-t border-line px-5 py-3">
                  <textarea
                    rows={3}
                    value={responseDraft}
                    onChange={(e) => setResponseDraft(e.target.value)}
                    placeholder="Write a reply…"
                    className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <AuthButton
                      type="button"
                      loading={busyId === selected.id}
                      onClick={() => void handleReply(selected.id)}
                    >
                      Send
                    </AuthButton>
                    <button
                      type="button"
                      className="text-sm text-muted hover:text-ink"
                      disabled={busyId === selected.id}
                      onClick={() => void handleSaveResponseDraft(selected.id)}
                    >
                      Save draft
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
