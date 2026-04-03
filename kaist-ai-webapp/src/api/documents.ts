/**
 * Typed fetch client for the document management and chat API.
 * All endpoints are proxied through Vite dev server to Azure Functions.
 */

import type {
  ChatResponse,
  DocumentListResponse,
  DocumentMetadata,
  UpdateDocumentRequest,
  UploadDocumentResponse,
} from '../types/document';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

// ── Document endpoints ────────────────────────────────────────────────────

export async function listDocuments(): Promise<DocumentListResponse> {
  const res = await fetch(`${BASE}/api/documents`);
  if (!res.ok) {
    throw new Error(`Failed to list documents: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<DocumentListResponse>;
}

export async function getDocument(id: string): Promise<DocumentMetadata> {
  const res = await fetch(`${BASE}/api/documents/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error(`Failed to get document: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<DocumentMetadata>;
}

/**
 * Upload a PDF file with progress tracking.
 * @param file - The PDF File object to upload.
 * @param onProgress - Callback receiving upload progress (0–100).
 */
export function uploadDocument(
  file: File,
  onProgress: (percent: number) => void,
): Promise<UploadDocumentResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadDocumentResponse);
        } catch {
          reject(new Error('Invalid JSON in upload response'));
        }
      } else {
        let message = `Upload failed: ${xhr.status}`;
        try {
          const body = JSON.parse(xhr.responseText) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          // ignore parse error
        }
        reject(new Error(message));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.open('POST', `${BASE}/api/documents`);
    xhr.send(formData);
  });
}

export async function updateDocument(
  id: string,
  body: UpdateDocumentRequest,
): Promise<DocumentMetadata> {
  const res = await fetch(`${BASE}/api/documents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Failed to update document: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<DocumentMetadata>;
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/documents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to delete document: ${res.status} ${res.statusText}`);
  }
}

// ── Chat endpoint ─────────────────────────────────────────────────────────

export async function chat(question: string): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    throw new Error(`Chat request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<ChatResponse>;
}
