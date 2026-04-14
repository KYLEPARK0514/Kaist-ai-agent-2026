"""Pydantic v2 request/response models for document management."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DocumentMetadataResponse(BaseModel):
    """Response model for a single document's metadata."""

    id: str = Field(..., description="Unique document identifier (same as documentId)")
    documentId: str = Field(..., description="Document partition key")
    filename: str = Field(..., description="Original uploaded filename")
    blobName: str = Field(..., description="Blob storage object name")
    chunkCount: int = Field(..., description="Number of text chunks stored")
    uploadedAt: str = Field(..., description="ISO 8601 upload timestamp")
    status: str = Field(default="queued", description="Processing status")
    labels: list[str] = Field(default_factory=list, description="Document labels")
    hashtags: list[str] = Field(default_factory=list, description="Document hashtags")
    categories: list[str] = Field(default_factory=list, description="Document categories")

    model_config = {"populate_by_name": True}


class DocumentListResponse(BaseModel):
    """Response model for the document list endpoint."""

    documents: list[DocumentMetadataResponse] = Field(
        default_factory=list, description="List of document metadata items"
    )
    count: int = Field(..., description="Total number of documents")


class UploadDocumentResponse(BaseModel):
    """Response model for a successful PDF upload."""

    documentId: str = Field(..., description="Newly created document identifier")
    filename: str = Field(..., description="Original uploaded filename")
    chunkCount: int = Field(..., description="Number of text chunks generated and embedded")
    uploadedAt: str = Field(..., description="ISO 8601 upload timestamp")
    status: str = Field(default="queued", description="Initial processing status")


class ExtractedDocumentInfo(BaseModel):
    """Structured information extracted from a PDF by LLM."""

    title: str = Field(default="", description="Inferred document title")
    summary: str = Field(default="", description="Short summary of the document")
    key_points: list[str] = Field(
        default_factory=list, description="Core points extracted from document"
    )
    labels: list[str] = Field(default_factory=list, description="General labels")
    hashtags: list[str] = Field(default_factory=list, description="Hashtag style tags")
    categories: list[str] = Field(default_factory=list, description="Classification values")


class QueueProcessPdfMessage(BaseModel):
    """Queue payload for asynchronous PDF processing pipeline."""

    documentId: str
    blobName: str
    filename: str
    uploadedAt: str


class UpdateDocumentRequest(BaseModel):
    """Request body for renaming a document."""

    filename: str = Field(..., min_length=1, description="New filename for the document")
