"""POST /api/conversations — Create a new empty conversation."""
from __future__ import annotations

import json
import logging

import azure.functions as func
from pydantic import ValidationError

from models.conversation import CreateConversationRequest, ConversationSummary
from services import conversation_service

logger = logging.getLogger(__name__)

bp = func.Blueprint()


@bp.route(route="conversations", methods=["POST"])
def create_conversation(req: func.HttpRequest) -> func.HttpResponse:
    """POST /api/conversations

    Request body
    ------------
    { "title": "string" }

    Returns
    -------
    201  ConversationSummary JSON on success
    400  If title is missing or invalid
    500  On any service error
    """
    # Parse and validate request body
    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Request body must be valid JSON."}),
            status_code=400,
            mimetype="application/json",
        )

    try:
        payload = CreateConversationRequest.model_validate(body)
    except ValidationError as exc:
        return func.HttpResponse(
            json.dumps({"error": "Validation failed.", "details": exc.errors()}),
            status_code=400,
            mimetype="application/json",
        )

    try:
        record = conversation_service.create_conversation(payload.title)
        summary = ConversationSummary.from_record(record)
        return func.HttpResponse(
            summary.model_dump_json(by_alias=True),
            status_code=201,
            mimetype="application/json",
        )
    except Exception as exc:
        logger.exception("create_conversation failed")
        return func.HttpResponse(
            json.dumps({"error": str(exc)}),
            status_code=500,
            mimetype="application/json",
        )
