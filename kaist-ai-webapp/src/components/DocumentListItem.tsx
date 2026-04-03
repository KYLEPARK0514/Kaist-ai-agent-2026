import { useRef, useState } from 'react';
import { deleteDocument, updateDocument } from '../api/documents';
import type { DocumentMetadata } from '../types/document';

interface DocumentListItemProps {
  document: DocumentMetadata;
  onRenamed: (updated: DocumentMetadata) => void;
  onDeleted: (documentId: string) => void;
}

export default function DocumentListItem({
  document,
  onRenamed,
  onDeleted,
}: DocumentListItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(document.filename);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Rename ───────────────────────────────────────────────────────────────

  const startRename = () => {
    setRenameValue(document.filename);
    setRenameError(null);
    setIsRenaming(true);
    // Focus after render
    requestAnimationFrame(() => inputRef.current?.select());
  };

  const cancelRename = () => {
    setIsRenaming(false);
    setRenameError(null);
  };

  const submitRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError('Filename cannot be empty.');
      return;
    }
    if (trimmed === document.filename) {
      setIsRenaming(false);
      return;
    }
    setIsSaving(true);
    setRenameError(null);
    try {
      const updated = await updateDocument(document.documentId, { filename: trimmed });
      setIsRenaming(false);
      onRenamed(updated);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Rename failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void submitRename();
    if (e.key === 'Escape') cancelRename();
  };

  // ── Delete ───────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteDocument(document.documentId);
      onDeleted(document.documentId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <li className="group flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 shadow-sm ring-1 ring-gray-100 transition hover:ring-gray-200">
      {/* PDF icon */}
      <svg
        className="h-5 w-5 flex-shrink-0 text-red-400"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
          clipRule="evenodd"
        />
      </svg>

      {/* Filename / rename input */}
      <div className="min-w-0 flex-1">
        {isRenaming ? (
          <div className="flex flex-col gap-1">
            <input
              ref={inputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              className="w-full rounded border border-blue-400 px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50"
              aria-label="New filename"
            />
            {renameError && (
              <p className="text-xs text-red-600">{renameError}</p>
            )}
          </div>
        ) : (
          <span className="block truncate text-sm font-medium text-gray-800">
            {document.filename}
          </span>
        )}
        <span className="block text-xs text-gray-400">
          {document.chunkCount} chunk{document.chunkCount !== 1 ? 's' : ''} ·{' '}
          {new Date(document.uploadedAt).toLocaleDateString()}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex flex-shrink-0 items-center gap-1">
        {isRenaming ? (
          <>
            <button
              onClick={() => void submitRename()}
              disabled={isSaving}
              className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
              aria-label="Save rename"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={cancelRename}
              disabled={isSaving}
              className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              aria-label="Cancel rename"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={startRename}
              className="rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100 focus:opacity-100"
              aria-label={`Rename ${document.filename}`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              className="rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
              aria-label={`Delete ${document.filename}`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 id="delete-dialog-title" className="text-base font-semibold text-gray-900">
              Delete document?
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              "<span className="font-medium">{document.filename}</span>" and all its chunks will be
              permanently deleted.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDelete()}
                disabled={isDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
