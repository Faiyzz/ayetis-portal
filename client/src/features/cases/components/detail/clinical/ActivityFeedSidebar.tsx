import type { CaseDetailDto, CaseNoteDto } from '@ayetis/shared';
import { useState, type FormEvent } from 'react';
import { IconActivity, IconAlert, IconMessage, IconNote } from './ClinicalIcons';
import {
  buildActivityFeed,
  personInitials,
  relativeTime,
  type ActivityKind,
} from './clinicalUtils';

const KIND_STYLE: Record<ActivityKind, { wrap: string; icon: typeof IconMessage }> = {
  message: { wrap: 'bg-teal-50 text-teal-800', icon: IconMessage },
  note: { wrap: 'bg-slate-100 text-slate-700', icon: IconNote },
  event: { wrap: 'bg-indigo-50 text-indigo-700', icon: IconActivity },
  alert: { wrap: 'bg-amber-50 text-amber-800', icon: IconAlert },
};

export function ActivityFeedSidebar({
  caseData,
  canAddNote,
  savingNote,
  onAddNote,
  onOpenCommunication,
}: {
  caseData: CaseDetailDto;
  canAddNote: boolean;
  savingNote: boolean;
  onAddNote: (body: string) => Promise<void>;
  onOpenCommunication: () => void;
}) {
  const items = buildActivityFeed(caseData);
  const [note, setNote] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const body = note.trim();
    if (!body) return;
    await onAddNote(body);
    setNote('');
  }

  return (
    <aside className="flex max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-xl border border-line bg-white xl:sticky xl:top-16">
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Activity
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-ink">Feed</h3>
        </div>
        <button
          type="button"
          onClick={onOpenCommunication}
          className="text-xs font-semibold text-teal-800 hover:text-teal-900"
        >
          Full inbox
        </button>
      </div>

      {canAddNote ? (
        <form onSubmit={handleSubmit} className="border-b border-line px-4 py-3">
          <label className="sr-only" htmlFor="clinical-quick-note">
            Add note
          </label>
          <textarea
            id="clinical-quick-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Add a note for the team…"
            className="w-full resize-none rounded-lg border border-line bg-surface/50 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
          />
          <button
            type="submit"
            disabled={savingNote || !note.trim()}
            className="mt-2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {savingNote ? 'Saving…' : 'Post note'}
          </button>
        </form>
      ) : null}

      <ul className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {items.length === 0 ? (
          <li className="py-8 text-center text-sm text-muted">No activity yet.</li>
        ) : (
          items.map((item) => {
            const style = KIND_STYLE[item.kind];
            const Icon = style.icon;
            return (
              <li key={item.id} className="flex gap-2.5">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${style.wrap}`}
                  aria-hidden
                >
                  {item.kind === 'event' ? (
                    <Icon className="h-3.5 w-3.5" />
                  ) : (
                    personInitials(item.actor)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                    <time className="shrink-0 text-[11px] text-muted" dateTime={item.at}>
                      {relativeTime(item.at)}
                    </time>
                  </div>
                  <p className="mt-0.5 line-clamp-3 text-sm leading-snug text-muted">{item.body}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{item.actor}</p>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}

export function notesNewestFirst(notes: CaseNoteDto[]): CaseNoteDto[] {
  return [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
