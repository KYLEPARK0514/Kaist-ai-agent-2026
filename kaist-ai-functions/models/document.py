from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class DocumentStatus(str, Enum):
    processing = "processing"
    processed = "processed"
    failed = "failed"


class DocumentRecord(BaseModel):
    id: str
    documentId: str
    type: str = "document"
    filename: str
    blobName: str
    fileSize: int
    status: DocumentStatus
    chunkCount: int = 0
    uploadedAt: str
    updatedAt: str


class ChunkRecord(BaseModel):
    id: str
    documentId: str
    type: str = "chunk"
    chunkIndex: int
    content: str
    embedding: list[float]


class UploadDocumentResponse(BaseModel):
    id: str
    filename: str
    status: DocumentStatus
    message: str


class DocumentResponse(BaseModel):
    id: str
    filename: str
    fileSize: int
    status: DocumentStatus
    chunkCount: int
    uploadedAt: str
    updatedAt: str


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int


class GetDocumentResponse(DocumentResponse):
    blobName: str


class UpdateDocumentRequest(BaseModel):
    filename: str
