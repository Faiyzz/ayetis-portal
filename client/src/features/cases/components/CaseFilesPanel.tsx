import {
  ALL_FILE_CATEGORIES,
  FILE_CATEGORIES,
  FILE_CATEGORY_LABELS,
  FILE_RESTORE_PENDING_CODE,
  FILE_STORAGE_TIER_LABELS,
  FILE_STORAGE_TIERS,
  type CaseDetailDto,
  type CaseFileDto,
  type FileCategory,
  type FileStorageTier,
} from '@ayetis/shared';
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AuthButton } from '@/features/auth/components/AuthUI';
import {
  attachCaseViewerLink,
  downloadAllCaseFiles,
  downloadCaseFile,
  fetchCase,
  getCaseFileRestoreStatus,
  restoreCaseFile,
  uploadCaseFiles,
} from '@/features/cases/api';
import { EmptyState } from '@/features/cases/components/detail/EmptyState';
import { toast } from '@/features/notifications/toastStore';
import { getErrorCode, getErrorMessage } from '@/lib/api';

const UPLOAD_ACCEPT =
  '.stl,.obj,.ply,.dcm,.dicom,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tif,.tiff,.pdf,.zip,.rar,.7z,.mp4,.mov,.webm,.avi,.mkv,.wmv,.html,.htm,.txt,.csv,.doc,.docx,.xls,.xlsx,image/*,video/*,application/zip,application/x-7z-compressed,application/vnd.rar';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function groupByOriginalName(files: CaseFileDto[]) {
  const map = new Map<string, CaseFileDto[]>();
  for (const file of files) {
    const key = file.originalName || file.filename;
    const list = map.get(key) ?? [];
    list.push(file);
    map.set(key, list);
  }
  return [...map.entries()].map(([name, versions]) => ({
    name,
    versions: [...versions].sort((a, b) => b.version - a.version),
  }));
}

function categoryIcon(category: FileCategory) {
  return (FILE_CATEGORY_LABELS[category] ?? category).slice(0, 3).toUpperCase();
}

