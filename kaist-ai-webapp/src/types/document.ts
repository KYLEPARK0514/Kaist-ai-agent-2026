/**
 * TypeScript type definitions for document management API responses.
 * Mirrors the Pydantic models in kaist-ai-functions/models/document.py.
 */

export interface DocumentMetadata {
  id: string;
  documentId: string;
  filename: string;
  blobName: string;
  chunkCount: number;
  uploadedAt: string;
}

export interface DocumentListResponse {
  documents: DocumentMetadata[];
  count: number;
}

export interface UploadDocumentResponse {
  documentId: string;
  filename: string;
  chunkCount: number;
  uploadedAt: string;
}

export interface UpdateDocumentRequest {
  filename: string;
}

export interface ChatRequest {
  question: string;
}

export interface ChatResponse {
  answer: string;
}
