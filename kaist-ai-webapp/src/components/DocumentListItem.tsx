import { useState } from "react";
import type { Document } from "../types/document";

interface Props {
  document: Document;
  onDelete: (id: string) => void;
  onRename: (id: string, newFilename: string) => void;
}

const STATUS_STYLES: Record<Document["status"], string> = {
  processing: "bg-yellow-100 text-yellow-700",
  processed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export function DocumentListItem({ document, onDelete, onRename }: Props) {
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(document.filename);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleRenameSubmit = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== document.filename) {
      onRename(document.id, trimmed);
    }
    setRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleRenameSubmit();
    if (e.key === "Escape") {
      setNameInput(document.filename);
      setRenaming(false);
    }
  };

  const uploadDate = new Date(document.uploadedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <li className="flex flex-col gap-1 p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
      {/* Top row: filename / rename input + status badge */}
      <div className="flex items-center gap-2 min-w-0">
        {renaming ? (
          <input
            autoFocus
            className="flex-1 min-w-0 px-2 py-0.5 text-sm border border-indigo-400 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleRenameKeyDown}
          />
        ) : (
          <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">
            {document.filename}
          </span>
        )}

        <span
          className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[document.status]}`}
        >
          {document.status}
        </span>
      </div>

      {/* Bottom row: meta + actions */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400">
          {uploadDate} &middot; {document.chunkCount} chunk{document.chunkCount !== 1 ? "s" : ""}
        </span>

        <div className="flex items-center gap-1">
          {/* Rename button */}
          <button
            title="Rename"
            onClick={() => {
              setNameInput(document.filename);
              setRenaming(true);
            }}
            className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            {/* Pencil icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>

          {/* Delete button — with inline confirmation */}
          {confirmDelete ? (
            <span className="flex items-center gap-1">
              <button
                onClick={() => onDelete(document.id)}
                className="px-2 py-0.5 text-xs text-white bg-red-500 rounded hover:bg-red-600 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-0.5 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              title="Delete"
              onClick={() => setConfirmDelete(true)}
              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              {/* Trash icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
