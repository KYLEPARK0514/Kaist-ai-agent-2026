export type DocumentStatus = "processing" | "processed" | "failed";

export interface Document {
  id: string;
  filename: string;
  fileSize: number;
  status: DocumentStatus;
  chunkCount: number;
  uploadedAt: string;
  updatedAt: string;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
}

export interface UploadDocumentResponse {
  id: string;
  filename: string;
  status: DocumentStatus;
  message: string;
}
