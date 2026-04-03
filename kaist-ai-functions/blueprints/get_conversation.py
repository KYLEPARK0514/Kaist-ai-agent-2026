"""GET /api/conversations/{id} — Retrieve conversation details + message history."""
from __future__ import annotations

import json
import logging

import azure.functions as func

from models.conversation import (
    ConversationDetailResponse,
    ConversationSummary,
    MessageItem,
)
from services import conversation_service

logger = logging.getLogger(__name__)

bp = func.Blueprint()


@bp.route(route="conversations/{id}", methods=["GET"])
def get_conversation(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/conversations/{id}

    Returns
    -------
    200  ConversationDetailResponse JSON
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

    try:
        record = conversation_service.get_conversation(conversation_id)
        if record is None:
            return func.HttpResponse(
                json.dumps({"error": f"Conversation '{conversation_id}' not found."}),
                status_code=404,
                mimetype="application/json",
            )

        messages = conversation_service.get_messages(conversation_id)
        response = ConversationDetailResponse(
            conversation=ConversationSummary.from_record(record),
            messages=[MessageItem.from_record(m) for m in messages],
        )
        return func.HttpResponse(
            response.model_dump_json(by_alias=True),
            status_code=200,
            mimetype="application/json",
        )
    except Exception as exc:
        logger.exception("get_conversation failed for id=%s", conversation_id)
        return func.HttpResponse(
            json.dumps({"error": str(exc)}),
            status_code=500,
            mimetype="application/json",
        )
