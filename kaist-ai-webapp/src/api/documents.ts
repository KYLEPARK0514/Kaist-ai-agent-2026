import type { Document, DocumentListResponse, UploadDocumentResponse } from "../types/document";

const BASE = "/api/documents";

export async function listDocuments(): Promise<DocumentListResponse> {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error(`listDocuments failed: ${res.status}`);
  return res.json() as Promise<DocumentListResponse>;
}

export async function getDocument(id: string): Promise<Document> {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error(`getDocument failed: ${res.status}`);
  return res.json() as Promise<Document>;
}

export async function updateDocument(id: string, filename: string): Promise<Document> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename }),
  });
  if (!res.ok) throw new Error(`updateDocument failed: ${res.status}`);
  return res.json() as Promise<Document>;
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`deleteDocument failed: ${res.status}`);
}

/**
 * uploadDocument uses XMLHttpRequest so callers can track progress.
 * Pass an onProgress callback receiving a 0-100 percentage.
 */
export function uploadDocument(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<UploadDocumentResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", BASE);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadDocumentResponse);
        } catch {
          reject(new Error("Invalid JSON response from upload"));
        }
      } else {
        reject(new Error(`uploadDocument failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}
