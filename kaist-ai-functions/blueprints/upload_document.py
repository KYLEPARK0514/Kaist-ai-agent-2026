from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import azure.functions as func

from models.document import (
    ChunkRecord,
    DocumentRecord,
    DocumentStatus,
    UploadDocumentResponse,
)
from services.blob_service import BlobStorageService
from services.cosmos_service import CosmosService
from services.pdf_service import PdfService

bp = func.Blueprint()

_MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


@bp.route(route="documents", methods=["POST"], auth_level=func.AuthLevel.FUNCTION)
def upload_document(req: func.HttpRequest) -> func.HttpResponse:
    # --- Validate multipart/form-data ---
    content_type = req.headers.get("Content-Type", "")
    if "multipart/form-data" not in content_type:
        return _error(400, "Request must be multipart/form-data")

    file = req.files.get("file")
    if file is None:
        return _error(400, "Missing 'file' field in form data")

    if file.mimetype != "application/pdf":
        return _error(400, "Uploaded file must be application/pdf")

    pdf_bytes = file.read()
    if len(pdf_bytes) > _MAX_FILE_SIZE:
        return _error(413, "File exceeds the 50 MB maximum")

    filename: str = file.filename or "document.pdf"
    document_id = f"doc_{uuid.uuid4().hex}"
    blob_name = f"{document_id}/{filename}"
    now = _utc_now()

    blob_svc = BlobStorageService()
    cosmos_svc = CosmosService()
    pdf_svc = PdfService()

    try:
        # 1. Upload to Blob Storage
        blob_svc.upload_blob(blob_name, pdf_bytes)

        # 2. Write initial DocumentRecord with status=processing
        doc_record = DocumentRecord(
            id=document_id,
            documentId=document_id,
            filename=filename,
            blobName=blob_name,
            fileSize=len(pdf_bytes),
            status=DocumentStatus.processing,
            chunkCount=0,
            uploadedAt=now,
            updatedAt=now,
        )
        cosmos_svc.upsert_item(doc_record.model_dump())

        # 3. Extract text → chunk → embed
        text = pdf_svc.extract_text(pdf_bytes)
        chunks = pdf_svc.chunk_text(text)
        embeddings = pdf_svc.embed_chunks(chunks)

        # 4. Write each ChunkRecord
        for i, (chunk_content, embedding) in enumerate(zip(chunks, embeddings)):
            chunk_record = ChunkRecord(
                id=f"{document_id}_chunk_{i}",
                documentId=document_id,
                chunkIndex=i,
                content=chunk_content,
                embedding=embedding,
            )
            cosmos_svc.upsert_item(chunk_record.model_dump())

        # 5. Update DocumentRecord to processed
        doc_record.status = DocumentStatus.processed
        doc_record.chunkCount = len(chunks)
        doc_record.updatedAt = _utc_now()
        cosmos_svc.upsert_item(doc_record.model_dump())

        response = UploadDocumentResponse(
            id=document_id,
            filename=filename,
            status=DocumentStatus.processed,
            message=f"PDF uploaded and processed successfully with {len(chunks)} chunks.",
        )
        return func.HttpResponse(
            response.model_dump_json(),
            status_code=201,
            mimetype="application/json",
        )

    except Exception as exc:  # noqa: BLE001
        # Mark document as failed so the record is not left in an ambiguous state
        try:
            failed_record = DocumentRecord(
                id=document_id,
                documentId=document_id,
                filename=filename,
                blobName=blob_name,
                fileSize=len(pdf_bytes),
                status=DocumentStatus.failed,
                chunkCount=0,
                uploadedAt=now,
                updatedAt=_utc_now(),
            )
            cosmos_svc.upsert_item(failed_record.model_dump())
        except Exception:
            pass
        return _error(500, f"Processing failed: {exc}")


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _error(status_code: int, message: str) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps({"error": message}),
        status_code=status_code,
        mimetype="application/json",
    )
