import type { CaseNoteDto } from '@ayetis/shared';
import { useState, type FormEvent } from 'react';
import { AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { EmptyState } from './EmptyState';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleString();
}

export function ActivityNotes({
  notes,
  canAdd,
  saving,
  onAdd,
}: {
  notes: CaseNoteDto[];
  canAdd: boolean;
  saving?: boolean;
  onAdd: (body: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const body = note.trim();
    if (!body) return;
    await onAdd(body);
    setNote('');
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">Activity notes</h3>
        <p className="mt-0.5 text-sm text-muted">
          Team comments and special requirements for this case.
        </p>
      </div>

      <div className="space-y-4 p-4">
        {canAdd ? (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-line bg-surface/40 p-3">
            <TextField
              label="Add note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Case note or special instruction…"
            />
            <div className="max-w-xs">
              <AuthButton loading={saving} disabled={!note.trim()}>
                Add note
              </AuthButton>
            </div>
          </form>
        ) : null}

        {notes.length === 0 ? (
          <EmptyState
            title="No notes yet"
            description="Add a note when you need to leave context for the team—special requirements, handoff details, or follow-ups."
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h8M8 10h8M8 14h5M6 3h12a2 2 0 012 2v14l-4-2-4 2-4-2-4 2V5a2 2 0 012-2z" />
              </svg>
            }
          />
        ) : (
          <ul className="space-y-3">
            {[...notes].reverse().map((item) => (
              <li key={item.id} className="flex gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700"
                  aria-hidden
                >
                  {initials(item.authorName)}
                </div>
                <div className="min-w-0 flex-1 rounded-lg border border-line bg-surface/30 px-3.5 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{item.authorName}</p>
                    <time
                      className="text-xs text-muted"
                      dateTime={item.createdAt}
                      title={new Date(item.createdAt).toLocaleString()}
                    >
                      {relativeTime(item.createdAt)}
                    </time>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
