import type { CaseDetailDto } from '@ayetis/shared';
import { IconLayers, IconNote, IconPaperclip, IconTooth } from './ClinicalIcons';
import { attachmentSummary, estimateAlignerSets } from './clinicalUtils';

export function KeyMetricsRow({
  caseData,
  onOpenTab,
}: {
  caseData: CaseDetailDto;
  onOpenTab: (tabId: string) => void;
}) {
  const attachments = attachmentSummary(caseData);
  const aligners = estimateAlignerSets(caseData);
  const latestNote = [...caseData.notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];

  const attachmentValue =
    attachments.allowed === false
      ? 'Off'
      : attachments.allowed
        ? attachments.restricted
          ? String(attachments.restricted)
          : 'On'
        : '—';
  const attachmentCaption =
    attachments.allowed === false
      ? 'Engagers not permitted'
      : attachments.restricted
        ? `${attachments.restricted} teeth restricted`
        : attachments.allowed
          ? 'Engagers allowed'
          : 'Not specified';

  const cards = [
    {
      id: 'attachments',
      label: 'Active attachments',
      value: attachmentValue,
      caption: attachmentCaption,
      icon: IconTooth,
      tab: 'clinical',
    },
    {
      id: 'aligners',
      label: 'Remaining aligners',
      value: aligners.remaining == null ? '—' : String(aligners.remaining),
      caption: aligners.caption,
      icon: IconLayers,
      tab: 'clinical',
    },
    {
      id: 'notes',
      label: 'Recent notes',
      value: String(caseData.notes.length),
      caption: latestNote ? latestNote.body.slice(0, 42) : 'No notes yet',
      icon: IconNote,
      tab: 'communication',
    },
    {
      id: 'files',
      label: 'Clinical files',
      value: String(caseData.files.length),
      caption:
        caseData.openClarificationCount > 0
          ? `${caseData.openClarificationCount} open clarifications`
          : 'Scans, photos, reports',
      icon: IconPaperclip,
      tab: 'files',
      highlight: caseData.openClarificationCount > 0,
    },
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => onOpenTab(card.tab)}
          className={`rounded-xl border p-4 text-left transition hover:border-teal-300 ${
            'highlight' in card && card.highlight
              ? 'border-amber-200 bg-amber-50/60'
              : 'border-line bg-white'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">
              {card.label}
            </p>
            <card.icon className="h-4 w-4 text-teal-700" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink">{card.value}</p>
          <p className="mt-1 line-clamp-1 text-xs text-muted">{card.caption}</p>
        </button>
      ))}
    </div>
  );
}
