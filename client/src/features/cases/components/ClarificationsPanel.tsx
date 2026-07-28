import {
  CLARIFICATION_STATUS_LABELS,
  PERMISSIONS,
  ROLE_LABELS,
  type ClarificationDto,
  type Role,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import {
  createClarification,
  replyToClarification,
  resolveClarification,
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
}: {
  caseId: string;
  clarifications: ClarificationDto[];
  onChanged: () => Promise<void> | void;
}) {
  const { can } = usePermissions();
  const canCreate = can(PERMISSIONS.CLARIFICATION_CREATE);
  const canReply = can(PERMISSIONS.CLARIFICATION_REPLY) || canCreate;
  const canResolve = can(PERMISSIONS.CLARIFICATION_RESOLVE);

  const [subject, setSubject] = useState('');
  const [requiredInfo, setRequiredInfo] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(clarifications[0]?.id ?? null);

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

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      await createClarification(caseId, {
        subject: subject.trim(),
        requiredInfo: requiredInfo.trim(),
      });
      setSubject('');
      setRequiredInfo('');
      setShowCreate(false);
      toast().success('Clarification request sent');
      await onChanged();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to create clarification'));
    } finally {
      setCreating(false);
    }
  }

  async function handleReply(clarificationId: string) {
    const body = (replyDrafts[clarificationId] ?? '').trim();
    if (!body) {
      toast().warning('Enter a reply');
      return;
    }
    setBusyId(clarificationId);
    try {
      await replyToClarification(clarificationId, { body });
      setReplyDrafts((prev) => ({ ...prev, [clarificationId]: '' }));
      toast().success('Reply sent');
      await onChanged();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to send reply'));
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

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Clarifications</h2>
          <p className="mt-0.5 text-sm text-muted">Threaded requests and replies for this case.</p>
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
        <form
          onSubmit={handleCreate}
          className="space-y-3 border-b border-line bg-surface/40 px-4 py-4"
        >
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
              placeholder="Describe what the doctor needs to provide…"
              className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            />
          </label>
          <div className="max-w-xs">
            <AuthButton loading={creating} disabled={!subject.trim() || !requiredInfo.trim()}>
              Send to doctor
            </AuthButton>
          </div>
        </form>
      ) : null}

      {clarifications.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="No clarifications yet"
            description="When information is missing or unclear, start a clarification thread so the doctor and team can resolve it in one place."
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M7 4h10a2 2 0 012 2v9a2 2 0 01-2 2H9l-4 3v-3H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
              </svg>
            }
          />
        </div>
      ) : (
        <div className="grid min-h-[22rem] lg:grid-cols-[16rem_minmax(0,1fr)]">
          <ul
            className="divide-y divide-line border-b border-line lg:border-b-0 lg:border-r"
            role="listbox"
            aria-label="Clarification threads"
          >
            {clarifications.map((item) => {
              const active = item.id === selectedId;
              const open = item.status !== 'resolved';
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full px-3.5 py-3 text-left transition ${
                      active ? 'bg-brand-50/70' : 'hover:bg-surface/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-ink">{item.subject}</p>
                      {open ? (
                        <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-label="Open" />
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">
                      {CLARIFICATION_STATUS_LABELS[item.status]} ·{' '}
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>

          {selected ? (
            <div className="flex min-h-0 flex-col">
              <div className="border-b border-line px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{selected.subject}</h3>
                    <p className="mt-0.5 text-xs text-muted">
                      {selected.createdByName} ·{' '}
                      {ROLE_LABELS[selected.createdByRole as Role] ?? selected.createdByRole} ·{' '}
                      {new Date(selected.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
                    {CLARIFICATION_STATUS_LABELS[selected.status]}
                  </span>
                </div>
                <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-amber-800">
                    Required information
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-ink">{selected.requiredInfo}</p>
                </div>
              </div>

              <ul className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                {selected.messages.map((message) => (
                  <li key={message.id} className="flex gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-700"
                      aria-hidden
                    >
                      {initials(message.authorName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">
                        {message.authorName}{' '}
                        <span className="font-normal text-muted">
                          · {ROLE_LABELS[message.authorRole as Role] ?? message.authorRole} ·{' '}
                          {new Date(message.createdAt).toLocaleString()}
                        </span>
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                        {message.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              {selected.status !== 'resolved' && (canReply || canResolve) ? (
                <div className="sticky bottom-0 space-y-2 border-t border-line bg-white px-4 py-3">
                  {canReply ? (
                    <textarea
                      rows={2}
                      value={replyDrafts[selected.id] ?? ''}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({ ...prev, [selected.id]: e.target.value }))
                      }
                      placeholder="Write your reply…"
                      className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                    />
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {canReply ? (
                      <button
                        type="button"
                        disabled={busyId === selected.id}
                        onClick={() => void handleReply(selected.id)}
                        className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                      >
                        {busyId === selected.id ? 'Sending…' : 'Send reply'}
                      </button>
                    ) : null}
                    {canResolve ? (
                      <button
                        type="button"
                        disabled={busyId === selected.id}
                        onClick={() => void handleResolve(selected.id)}
                        className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-brand-300 disabled:opacity-60"
                      >
                        Mark resolved
                      </button>
                    ) : null}
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