function StorageBadge({ tier }: { tier: FileStorageTier }) {
  if (tier === FILE_STORAGE_TIERS.HOT) return null;
  const styles =
    tier === FILE_STORAGE_TIERS.RESTORING
      ? 'bg-amber-50 text-amber-900'
      : tier === FILE_STORAGE_TIERS.PURGED
        ? 'bg-red-50 text-red-800'
        : 'bg-slate-100 text-slate-700';
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles}`}
    >
      {FILE_STORAGE_TIER_LABELS[tier]}
    </span>
  );
}

function isViewerLink(file: CaseFileDto) {
  return file.category === FILE_CATEGORIES.HTML_LINK || Boolean(file.viewUrl);
}

function FileActions({
  file,
  downloadingId,
  restoringId,
  onDownload,
  onRestore,
}: {
  file: CaseFileDto;
  downloadingId: string | null;
  restoringId: string | null;
  onDownload: (file: CaseFileDto) => void;
  onRestore: (file: CaseFileDto) => void;
}) {
  if (isViewerLink(file) && file.viewUrl) {
    return (
      <a
        href={file.viewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-brand-700 hover:border-brand-300"
      >
        Open link
      </a>
    );
  }

  const tier = file.storageTier ?? FILE_STORAGE_TIERS.HOT;
  if (tier === FILE_STORAGE_TIERS.PURGED) {
    return <span className="text-xs text-muted">Removed</span>;
  }
  if (tier === FILE_STORAGE_TIERS.COLD) {
    return (
      <button
        type="button"
        onClick={() => onRestore(file)}
        disabled={restoringId === file.id}
        className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-ink hover:border-brand-300 disabled:opacity-60"
      >
        {restoringId === file.id ? 'Starting…' : 'Restore'}
      </button>
    );
  }
  if (tier === FILE_STORAGE_TIERS.RESTORING) {
    return <span className="text-xs font-medium text-amber-800">Restoring…</span>;
  }
  return (
    <button
      type="button"
      onClick={() => onDownload(file)}
      disabled={downloadingId === file.id}
      className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-brand-700 disabled:opacity-60"
    >
      {downloadingId === file.id ? '…' : 'Download'}
    </button>
  );
}

export function CaseFilesPanel({
  caseId,
  files,
  canUpload,
  onUpdated,
  defaultUploadCategory,
}: {
  caseId: string;
  files: CaseFileDto[];
  canUpload: boolean;
  onUpdated: (filesCase: CaseDetailDto) => void;
  defaultUploadCategory?: FileCategory;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<FileCategory | ''>(defaultUploadCategory ?? '');
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<FileCategory | ''>('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showUpload, setShowUpload] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);

  const restoringIds = useMemo(
    () => files.filter((f) => f.storageTier === FILE_STORAGE_TIERS.RESTORING).map((f) => f.id),
    [files],
  );

  useEffect(() => {
    if (restoringIds.length === 0) return;
    const timer = window.setInterval(() => {
      void (async () => {
        let needsRefresh = false;
        for (const fileId of restoringIds) {
          try {
            const status = await getCaseFileRestoreStatus(caseId, fileId);
            if (status.storageTier === FILE_STORAGE_TIERS.HOT) {
              needsRefresh = true;
              toast().success('File restore complete — ready to download');
            }
          } catch {
            // ignore poll errors
          }
        }
        if (needsRefresh) {
          try {
            onUpdated(await fetchCase(caseId));
          } catch {
            // ignore
          }
        }
      })();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [caseId, restoringIds, onUpdated]);

  const groups = useMemo(() => {
    const all = groupByOriginalName(files);
    const q = search.trim().toLowerCase();
    return all.filter((group) => {
      const latest = group.versions[0]!;
      if (filterCategory && latest.category !== filterCategory) return false;
      if (!q) return true;
      return (
        group.name.toLowerCase().includes(q) ||
        (latest.note ?? '').toLowerCase().includes(q) ||
        latest.uploadedByName.toLowerCase().includes(q)
      );
    });
  }, [files, search, filterCategory]);

  function onPick(fileList: FileList | null) {
    if (!fileList) return;
    setSelected(Array.from(fileList));
  }

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (selected.length === 0) {
      toast().warning('Choose at least one file');
      return;
    }

    setUploading(true);
    try {
      const updated = await uploadCaseFiles(caseId, selected, {
        category: category || undefined,
        note: note.trim() || undefined,
      });
      onUpdated(updated);
      setSelected([]);
      setNote('');
      setCategory('');
      if (inputRef.current) inputRef.current.value = '';
      setShowUpload(false);
      const extracted = selected.some((f) => /\.(zip|rar|7z)$/i.test(f.name));
      toast().success(
        extracted
          ? 'Archive extracted — supported files attached to the case'
          : selected.length === 1
            ? 'File uploaded'
            : `${selected.length} files uploaded`,
      );
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to upload files'));
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(file: CaseFileDto) {
    setDownloadingId(file.id);
    try {
      await downloadCaseFile(caseId, file.id, file.originalName || file.filename);
    } catch (err) {
      if (getErrorCode(err) === FILE_RESTORE_PENDING_CODE) {
        toast().warning('File is in cold storage. Start a restore first.');
      } else {
        toast().error(getErrorMessage(err, 'Unable to download file'));
      }
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleRestore(file: CaseFileDto) {
    setRestoringId(file.id);
    try {
      const updated = await restoreCaseFile(caseId, file.id);
      onUpdated(updated);
      toast().success('Restore started. You’ll be able to download when it finishes.');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to start restore'));
    } finally {
      setRestoringId(null);
    }
  }

  async function handleAttachLink(event: FormEvent) {
    event.preventDefault();
    if (!linkUrl.trim()) {
      toast().warning('Enter a viewer URL');
      return;
    }
    setLinkBusy(true);
    try {
      onUpdated(
        await attachCaseViewerLink(caseId, {
          url: linkUrl.trim(),
          label: linkLabel.trim() || undefined,
          note: note.trim() || undefined,
        }),
      );
      setLinkUrl('');
      setLinkLabel('');
      toast().success('Viewer link attached');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to attach viewer link'));
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleDownloadAll() {
    setDownloadingAll(true);
    try {
      await downloadAllCaseFiles(caseId);
      toast().success('Download started');
    } catch (err) {
      if (getErrorCode(err) === FILE_RESTORE_PENDING_CODE) {
        toast().warning('Some files are still in cold storage. Restore them first.');
      } else {
        toast().error(getErrorMessage(err, 'Unable to download all files'));
      }
    } finally {
      setDownloadingAll(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Patient files</h2>
          <p className="mt-0.5 text-sm text-muted">
            ZIP/RAR/7Z archives auto-extract; STL members become scan files. Also attach HTML viewer
            links. Unused files move to cold storage after the hot window.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {files.length > 0 ? (
            <button
              type="button"
              disabled={downloadingAll}
              onClick={() => void handleDownloadAll()}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-brand-700 hover:border-brand-300 disabled:opacity-60"
            >
              {downloadingAll ? 'Preparing zip…' : 'Download all'}
            </button>
          ) : null}
          {canUpload ? (
            <button
              type="button"
              onClick={() => setShowUpload((v) => !v)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand-300"
            >
              {showUpload ? 'Hide upload' : 'Upload'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface/40 px-4 py-2.5">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search files…"
          className="min-w-40 flex-1 rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory((e.target.value || '') as FileCategory | '')}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500"
        >
          <option value="">All categories</option>
          {ALL_FILE_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {FILE_CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
        <div className="flex rounded-lg border border-line bg-white p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
              viewMode === 'list' ? 'bg-brand-50 text-brand-700' : 'text-muted'
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
              viewMode === 'grid' ? 'bg-brand-50 text-brand-700' : 'text-muted'
            }`}
          >
            Grid
          </button>
        </div>
      </div>

      {showUpload && canUpload ? (
        <div className="space-y-4 border-b border-line bg-surface/30 px-4 py-4">
          <form onSubmit={handleUpload} className="space-y-3">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={UPLOAD_ACCEPT}
              onChange={(e) => onPick(e.target.files)}
              className="block w-full text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
            />
            <p className="text-xs text-muted">
              Supported: STL, OBJ, PLY, DICOM, images, OPG/CBCT (named), PDF, videos, ZIP/RAR/7Z,
              HTML, office docs.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Category (optional)</span>
                <select
                  value={category}
                  onChange={(e) => setCategory((e.target.value || '') as FileCategory | '')}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                >
                  <option value="">Auto-detect</option>
                  {ALL_FILE_CATEGORIES.filter(
                    (c) => c !== FILE_CATEGORIES.OTHER && c !== FILE_CATEGORIES.ARCHIVE,
                  ).map((value) => (
                    <option key={value} value={value}>
                      {FILE_CATEGORY_LABELS[value]}
                    </option>
                  ))}
                  <option value={FILE_CATEGORIES.OTHER}>
                    {FILE_CATEGORY_LABELS[FILE_CATEGORIES.OTHER]}
                  </option>
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Note (optional)</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Upper arch STL"
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                />
              </label>
            </div>
            {selected.length > 0 ? (
              <ul className="space-y-1 text-xs text-muted">
                {selected.map((file) => (
                  <li key={`${file.name}-${file.size}`}>
                    {file.name} · {formatBytes(file.size)}
                    {/\.(zip|rar|7z)$/i.test(file.name) ? ' · will auto-extract' : ''}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="max-w-xs">
              <AuthButton loading={uploading} disabled={selected.length === 0}>
                Upload files
              </AuthButton>
            </div>
          </form>

          <form
            onSubmit={handleAttachLink}
            className="space-y-3 border-t border-dashed border-line pt-4"
          >
            <h3 className="text-sm font-semibold text-ink">HTML viewer link</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-ink">URL</span>
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://viewer.example.com/case/…"
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Label (optional)</span>
                <input
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  placeholder="3D viewer"
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                />
              </label>
            </div>
            <div className="max-w-xs">
              <AuthButton type="submit" loading={linkBusy} disabled={!linkUrl.trim()}>
                Attach link
              </AuthButton>
            </div>
          </form>
        </div>
      ) : null}

      <div className="p-4">
        {groups.length === 0 ? (
          <EmptyState
            title={files.length === 0 ? 'No files attached' : 'No matching files'}
            description={
              files.length === 0
                ? 'Upload patient scans, photos, X-rays, or models so the design team has everything they need.'
                : 'Try a different search or category filter.'
            }
            icon={
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 13h6m-6 4h4M7 3h8l4 4v12a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
                />
              </svg>
            }
          />
        ) : viewMode === 'grid' ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => {
              const latest = group.versions[0]!;
              return (
                <li key={group.name} className="rounded-xl border border-line p-3">
                  <div className="flex h-20 items-center justify-center rounded-lg bg-surface text-xs font-bold tracking-wide text-brand-700">
                    {categoryIcon(latest.category)}
                  </div>
                  <div className="mt-2 flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-ink" title={group.name}>
                      {group.name}
                    </p>
                    <StorageBadge tier={latest.storageTier ?? FILE_STORAGE_TIERS.HOT} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {FILE_CATEGORY_LABELS[latest.category]} · {formatBytes(latest.sizeBytes)} · v
                    {latest.version}
                  </p>
                  <div className="mt-3">
                    <FileActions
                      file={latest}
                      downloadingId={downloadingId}
                      restoringId={restoringId}
                      onDownload={(f) => void handleDownload(f)}
                      onRestore={(f) => void handleRestore(f)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                  <th className="px-2 py-2 font-semibold">File</th>
                  <th className="px-2 py-2 font-semibold">Category</th>
                  <th className="px-2 py-2 font-semibold">Size</th>
                  <th className="px-2 py-2 font-semibold">Uploader</th>
                  <th className="px-2 py-2 font-semibold">Uploaded</th>
                  <th className="px-2 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  const latest = group.versions[0]!;
                  const hasHistory = group.versions.length > 1;
                  const open = expandedHistory[group.name] ?? false;
                  return (
                    <Fragment key={group.name}>
                      <tr className="border-b border-line">
                        <td className="px-2 py-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="font-medium text-ink">{group.name}</p>
                            <StorageBadge tier={latest.storageTier ?? FILE_STORAGE_TIERS.HOT} />
                          </div>
                          {latest.note ? <p className="text-xs text-muted">{latest.note}</p> : null}
                          {latest.extractedFrom ? (
                            <p className="text-xs text-brand-700">
                              Extracted from {latest.extractedFrom}
                            </p>
                          ) : null}
                          {latest.viewUrl ? (
                            <p className="truncate text-xs text-muted" title={latest.viewUrl}>
                              {latest.viewUrl}
                            </p>
                          ) : null}
                          <p className="text-xs text-muted">v{latest.version} (latest)</p>
                        </td>
                        <td className="px-2 py-2.5 text-muted">
                          {FILE_CATEGORY_LABELS[latest.category]}
                        </td>
                        <td className="px-2 py-2.5 tabular-nums text-muted">
                          {formatBytes(latest.sizeBytes)}
                        </td>
                        <td className="px-2 py-2.5 text-muted">{latest.uploadedByName}</td>
                        <td className="px-2 py-2.5 text-muted">
                          {new Date(latest.createdAt).toLocaleString()}
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {hasHistory ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedHistory((s) => ({ ...s, [group.name]: !open }))
                                }
                                className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-ink"
                              >
                                {open ? 'Hide' : `v${group.versions.length}`}
                              </button>
                            ) : null}
                            <FileActions
                              file={latest}
                              downloadingId={downloadingId}
                              restoringId={restoringId}
                              onDownload={(f) => void handleDownload(f)}
                              onRestore={(f) => void handleRestore(f)}
                            />
                          </div>
                        </td>
                      </tr>
                      {hasHistory && open
                        ? group.versions.map((file) => (
                            <tr key={file.id} className="border-b border-line bg-surface/40">
                              <td className="px-2 py-2 pl-6 text-xs text-muted" colSpan={4}>
                                <span className="inline-flex items-center gap-1.5">
                                  v{file.version} · {formatBytes(file.sizeBytes)} ·{' '}
                                  {file.uploadedByName}
                                  <StorageBadge tier={file.storageTier ?? FILE_STORAGE_TIERS.HOT} />
                                </span>
                                {file.note ? ` · ${file.note}` : ''}
                              </td>
                              <td className="px-2 py-2 text-xs text-muted">
                                {new Date(file.createdAt).toLocaleString()}
                              </td>
                              <td className="px-2 py-2 text-right">
                                <FileActions
                                  file={file}
                                  downloadingId={downloadingId}
                                  restoringId={restoringId}
                                  onDownload={(f) => void handleDownload(f)}
                                  onRestore={(f) => void handleRestore(f)}
                                />
                              </td>
                            </tr>
                          ))
                        : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
