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
import { EmptyState } from '@/features/cases/components/detail/EmptyState';
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

  const doctorMessages =
    selected?.messages.filter((m) => m.kind === CLARIFICATION_MESSAGE_KINDS.REPLY) ?? [];
  const requestMessages =
    selected?.messages.filter((m) => m.kind !== CLARIFICATION_MESSAGE_KINDS.REPLY) ?? [];

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
    <section className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">View Clarification</h2>
          <p className="mt-0.5 text-sm text-muted">
            Role-specific requests · Client Clarification / Attachments / Doctor Response
          </p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-brand-700 hover:border-brand-300"
          >
            {showCreate ? 'Cancel' : 'New request'}
          </button>
        ) : null}
      </div>

      {showCreate && canCreate ? (
        <form className="space-y-3 border-b border-line bg-surface/40 px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-ink">Sender role</span>
              <select
                value={senderRole}
                onChange={(e) => setSenderRole(e.target.value as ClarificationSenderRole)}
                className="w-full rounded-xl border border-line bg-white px-3 py-2"
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
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-ink">Type</span>
              <select
                value={clarificationType}
                onChange={(e) => setClarificationType(e.target.value)}
                className="w-full rounded-xl border border-line bg-white px-3 py-2"
              >
                {typeOptions.map((opt) => (
                  <option key={opt.type} value={opt.type}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-ink">Priority</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ClarificationPriority)}
                className="w-full rounded-xl border border-line bg-white px-3 py-2"
              >
                {ALL_CLARIFICATION_PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {CLARIFICATION_PRIORITY_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {typeOptions.find((t) => t.type === clarificationType)?.exampleTriggers?.length ? (
            <p className="text-xs text-muted">
              Example triggers:{' '}
              {typeOptions
                .find((t) => t.type === clarificationType)
                ?.exampleTriggers.join(' · ')}
            </p>
          ) : null}
          <TextField
            label="Subject"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Missing upper arch STL"
          />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Required information</span>
            <textarea
              required
              rows={3}
              value={requiredInfo}
              onChange={(e) => setRequiredInfo(e.target.value)}
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <AuthButton
              type="button"
              loading={creating}
              onClick={() => void handleCreate(false)}
            >
              Send to doctor
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
        <div className="p-6">
          <EmptyState title="No clarifications" description="Team requests will appear here." />
        </div>
      ) : (
        <div className="grid lg:grid-cols-[220px_1fr]">
          <ul className="max-h-[32rem] overflow-y-auto border-b border-line lg:border-b-0 lg:border-r">
            {clarifications.map((item) => {
              const active = item.id === selectedId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full border-b border-line px-3 py-3 text-left ${
                      active ? 'bg-brand-50/60' : 'hover:bg-surface'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-ink line-clamp-2">{item.subject}</p>
                      {item.status !== 'resolved' && !item.isDraft ? (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      {CLARIFICATION_SENDER_ROLE_LABELS[item.senderRole]} ·{' '}
                      {CLARIFICATION_STATUS_LABELS[item.status]}
                      {item.isDraft ? ' · Draft' : ''}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>

          {selected ? (
            <div className="grid gap-0 lg:grid-cols-3">
              {/* Panel 1: Client Clarification */}
              <div className="border-b border-line p-4 lg:border-b-0 lg:border-r">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Client Clarification
                </h3>
                <p className="mt-2 text-sm font-semibold text-ink">{selected.subject}</p>
                <p className="mt-1 text-xs text-muted">
                  {selected.clarificationTypeLabel} ·{' '}
                  {CLARIFICATION_PRIORITY_LABELS[selected.priority]} ·{' '}
                  {CLARIFICATION_SENDER_ROLE_LABELS[selected.senderRole]}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{selected.requiredInfo}</p>
                <div className="mt-4 space-y-2">
                  {requestMessages.map((message) => (
                    <div key={message.id} className="rounded-lg bg-surface/70 px-3 py-2 text-sm">
                      <p className="text-xs text-muted">
                        {message.authorName} ·{' '}
                        {ROLE_LABELS[message.authorRole as Role] ?? message.authorRole}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selected.isDraft && canCreate ? (
                    <AuthButton
                      type="button"
                      loading={busyId === selected.id}
                      onClick={() => void handlePublish(selected.id)}
                    >
                      Publish draft
                    </AuthButton>
                  ) : null}
                  {canCreate &&
                  selected.escalationStatus !== CLARIFICATION_ESCALATION_STATUSES.ESCALATED ? (
                    <button
                      type="button"
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold"
                      onClick={() => void handleEscalate(selected.id, true)}
                    >
                      Escalate
                    </button>
                  ) : null}
                  {canCreate &&
                  selected.escalationStatus === CLARIFICATION_ESCALATION_STATUSES.ESCALATED ? (
                    <button
                      type="button"
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold"
                      onClick={() => void handleEscalate(selected.id, false)}
                    >
                      De-escalate
                    </button>
                  ) : null}
                  {canResolve && !selected.isDraft ? (
                    <button
                      type="button"
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-brand-700"
                      onClick={() => void handleResolve(selected.id)}
                    >
                      Resolve
                    </button>
                  ) : null}
                </div>
                <p className="mt-3 text-[11px] text-muted">
                  Doctor read: {selected.doctorReadAt ? 'Yes' : 'No'} · Team read:{' '}
                  {selected.teamReadAt ? 'Yes' : 'No'} · Escalation:{' '}
                  {selected.escalationStatus}
                </p>
              </div>

              {/* Panel 2: Attachments */}
              <div className="border-b border-line p-4 lg:border-b-0 lg:border-r">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Attachments
                </h3>
                {selected.attachments.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">No attachments yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {selected.attachments.map((file) => (
                      <li
                        key={file.id}
                        className="rounded-lg border border-line px-3 py-2 text-sm"
                      >
                        <p className="font-medium text-ink">{file.originalName}</p>
                        <p className="text-xs text-muted">
                          {file.uploadedByName} · {Math.round(file.sizeBytes / 1024)} KB
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                {!readOnly ? (
                  <label className="mt-4 block">
                    <span className="text-xs font-semibold text-brand-700">Upload file</span>
                    <input
                      type="file"
                      className="mt-1 block w-full text-xs"
                      onChange={(e) =>
                        void handleUpload(selected.id, e.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                ) : null}
              </div>

              {/* Panel 3: Doctor Response */}
              <div className="p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Doctor Response
                </h3>
                <div className="mt-3 space-y-2">
                  {doctorMessages.length === 0 ? (
                    <p className="text-sm text-muted">No doctor response yet.</p>
                  ) : (
                    doctorMessages.map((message) => (
                      <div key={message.id} className="flex gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                          {initials(message.authorName)}
                        </div>
                        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm">
                          <p className="text-xs text-muted">{message.authorName}</p>
                          <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {canReply && selected.status !== 'resolved' && !selected.isDraft ? (
                  <div className="mt-4 space-y-2">
                    <textarea
                      rows={4}
                      value={responseDraft}
                      onChange={(e) => setResponseDraft(e.target.value)}
                      placeholder="Doctor response…"
                      className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <AuthButton
                        type="button"
                        loading={busyId === selected.id}
                        onClick={() => void handleReply(selected.id)}
                      >
                        Send response
                      </AuthButton>
                      <AuthButton
                        type="button"
                        variant="ghost"
                        loading={busyId === selected.id}
                        onClick={() => void handleSaveResponseDraft(selected.id)}
                      >
                        Save draft
                      </AuthButton>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
