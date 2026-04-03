"""DELETE /api/documents/{id} — Delete a document (blob + all CosmosDB items)."""
from __future__ import annotations

import json
import logging

import azure.functions as func

from services import blob_service, cosmos_service

logger = logging.getLogger(__name__)

bp = func.Blueprint()


@bp.route(route="documents/{id}", methods=["DELETE"])
def delete_document(req: func.HttpRequest) -> func.HttpResponse:
    """Delete a document's blob and all associated CosmosDB items.

    Path parameters
    ---------------
    id : str  — The documentId.

    Returns
    -------
    200  JSON confirmation with itemsDeleted count.
    404  If no document with that id exists in CosmosDB.
    500  On any service error.
    """
    document_id: str = req.route_params.get("id", "").strip()
    if not document_id:
        return func.HttpResponse(
            json.dumps({"error": "Document id is required."}),
            status_code=400,
            mimetype="application/json",
        )

    # ------------------------------------------------------------------
    # 1. Verify the document exists and retrieve blob name
    # ------------------------------------------------------------------
    try:
        metadata = cosmos_service.get_document(document_id)
    except Exception as exc:
        logger.exception("Failed to look up document %s: %s", document_id, exc)
        return func.HttpResponse(
            json.dumps({"error": "Internal server error. Please try again later."}),
            status_code=500,
            mimetype="application/json",
        )

    if metadata is None:
        return func.HttpResponse(
            json.dumps({"error": f"Document '{document_id}' not found."}),
            status_code=404,
            mimetype="application/json",
        )

    blob_name: str = metadata.get("blobName", "")

    # ------------------------------------------------------------------
    # 2. Delete all CosmosDB items (metadata + chunks)
    # ------------------------------------------------------------------
    try:
        items_deleted = cosmos_service.delete_document_items(document_id)
        logger.info("Deleted %d CosmosDB items for document %s", items_deleted, document_id)
    except Exception as exc:
        logger.exception("Failed to delete CosmosDB items for document %s: %s", document_id, exc)
        return func.HttpResponse(
            json.dumps({"error": "Internal server error. Please try again later."}),
            status_code=500,
            mimetype="application/json",
        )

    # ------------------------------------------------------------------
    # 3. Delete blob (best-effort; log but don't fail the request)
    # ------------------------------------------------------------------
    if blob_name:
        try:
            blob_service.delete_blob(blob_name)
            logger.info("Deleted blob: %s", blob_name)
        except Exception as exc:
            logger.warning("Could not delete blob %s: %s", blob_name, exc)

    return func.HttpResponse(
        json.dumps(
            {
                "documentId": document_id,
                "deleted": True,
                "itemsDeleted": items_deleted,
            }
        ),
        status_code=200,
        mimetype="application/json",
    )
