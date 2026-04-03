"""GET /api/conversations — List all conversations ordered by updatedAt DESC."""
from __future__ import annotations

import json
import logging

import azure.functions as func

from models.conversation import ConversationListResponse, ConversationSummary
from services import conversation_service

logger = logging.getLogger(__name__)

bp = func.Blueprint()


@bp.route(route="conversations", methods=["GET"])
def list_conversations(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/conversations

    Returns
    -------
    200  ConversationListResponse JSON
    500  On any service error
    """
    try:
        records = conversation_service.list_conversations()
        summaries = [ConversationSummary.from_record(r) for r in records]
        response = ConversationListResponse(
            conversations=summaries,
            total=len(summaries),
        )
        return func.HttpResponse(
            response.model_dump_json(by_alias=True),
            status_code=200,
            mimetype="application/json",
        )
    except Exception as exc:
        logger.exception("list_conversations failed")
        return func.HttpResponse(
            json.dumps({"error": str(exc)}),
            status_code=500,
            mimetype="application/json",
        )
