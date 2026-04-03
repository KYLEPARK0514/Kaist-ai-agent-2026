"""PATCH /api/documents/{id} — Update document metadata (rename)."""
from __future__ import annotations

import json
import logging

import azure.functions as func
from pydantic import ValidationError

from models.document import DocumentMetadataResponse, UpdateDocumentRequest
from services import cosmos_service
from azure.cosmos import exceptions as cosmos_exceptions

logger = logging.getLogger(__name__)

bp = func.Blueprint()


@bp.route(route="documents/{id}", methods=["PATCH"])
def update_document(req: func.HttpRequest) -> func.HttpResponse:
    """Update the filename of an existing document.

    Path parameters
    ---------------
    id : str  — The documentId.

    Request body (JSON)
    -------------------
    filename : str  — New filename (required, non-empty).

    Returns
    -------
    200  Updated DocumentMetadataResponse JSON.
    400  On missing/invalid request body.
    404  If no document with that id exists.
    500  On any CosmosDB service error.
    """
    document_id: str = req.route_params.get("id", "").strip()
    if not document_id:
        return func.HttpResponse(
            json.dumps({"error": "Document id is required."}),
            status_code=400,
            mimetype="application/json",
        )

    # ------------------------------------------------------------------
    # Parse + validate request body
    # ------------------------------------------------------------------
    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Request body must be valid JSON."}),
            status_code=400,
            mimetype="application/json",
        )

    try:
        update_req = UpdateDocumentRequest(**body)
    except ValidationError as exc:
        return func.HttpResponse(
            json.dumps({"error": "Validation error.", "details": exc.errors()}),
            status_code=400,
            mimetype="application/json",
        )

    # ------------------------------------------------------------------
    # Apply update
    # ------------------------------------------------------------------
    try:
        updated_item = cosmos_service.update_document(
            document_id, {"filename": update_req.filename}
        )
    except cosmos_exceptions.CosmosResourceNotFoundError:
        return func.HttpResponse(
            json.dumps({"error": f"Document '{document_id}' not found."}),
            status_code=404,
            mimetype="application/json",
        )
    except Exception as exc:
        logger.exception("Failed to update document %s: %s", document_id, exc)
        return func.HttpResponse(
            json.dumps({"error": "Internal server error. Please try again later."}),
            status_code=500,
            mimetype="application/json",
        )

    response = DocumentMetadataResponse(
        id=updated_item["id"],
        documentId=updated_item["documentId"],
        filename=updated_item["filename"],
        blobName=updated_item["blobName"],
        chunkCount=updated_item["chunkCount"],
        uploadedAt=updated_item["uploadedAt"],
    )
    return func.HttpResponse(
        response.model_dump_json(),
        status_code=200,
        mimetype="application/json",
    )
