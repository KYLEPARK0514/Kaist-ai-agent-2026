import { useCallback, useEffect, useState } from 'react';
import { listDocuments } from '../api/documents';
import type { DocumentMetadata, UploadDocumentResponse } from '../types/document';
import DocumentListItem from './DocumentListItem';
import PdfUpload from './PdfUpload';

export default function DocumentManager() {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await listDocuments();
      setDocuments(data.documents);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleUploaded = (uploaded: UploadDocumentResponse) => {
    // Optimistically prepend – full metadata not available until next list,
    // so append a synthetic entry and sort by uploadedAt DESC.
    const synthetic: DocumentMetadata = {
      id: uploaded.documentId,
      documentId: uploaded.documentId,
      filename: uploaded.filename,
      blobName: uploaded.filename,
      chunkCount: uploaded.chunkCount,
      uploadedAt: uploaded.uploadedAt,
    };
    setDocuments((prev) =>
      [synthetic, ...prev].sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
      ),
    );
  };

  const handleRenamed = (updated: DocumentMetadata) => {
    setDocuments((prev) =>
      prev.map((d) => (d.documentId === updated.documentId ? updated : d)),
    );
  };

  const handleDeleted = (documentId: string) => {
    setDocuments((prev) => prev.filter((d) => d.documentId !== documentId));
  };

  return (
    <section className="flex h-full flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
        <button
          onClick={() => void loadDocuments()}
          disabled={loading}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
          aria-label="Refresh document list"
          title="Refresh"
        >
          <svg
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Upload zone */}
      <PdfUpload onUploaded={handleUploaded} />

      {/* Document list */}
      <div className="flex-1 overflow-y-auto">
        {loading && documents.length === 0 ? (
          <div className="flex h-24 items-center justify-center">
            <svg
              className="h-6 w-6 animate-spin text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              aria-label="Loading"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          </div>
        ) : fetchError ? (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            <p className="font-medium">Failed to load documents</p>
            <p className="mt-0.5">{fetchError}</p>
            <button
              onClick={() => void loadDocuments()}
              className="mt-2 text-red-600 underline hover:text-red-800"
            >
              Retry
            </button>
          </div>
        ) : documents.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            No documents yet. Upload a PDF above to get started.
          </p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <DocumentListItem
                key={doc.documentId}
                document={doc}
                onRenamed={handleRenamed}
                onDeleted={handleDeleted}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer count */}
      {documents.length > 0 && (
        <p className="text-xs text-gray-400">
          {documents.length} document{documents.length !== 1 ? 's' : ''}
        </p>
      )}
    </section>
  );
}
