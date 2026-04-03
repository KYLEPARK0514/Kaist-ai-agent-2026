"""DELETE /api/conversations/{id} — Delete a conversation and all its messages."""
from __future__ import annotations

import json
import logging

import azure.functions as func
from azure.cosmos import exceptions as cosmos_exceptions

from services import conversation_service

logger = logging.getLogger(__name__)

bp = func.Blueprint()


@bp.route(route="conversations/{id}", methods=["DELETE"])
def delete_conversation(req: func.HttpRequest) -> func.HttpResponse:
    """DELETE /api/conversations/{id}

    Returns
    -------
    204  No Content on success
    404  If conversation does not exist
    500  On any service error
    """
    conversation_id: str = req.route_params.get("id", "").strip()

    if not conversation_id:
        return func.HttpResponse(
            json.dumps({"error": "Conversation id is required."}),
            status_code=400,
            mimetype="application/json",
        )

    # Verify existence before deletion
    record = conversation_service.get_conversation(conversation_id)
    if record is None:
        return func.HttpResponse(
            json.dumps({"error": f"Conversation '{conversation_id}' not found."}),
            status_code=404,
            mimetype="application/json",
        )

    try:
        conversation_service.delete_conversation(conversation_id)
        return func.HttpResponse(status_code=204)
    except cosmos_exceptions.CosmosResourceNotFoundError:
        return func.HttpResponse(
            json.dumps({"error": f"Conversation '{conversation_id}' not found."}),
            status_code=404,
            mimetype="application/json",
        )
    except Exception as exc:
        logger.exception("delete_conversation failed for id=%s", conversation_id)
        return func.HttpResponse(
            json.dumps({"error": str(exc)}),
            status_code=500,
            mimetype="application/json",
        )
