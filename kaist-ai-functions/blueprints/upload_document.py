"""POST /api/documents — Upload a PDF, extract text, embed chunks, and persist."""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

import azure.functions as func
from pypdf.errors import PdfStreamError

from models.document import UploadDocumentResponse
from services import blob_service, cosmos_service, pdf_service

logger = logging.getLogger(__name__)

bp = func.Blueprint()


@bp.route(route="documents", methods=["POST"])
def upload_document(req: func.HttpRequest) -> func.HttpResponse:
    """Upload a PDF file, extract text content, generate embeddings, and store.

    Multipart form-data fields
    --------------------------
    file : bytes  — PDF binary (required)

    Returns
    -------
    201  UploadDocumentResponse JSON on success.
    400  If no file part or the file is not a PDF.
    500  On any Azure / Gemini service error.
    """
    # ------------------------------------------------------------------
    # 1. Parse uploaded file
    # ------------------------------------------------------------------
    file_data: bytes | None = None
    original_filename = "document.pdf"

    # Try multipart form-data first
    files = req.files
    if "file" in files:
        uploaded = files["file"]
        file_data = uploaded.read()
        original_filename = uploaded.filename or original_filename
    else:
        # Fall back to raw body (content-type: application/pdf)
        body = req.get_body()
        if body:
            file_data = body
            # Try to extract filename from Content-Disposition header
            content_disposition = req.headers.get("Content-Disposition", "")
            if "filename=" in content_disposition:
                for part in content_disposition.split(";"):
                    part = part.strip()
                    if part.startswith("filename="):
                        original_filename = part[len("filename="):].strip('"').strip("'")

    if not file_data:
        return func.HttpResponse(
            json.dumps({"error": "A PDF file is required. Send as multipart/form-data field 'file'."}),
            status_code=400,
            mimetype="application/json",
        )

    # Reject clearly non-PDF files by magic bytes
    if not file_data.startswith(b"%PDF"):
        return func.HttpResponse(
            json.dumps({"error": "Uploaded file does not appear to be a valid PDF."}),
            status_code=400,
            mimetype="application/json",
        )

    # ------------------------------------------------------------------
    # 2. Generate identifiers
    # ------------------------------------------------------------------
    document_id = str(uuid.uuid4())
    blob_name = f"{document_id}/{original_filename}"
    uploaded_at = datetime.now(timezone.utc).isoformat()

    try:
        # --------------------------------------------------------------
        # 3. Upload blob
        # --------------------------------------------------------------
        blob_service.upload_blob(blob_name, file_data, content_type="application/pdf")
        logger.info("Uploaded blob: %s", blob_name)

        # --------------------------------------------------------------
        # 4. Extract text & chunk
        # --------------------------------------------------------------
        raw_text = pdf_service.extract_text(file_data)
        chunks = pdf_service.chunk_text(raw_text)
        logger.info("Extracted %d chunks from %s", len(chunks), original_filename)

        # --------------------------------------------------------------
        # 5. Generate embeddings
        # --------------------------------------------------------------
        embeddings = pdf_service.embed_texts(chunks)
        logger.info("Generated %d embeddings", len(embeddings))

        # --------------------------------------------------------------
        # 6. Persist metadata item
        # --------------------------------------------------------------
        metadata_item: dict = {
            "id": document_id,
            "documentId": document_id,
            "type": "metadata",
            "filename": original_filename,
            "blobName": blob_name,
            "chunkCount": len(chunks),
            "uploadedAt": uploaded_at,
        }
        cosmos_service.create_metadata_item(metadata_item)

        # --------------------------------------------------------------
        # 7. Persist chunk items
        # --------------------------------------------------------------
        for idx, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
            chunk_item: dict = {
                "id": str(uuid.uuid4()),
                "documentId": document_id,
                "type": "chunk",
                "content": chunk_text,
                "chunkIndex": idx,
                "embedding": embedding,
            }
            cosmos_service.create_chunk_item(chunk_item)

        logger.info("Persisted metadata + %d chunks for document %s", len(chunks), document_id)

    except (ValueError, PdfStreamError) as exc:
        logger.warning("PDF processing error: %s", exc)
        # Clean up blob if already uploaded
        try:
            blob_service.delete_blob(blob_name)
        except Exception:
            pass
        return func.HttpResponse(
            json.dumps({"error": f"Could not process PDF: {exc}"}),
            status_code=400,
            mimetype="application/json",
        )
    except Exception as exc:
        logger.exception("Unexpected error during document upload: %s", exc)
        # Best-effort cleanup
        try:
            blob_service.delete_blob(blob_name)
        except Exception:
            pass
        return func.HttpResponse(
            json.dumps({"error": "Internal server error. Please try again later."}),
            status_code=500,
            mimetype="application/json",
        )

    # ------------------------------------------------------------------
    # 8. Return 201 Created
    # ------------------------------------------------------------------
    response = UploadDocumentResponse(
        documentId=document_id,
        filename=original_filename,
        chunkCount=len(chunks),
        uploadedAt=uploaded_at,
    )
    return func.HttpResponse(
        response.model_dump_json(),
        status_code=201,
        mimetype="application/json",
    )
