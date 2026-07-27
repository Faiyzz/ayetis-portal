import {
  ALL_FILE_CATEGORIES,
  FILE_CATEGORIES,
  FILE_CATEGORY_LABELS,
  type CaseFileDto,
  type FileCategory,
} from '@ayetis/shared';
import { useRef, useState, type FormEvent } from 'react';
import { AuthButton } from '@/features/auth/components/AuthUI';
import { downloadAllCaseFiles, downloadCaseFile, uploadCaseFiles } from '@/features/cases/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    <section className="space-y-4 rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Patient files</h2>
          <p className="mt-1 text-sm text-muted">
            STL files, scans, photos, and x-rays for production.
          </p>
        </div>
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
      </div>

      {canUpload ? (
        <form onSubmit={handleUpload} className="space-y-3 rounded-lg border border-dashed border-line bg-surface/60 p-4">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".stl,.dcm,.dicom,image/*,.pdf,.zip,.ply,.obj"
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

      {files.length === 0 ? (
        <p className="text-sm text-muted">No files attached yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex flex-col gap-2 rounded-lg border border-line px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-ink">{file.originalName || file.filename}</p>
                <p className="text-xs text-muted">
                  {FILE_CATEGORY_LABELS[file.category] ?? file.category} ·{' '}
                  {formatBytes(file.sizeBytes)} · v{file.version} · {file.uploadedByName}
                </p>
                {file.note ? <p className="mt-0.5 text-xs text-muted">{file.note}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => void handleDownload(file)}
                disabled={downloadingId === file.id}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-brand-700 hover:border-brand-300 disabled:opacity-60"
              >
                {downloadingId === file.id ? 'Downloading…' : 'Download'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
