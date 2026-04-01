import { useRef, useState } from "react";
import { uploadDocument } from "../api/documents";

interface Props {
  onUploaded?: () => void;
}

export function PdfUpload({ onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side MIME validation
    if (file.type !== "application/pdf") {
      setError("Only PDF files are accepted.");
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      await uploadDocument(file, (pct) => setProgress(pct));
      onUploaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
      // Reset input so the same file can be re-uploaded if needed
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">1. Upload PDF</h2>

      {error && (
        <div className="mb-3 px-3 py-2 rounded bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-center w-full">
        <label
          className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            uploading
              ? "border-indigo-300 bg-indigo-50 cursor-not-allowed"
              : "border-indigo-200 bg-indigo-50 hover:bg-indigo-100"
          }`}
        >
          <div className="flex flex-col items-center justify-center pt-4 pb-4">
            {uploading ? (
              <>
                <svg className="animate-spin w-8 h-8 mb-2 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <p className="text-sm text-indigo-700 font-medium">Uploading… {progress}%</p>
              </>
            ) : (
              <>
                <svg
                  className="w-8 h-8 mb-3 text-indigo-500"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 20 16"
                >
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                  />
                </svg>
                <p className="mb-1 text-sm text-indigo-700 font-medium">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-indigo-500">PDF documents only</p>
              </>
            )}
          </div>
          <input
            ref={inputRef}
            id="pdf-upload-input"
            type="file"
            className="hidden"
            accept="application/pdf"
            disabled={uploading}
            onChange={handleUpload}
          />
        </label>
      </div>

      {/* Progress bar */}
      {uploading && (
        <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-indigo-500 h-1.5 rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
