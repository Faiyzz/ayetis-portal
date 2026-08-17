import { FILE_CATEGORY_LABELS, type CaseDetailDto, type CaseFileDto } from '@ayetis/shared';
import { IconCube, IconImage, IconScan } from './ClinicalIcons';
import { pickHighlightMedia } from './clinicalUtils';

function MediaTile({
  label,
  caption,
  icon,
  onOpen,
}: {
  label: string;
  caption: string;
  icon: typeof IconCube;
  onOpen: () => void;
}) {
  const Icon = icon;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-slate-50 text-left transition hover:border-teal-300"
    >
      <div className="flex h-28 items-center justify-center bg-linear-to-br from-slate-100 to-teal-50 text-teal-800">
        <Icon className="h-8 w-8" />
      </div>
      <div className="border-t border-line bg-white px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-ink">{label}</p>
        <p className="truncate text-xs text-muted">{caption}</p>
      </div>
    </button>
  );
}

function fileCaption(file: CaseFileDto): string {
  return `${FILE_CATEGORY_LABELS[file.category]} · ${file.originalName || file.filename}`;
}

export function MediaGalleryPreview({
  caseData,
  onOpenFiles,
}: {
  caseData: CaseDetailDto;
  onOpenFiles: () => void;
}) {
  const { stl, xray, photos } = pickHighlightMedia(caseData.files);

  return (
    <article className="rounded-xl border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            High-value media
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-ink">Clinical gallery</h3>
        </div>
        <button
          type="button"
          onClick={onOpenFiles}
          className="text-sm font-semibold text-teal-800 hover:text-teal-900"
        >
          Open files
        </button>
      </div>

      {caseData.files.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No scans, radiographs, or photos attached yet.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MediaTile
            label={stl ? stl.originalName || stl.filename : '3D STL'}
            caption={stl ? fileCaption(stl) : 'No STL attached'}
            icon={IconCube}
            onOpen={onOpenFiles}
          />
          <MediaTile
            label={xray ? xray.originalName || xray.filename : 'Pano / X-ray'}
            caption={xray ? fileCaption(xray) : 'No radiograph attached'}
            icon={IconScan}
            onOpen={onOpenFiles}
          />
          <MediaTile
            label={photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'}` : 'Photo set'}
            caption={photos[0] ? fileCaption(photos[0]) : 'No photos attached'}
            icon={IconImage}
            onOpen={onOpenFiles}
          />
        </div>
      )}
    </article>
  );
}
