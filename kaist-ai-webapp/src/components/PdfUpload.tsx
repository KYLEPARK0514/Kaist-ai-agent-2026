import { useCallback, useRef, useState } from 'react';
import { uploadDocument } from '../api/documents';
import type { UploadDocumentResponse } from '../types/document';

interface PdfUploadProps {
  onUploaded: (doc: UploadDocumentResponse) => void;
}

export default function PdfUpload({ onUploaded }: PdfUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setError('Only PDF files are supported.');
        return;
      }
      setError(null);
      setProgress(0);
      try {
        const result = await uploadDocument(file, setProgress);
        setProgress(null);
        onUploaded(result);
      } catch (err) {
        setProgress(null);
        setError(err instanceof Error ? err.message : 'Upload failed.');
      }
    },
    [onUploaded],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    // Reset input so the same file can be re-uploaded if needed
    e.target.value = '';
  };

  const isUploading = progress !== null;

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop zone for PDF upload"
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 transition-colors cursor-pointer select-none
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
          ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isUploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
            inputRef.current?.click();
          }
        }}
      >
        <svg
          className="mb-2 h-8 w-8 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 16v-8m0 0-3 3m3-3 3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1"
          />
        </svg>
        <p className="text-sm text-gray-600">
          {isUploading ? 'Uploading…' : 'Drop a PDF here or click to browse'}
        </p>
        {!isUploading && (
          <p className="mt-1 text-xs text-gray-400">PDF files only</p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleInputChange}
        aria-hidden="true"
      />

      {/* Progress bar */}
      {isUploading && (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all duration-200"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <p className="text-right text-xs text-gray-500">{progress}%</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
