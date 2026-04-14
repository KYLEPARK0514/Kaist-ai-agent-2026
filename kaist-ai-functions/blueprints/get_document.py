"""GET /api/documents/{id} — Return metadata for a single document."""
from __future__ import annotations

import json
import logging

import azure.functions as func

from models.document import DocumentMetadataResponse
from services import cosmos_service

logger = logging.getLogger(__name__)

bp = func.Blueprint()


@bp.route(route="documents/{id}", methods=["GET"])
def get_document(req: func.HttpRequest) -> func.HttpResponse:
    """Return the metadata item for the requested document.

    Path parameters
    ---------------
    id : str  — The documentId.

    Returns
    -------
    200  DocumentMetadataResponse JSON if found.
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

    try:
        item = cosmos_service.get_document(document_id)
    except Exception as exc:
        logger.exception("Failed to retrieve document %s: %s", document_id, exc)
        return func.HttpResponse(
            json.dumps({"error": "Internal server error. Please try again later."}),
            status_code=500,
            mimetype="application/json",
        )

    if item is None:
        return func.HttpResponse(
            json.dumps({"error": f"Document '{document_id}' not found."}),
            status_code=404,
            mimetype="application/json",
        )

    response = DocumentMetadataResponse(
        id=item["id"],
        documentId=item["documentId"],
        filename=item["filename"],
        blobName=item["blobName"],
        chunkCount=item["chunkCount"],
        uploadedAt=item["uploadedAt"],
        status=item.get("status", "processed"),
        labels=item.get("labels", []),
        hashtags=item.get("hashtags", []),
        categories=item.get("categories", []),
    )
    return func.HttpResponse(
        response.model_dump_json(),
        status_code=200,
        mimetype="application/json",
    )
