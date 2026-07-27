import {
  formatHistoryValue,
  type CaseHistoryDto,
} from '@ayetis/shared';

export function CaseHistoryPanel({
  history,
  showFullAudit,
}: {
  history: CaseHistoryDto[];
  showFullAudit: boolean;
}) {
  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">
          {showFullAudit ? 'Change history' : 'History'}
        </h2>
        {showFullAudit ? (
          <span className="text-xs text-muted">Full field-level audit</span>
        ) : null}
      </div>

      <ul className="mt-4 space-y-4">
        {history.length === 0 ? (
          <li className="text-sm text-muted">No history yet.</li>
        ) : (
          history.map((entry) => (
            <li key={entry.id} className="border-l-2 border-brand-200 pl-3 text-sm">
              <p className="font-medium text-ink">{entry.summary}</p>
              <p className="text-xs text-muted">
                {entry.actorName ?? 'System'} · {new Date(entry.createdAt).toLocaleString()}
              </p>

              {showFullAudit && entry.changes && entry.changes.length > 0 ? (
                <ul className="mt-2 space-y-1 rounded-lg bg-surface px-3 py-2 text-xs">
                  {entry.changes.map((change) => (
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
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
