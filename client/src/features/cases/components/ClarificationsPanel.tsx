import {
  CLARIFICATION_STATUS_LABELS,
  PERMISSIONS,
  ROLE_LABELS,
  type ClarificationDto,
  type Role,
} from '@ayetis/shared';
import { useState, type FormEvent } from 'react';
import { AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import {
  createClarification,
  replyToClarification,
  resolveClarification,
} from '@/features/clarifications/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

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
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

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
    <section className="space-y-4 rounded-xl border border-line bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">Clarification thread</h2>
        <p className="mt-1 text-sm text-muted">
          Requests and replies linked to this Case ID.
        </p>
      </div>

      {canCreate ? (
        <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-dashed border-line bg-surface/50 p-4">
          <p className="text-sm font-medium text-ink">Create clarification request</p>
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
        <p className="text-sm text-muted">No clarifications yet.</p>
      ) : (
        <ul className="space-y-4">
          {clarifications.map((item) => {
            const open = item.status !== 'resolved';
            return (
              <li key={item.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{item.subject}</p>
                    <p className="mt-1 text-xs text-muted">
                      {item.createdByName} ·{' '}
                      {ROLE_LABELS[item.createdByRole as Role] ?? item.createdByRole} ·{' '}
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
                    {CLARIFICATION_STATUS_LABELS[item.status]}
                  </span>
                </div>

                <div className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    Required information
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-ink">{item.requiredInfo}</p>
                </div>

                <ul className="mt-4 space-y-3 border-l-2 border-brand-100 pl-3">
                  {item.messages.map((message) => (
                    <li key={message.id} className="text-sm">
                      <p className="font-medium text-ink">
                        {message.authorName}{' '}
                        <span className="text-xs font-normal text-muted">
                          · {ROLE_LABELS[message.authorRole as Role] ?? message.authorRole} ·{' '}
                          {new Date(message.createdAt).toLocaleString()}
                        </span>
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-ink">{message.body}</p>
                    </li>
                  ))}
                </ul>

                {open && canReply ? (
                  <div className="mt-4 space-y-2">
                    <textarea
                      rows={3}
                      value={replyDrafts[item.id] ?? ''}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      placeholder="Write your reply…"
                      className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void handleReply(item.id)}
                        className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                      >
                        {busyId === item.id ? 'Sending…' : 'Send reply'}
                      </button>
                      {canResolve ? (
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void handleResolve(item.id)}
                          className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-brand-300 disabled:opacity-60"
                        >
                          Mark resolved
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {open && canResolve && !canReply ? (
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void handleResolve(item.id)}
                    className="mt-3 rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink"
                  >
                    Mark resolved
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
