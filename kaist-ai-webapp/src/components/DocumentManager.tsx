import { useCallback, useEffect, useState } from "react";
import { deleteDocument, listDocuments, updateDocument } from "../api/documents";
import type { Document } from "../types/document";
import { DocumentListItem } from "./DocumentListItem";
import { PdfUpload } from "./PdfUpload";

export function DocumentManager() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listDocuments();
      setDocuments(res.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const handleDelete = async (id: string) => {
    try {
      await deleteDocument(id);
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleRename = async (id: string, newFilename: string) => {
    try {
      await updateDocument(id, newFilename);
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PdfUpload onUploaded={() => void fetchDocuments()} />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h2 className="text-xl font-semibold mb-3 text-gray-800">2. Documents</h2>

        {error && (
          <div className="mb-3 px-3 py-2 rounded bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
            <svg className="animate-spin w-5 h-5 mr-2 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading documents…
          </div>
        ) : documents.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-6">
            No documents yet. Upload a PDF above.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((doc) => (
              <DocumentListItem
                key={doc.id}
                document={doc}
                onDelete={(id) => void handleDelete(id)}
                onRename={(id, name) => void handleRename(id, name)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
