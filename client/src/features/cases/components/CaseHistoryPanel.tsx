import { formatHistoryValue, type CaseHistoryDto } from '@ayetis/shared';
import { useState } from 'react';
import { EmptyState } from '@/features/cases/components/detail/EmptyState';

export function CaseHistoryPanel({
  history,
  showFullAudit,
}: {
  history: CaseHistoryDto[];
  showFullAudit: boolean;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">
            {showFullAudit ? 'Change history' : 'History'}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {showFullAudit
              ? 'Audit log with field-level diffs where available.'
              : 'Case activity and status changes.'}
          </p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="No history yet"
            description="Actions on this case—status changes, assignments, and edits—will appear here as an audit trail."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface/50 text-xs uppercase tracking-[0.05em] text-muted">
                <th className="px-4 py-2.5 font-semibold">Time</th>
                <th className="px-4 py-2.5 font-semibold">User</th>
                <th className="px-4 py-2.5 font-semibold">Action</th>
                {showFullAudit ? (
                  <th className="px-4 py-2.5 font-semibold">Changes</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => {
                const hasChanges = Boolean(showFullAudit && entry.changes && entry.changes.length > 0);
                const open = expanded[entry.id] ?? false;
                return (
                  <tr key={entry.id} className="border-b border-line align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      <time dateTime={entry.createdAt}>
                        {new Date(entry.createdAt).toLocaleString()}
                      </time>
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">
                      {entry.actorName ?? 'System'}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      <p>{entry.summary}</p>
                      {entry.action ? (
                        <p className="mt-0.5 text-xs text-muted">{entry.action}</p>
                      ) : null}
                    </td>
                    {showFullAudit ? (
                      <td className="px-4 py-3">
                        {hasChanges ? (
                          <div>
                            <button
                              type="button"
                              onClick={() =>
                                setExpanded((s) => ({ ...s, [entry.id]: !open }))
                              }
                              className="text-xs font-semibold text-brand-700 hover:text-brand-800"
                            >
                              {open
                                ? 'Hide changes'
                                : `${entry.changes!.length} field change${
                                    entry.changes!.length === 1 ? '' : 's'
                                  }`}
                            </button>
                            {open ? (
                              <ul className="mt-2 space-y-1 rounded-lg bg-surface px-3 py-2 text-xs">
                                {entry.changes!.map((change) => (
                                  <li key={`${entry.id}-${change.field}`} className="text-ink">
                                    <span className="font-medium">{change.label}:</span>{' '}
                                    <span className="text-muted">
                                      {formatHistoryValue(change.field, change.from)}
                                    </span>
                                    <span className="mx-1 text-muted">→</span>
                                    <span>{formatHistoryValue(change.field, change.to)}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
