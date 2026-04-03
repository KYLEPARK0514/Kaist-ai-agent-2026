"""GET /api/documents — Return a list of all uploaded document metadata."""
from __future__ import annotations

import json
import logging

import azure.functions as func

from models.document import DocumentListResponse, DocumentMetadataResponse
from services import cosmos_service

logger = logging.getLogger(__name__)

bp = func.Blueprint()


@bp.route(route="documents", methods=["GET"])
def list_documents(req: func.HttpRequest) -> func.HttpResponse:
    """Return all document metadata items stored in CosmosDB.

    Returns
    -------
    200  DocumentListResponse JSON containing all documents.
    500  On any CosmosDB service error.
    """
    try:
        raw_items = cosmos_service.list_documents()
    except Exception as exc:
        logger.exception("Failed to list documents: %s", exc)
        return func.HttpResponse(
            json.dumps({"error": "Internal server error. Please try again later."}),
            status_code=500,
            mimetype="application/json",
        )

    documents = [
        DocumentMetadataResponse(
            id=item["id"],
            documentId=item["documentId"],
            filename=item["filename"],
            blobName=item["blobName"],
            chunkCount=item["chunkCount"],
            uploadedAt=item["uploadedAt"],
        )
        for item in raw_items
    ]

    response = DocumentListResponse(documents=documents, count=len(documents))
    return func.HttpResponse(
        response.model_dump_json(),
        status_code=200,
        mimetype="application/json",
    )
