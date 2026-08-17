import type { CaseNoteDto } from '@ayetis/shared';
import { useState, type FormEvent } from 'react';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
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
    <section className="flex max-h-[40rem] flex-col overflow-hidden rounded-lg border border-line bg-white">
      <div className="px-5 py-4">
        <h2 className="text-base font-semibold text-ink">Notes</h2>
      </div>

      {canAdd ? (
        <form onSubmit={handleSubmit} className="border-t border-line px-5 py-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Add a note…"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
          <button
            type="submit"
            disabled={saving || !note.trim()}
            className="mt-2 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Post'}
          </button>
        </form>
      ) : null}

      <ul className="flex-1 space-y-4 overflow-y-auto border-t border-line px-5 py-4">
        {notes.length === 0 ? (
          <li className="text-sm text-muted">No notes yet.</li>
        ) : (
          [...notes].reverse().map((item) => (
            <li key={item.id} className="flex gap-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700"
                aria-hidden
              >
                {initials(item.authorName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{item.authorName}</p>
                  <time className="shrink-0 text-xs text-muted" dateTime={item.createdAt}>
                    {relativeTime(item.createdAt)}
                  </time>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {item.body}
                </p>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
