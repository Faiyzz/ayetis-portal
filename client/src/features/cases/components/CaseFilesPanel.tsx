import {
  ALL_FILE_CATEGORIES,
  FILE_CATEGORIES,
  FILE_CATEGORY_LABELS,
  type CaseFileDto,
  type FileCategory,
} from '@ayetis/shared';
import { Fragment, useMemo, useRef, useState, type FormEvent } from 'react';
import { AuthButton } from '@/features/auth/components/AuthUI';
import { downloadAllCaseFiles, downloadCaseFile, uploadCaseFiles } from '@/features/cases/api';
import { EmptyState } from '@/features/cases/components/detail/EmptyState';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

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
  const label = (FILE_CATEGORY_LABELS[category] ?? category).slice(0, 3).toUpperCase();
  return label;
}

export function CaseFilesPanel({
  caseId,
  files,
  canUpload,
  onUpdated,
}: {
  caseId: string;
  files: CaseFileDto[];
  canUpload: boolean;
  onUpdated: (filesCase: Awaited<ReturnType<typeof uploadCaseFiles>>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<FileCategory | ''>('');
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<FileCategory | ''>('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showUpload, setShowUpload] = useState(false);

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
      toast().success(selected.length === 1 ? 'File uploaded' : `${selected.length} files uploaded`);
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
      toast().error(getErrorMessage(err, 'Unable to download file'));
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDownloadAll() {
    setDownloadingAll(true);
    try {
      await downloadAllCaseFiles(caseId);
      toast().success('Download started');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to download all files'));
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
            STL, scans, images, PDF, and delivery assets. Same name creates a new version.
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
          className="min-w-[10rem] flex-1 rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
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
        <form
          onSubmit={handleUpload}
          className="space-y-3 border-b border-line bg-surface/30 px-4 py-4"
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".stl,.obj,.ply,.dcm,.dicom,image/*,.pdf,.zip,video/*,.mp4,.mov,.webm,.html,.htm"
            onChange={(e) => onPick(e.target.files)}
            className="block w-full text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Category (optional)</span>
              <select
                value={category}
                onChange={(e) => setCategory((e.target.value || '') as FileCategory | '')}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              >
                <option value="">Auto-detect</option>
                {ALL_FILE_CATEGORIES.filter((c) => c !== FILE_CATEGORIES.OTHER).map((value) => (
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
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-6 4h4M7 3h8l4 4v12a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
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
                  <p className="mt-2 truncate text-sm font-semibold text-ink" title={group.name}>
                    {group.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {FILE_CATEGORY_LABELS[latest.category]} · {formatBytes(latest.sizeBytes)} · v
                    {latest.version}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {latest.uploadedByName} · {new Date(latest.createdAt).toLocaleDateString()}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleDownload(latest)}
                    disabled={downloadingId === latest.id}
                    className="mt-3 w-full rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-brand-700 hover:border-brand-300 disabled:opacity-60"
                  >
                    {downloadingId === latest.id ? 'Downloading…' : 'Download'}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-[0.05em] text-muted">
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
                          <p className="font-medium text-ink">{group.name}</p>
                          {latest.note ? (
                            <p className="text-xs text-muted">{latest.note}</p>
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
                            <button
                              type="button"
                              onClick={() => void handleDownload(latest)}
                              disabled={downloadingId === latest.id}
                              className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-brand-700 disabled:opacity-60"
                            >
                              {downloadingId === latest.id ? '…' : 'Download'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {hasHistory && open
                        ? group.versions.map((file) => (
                            <tr key={file.id} className="border-b border-line bg-surface/40">
                              <td className="px-2 py-2 pl-6 text-xs text-muted" colSpan={4}>
                                v{file.version} · {formatBytes(file.sizeBytes)} ·{' '}
                                {file.uploadedByName}
                                {file.note ? ` · ${file.note}` : ''}
                              </td>
                              <td className="px-2 py-2 text-xs text-muted">
                                {new Date(file.createdAt).toLocaleString()}
                              </td>
                              <td className="px-2 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => void handleDownload(file)}
                                  disabled={downloadingId === file.id}
                                  className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-brand-700 disabled:opacity-60"
                                >
                                  Download
                                </button>
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
