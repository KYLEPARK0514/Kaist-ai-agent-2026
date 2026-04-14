"""POST /api/documents — Upload a PDF and enqueue async processing."""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

import azure.functions as func

from models.document import QueueProcessPdfMessage, UploadDocumentResponse
from services import blob_service, cosmos_service, queue_service

logger = logging.getLogger(__name__)

bp = func.Blueprint()


@bp.route(route="documents", methods=["POST"])
def upload_document(req: func.HttpRequest) -> func.HttpResponse:
    """Upload a PDF file and enqueue background extraction/indexing.

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
        # 4. Persist metadata item (queued)
        # --------------------------------------------------------------
        metadata_item: dict = {
            "id": document_id,
            "documentId": document_id,
            "type": "metadata",
            "filename": original_filename,
            "blobName": blob_name,
            "chunkCount": 0,
            "uploadedAt": uploaded_at,
            "status": "queued",
            "labels": [],
            "hashtags": [],
            "categories": [],
        }
        cosmos_service.upsert_item(metadata_item)

        # --------------------------------------------------------------
        # 5. Enqueue async processing message
        # --------------------------------------------------------------
        queue_message = QueueProcessPdfMessage(
            documentId=document_id,
            blobName=blob_name,
            filename=original_filename,
            uploadedAt=uploaded_at,
        )
        queue_service.enqueue_pdf_processing_message(queue_message.model_dump())
        logger.info("Queued document %s for async processing", document_id)

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
    # 6. Return 201 Created
    # ------------------------------------------------------------------
    response = UploadDocumentResponse(
        documentId=document_id,
        filename=original_filename,
        chunkCount=0,
        uploadedAt=uploaded_at,
        status="queued",
    )
    return func.HttpResponse(
        response.model_dump_json(),
        status_code=201,
        mimetype="application/json",
    )
