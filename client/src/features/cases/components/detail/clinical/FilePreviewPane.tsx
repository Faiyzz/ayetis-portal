import {
  FILE_CATEGORY_LABELS,
  FILE_STORAGE_TIERS,
  type CaseFileDto,
} from '@ayetis/shared';
import { useEffect, useState } from 'react';
import { fetchCaseFileSignedUrl } from '@/features/cases/api';
import { IconCube, IconFile, IconImage, IconScan } from './ClinicalIcons';
import { isImageFile, isPdfFile, isStlLike } from './clinicalUtils';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StlViewerPlaceholder({ file }: { file: CaseFileDto }) {
  return (
    <div className="relative flex h-full min-h-72 flex-col overflow-hidden rounded-xl bg-linear-to-br from-slate-900 via-slate-800 to-teal-950 text-white">
      <div className="flex items-center justify-between px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-teal-200/80">
        <span>WebGL viewer</span>
        <span>Orbit · STL</span>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <svg viewBox="0 0 220 160" className="h-40 w-56" aria-hidden>
          <polygon points="110,18 198,62 110,106 22,62" fill="#134e4a" stroke="#2dd4bf" strokeWidth="1.5" />
          <polygon points="22,62 110,106 110,148 22,104" fill="#0f766e" stroke="#5eead4" strokeWidth="1" />
          <polygon points="110,106 198,62 198,104 110,148" fill="#115e59" stroke="#2dd4bf" strokeWidth="1" />
        </svg>
      </div>
      <div className="border-t border-white/10 px-4 py-3">
        <p className="truncate text-sm font-semibold">{file.originalName || file.filename}</p>
        <p className="text-xs text-slate-400">
          {FILE_CATEGORY_LABELS[file.category]} · {formatBytes(file.sizeBytes)} · v{file.version}
        </p>
      </div>
    </div>
  );
}

export function FilePreviewPane({
  caseId,
  file,
}: {
  caseId: string;
  file: CaseFileDto | null;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file) {
      setSrc(null);
      return;
    }
    if (file.viewUrl) {
      setSrc(file.viewUrl);
      setError('');
      return;
    }
    const previewable = isImageFile(file) || isPdfFile(file);
    if (!previewable) {
      setSrc(null);
      setError('');
      return;
    }
    const tier = file.storageTier ?? FILE_STORAGE_TIERS.HOT;
    if (tier !== FILE_STORAGE_TIERS.HOT) {
      setSrc(null);
      setError('File is not in hot storage. Restore it to preview.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    void fetchCaseFileSignedUrl(caseId, file.id)
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load preview');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, file]);

  if (!file) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface/40 px-6 text-center">
        <IconFile className="h-8 w-8 text-muted" />
        <p className="mt-3 text-sm font-semibold text-ink">Select a file</p>
        <p className="mt-1 text-sm text-muted">Preview STL scans, photos, and reports here.</p>
      </div>
    );
  }

  if (file.viewUrl) {
    return (
      <div className="flex h-full min-h-72 flex-col overflow-hidden rounded-xl border border-line">
        <iframe title={file.originalName || 'Viewer'} src={file.viewUrl} className="min-h-96 flex-1 bg-white" />
      </div>
    );
  }

  if (isStlLike(file)) {
    return <StlViewerPlaceholder file={file} />;
  }

  if (loading) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-xl border border-line bg-surface/40 text-sm text-muted">
        Loading preview…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-line bg-surface/40 px-6 text-center">
        <IconScan className="h-7 w-7 text-muted" />
        <p className="mt-3 text-sm text-muted">{error}</p>
      </div>
    );
  }

  if (src && isImageFile(file)) {
    return (
      <div className="flex min-h-72 flex-col overflow-hidden rounded-xl border border-line bg-slate-950">
        <img
          src={src}
          alt={file.originalName || file.filename}
          className="max-h-[32rem] w-full flex-1 object-contain"
        />
        <div className="border-t border-white/10 bg-slate-900 px-4 py-2.5 text-sm text-slate-200">
          {file.originalName || file.filename}
        </div>
      </div>
    );
  }

  if (src && isPdfFile(file)) {
    return (
      <iframe
        title={file.originalName || 'PDF'}
        src={src}
        className="min-h-96 w-full rounded-xl border border-line bg-white"
      />
    );
  }

  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-line bg-surface/40 px-6 text-center">
      {isImageFile(file) ? (
        <IconImage className="h-8 w-8 text-muted" />
      ) : (
        <IconCube className="h-8 w-8 text-muted" />
      )}
      <p className="mt-3 text-sm font-semibold text-ink">{file.originalName || file.filename}</p>
      <p className="mt-1 text-sm text-muted">
        {FILE_CATEGORY_LABELS[file.category]} · {formatBytes(file.sizeBytes)} · no inline preview
      </p>
    </div>
  );
}
