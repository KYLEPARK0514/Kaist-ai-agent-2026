"""POST /api/conversations/{id}/messages — Send a user message and receive an AI response.

Processing pipeline
-------------------
1.  Validate request body → SendMessageRequest
2.  Verify conversation exists → 404 if missing
3.  Persist user MessageRecord → messages container
4.  Retrieve last CHAT_HISTORY_WINDOW messages for context
5.  Run hybrid_search(user.content, top_k=SEARCH_TOP_K)
6.  Call chat_service.generate_response(query, chunks, history)
7.  Build assistant MessageRecord with sources from chunk results
8.  Persist assistant MessageRecord → messages container
9.  Increment conversation.messageCount + updatedAt
10. Return SendMessageResponse (user + assistant messages)
"""
from __future__ import annotations

import json
import logging
import os

import azure.functions as func
from pydantic import ValidationError

from models.conversation import (
    MessageItem,
    MessageRecord,
    MessageSource,
    SendMessageRequest,
    SendMessageResponse,
)
from services import chat_service, conversation_service, search_service

logger = logging.getLogger(__name__)

bp = func.Blueprint()


@bp.route(route="conversations/{id}/messages", methods=["POST"])
def send_message(req: func.HttpRequest) -> func.HttpResponse:
    """POST /api/conversations/{id}/messages

    Request body
    ------------
    { "content": "string" }

    Returns
    -------
    200  SendMessageResponse JSON (user + assistant messages)
    400  If content is empty or missing
    404  If conversation does not exist
    502  If the Gemini API is unavailable
    500  On any other error
    """
    conversation_id: str = req.route_params.get("id", "").strip()

    if not conversation_id:
        return func.HttpResponse(
            json.dumps({"error": "Conversation id is required."}),
            status_code=400,
            mimetype="application/json",
        )

    # ── 1. Validate request body ─────────────────────────────────────────
    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Request body must be valid JSON."}),
            status_code=400,
            mimetype="application/json",
        )

    try:
        payload = SendMessageRequest.model_validate(body)
    except ValidationError as exc:
        return func.HttpResponse(
            json.dumps({"error": "Validation failed.", "details": exc.errors()}),
            status_code=400,
            mimetype="application/json",
        )

    # ── 2. Verify conversation exists ────────────────────────────────────
    conversation = conversation_service.get_conversation(conversation_id)
    if conversation is None:
        return func.HttpResponse(
            json.dumps({"error": f"Conversation '{conversation_id}' not found."}),
            status_code=404,
            mimetype="application/json",
        )

    # ── 3. Persist user message ──────────────────────────────────────────
    user_record = MessageRecord(
        conversationId=conversation_id,
        role="user",
        content=payload.content,
        sources=[],
    )
    conversation_service.add_message(user_record)
    conversation_service.increment_message_count(conversation_id)

    # ── 4. Retrieve recent message history for context ───────────────────
    history_window = int(os.environ.get("CHAT_HISTORY_WINDOW", "20"))
    # Fetch the most recent N messages (includes the user message just saved)
    all_messages = conversation_service.get_messages(conversation_id)
    history = all_messages[-history_window:] if len(all_messages) > history_window else all_messages

    # ── 5. Hybrid search ─────────────────────────────────────────────────
    top_k = int(os.environ.get("SEARCH_TOP_K", "8"))
    try:
        chunks = search_service.hybrid_search(payload.content, top_k=top_k)
    except Exception as exc:
        logger.exception("Hybrid search failed")
        # Non-fatal: proceed with empty context rather than failing the request
        chunks = []

    # ── 6. Generate Gemini response ──────────────────────────────────────
    try:
        assistant_text = chat_service.generate_response(
            user_query=payload.content,
            search_results=chunks,
            history=history,
        )
    except Exception as exc:
        logger.exception("Gemini generation failed")
        return func.HttpResponse(
            json.dumps({"error": "AI response generation failed.", "detail": str(exc)}),
            status_code=502,
            mimetype="application/json",
        )

    # ── 7. Build assistant message with sources ──────────────────────────
    sources = [
        MessageSource(
            documentId=chunk.document_id,
            filename=chunk.filename,
            chunkIndex=chunk.chunk_index,
        )
        for chunk in chunks
    ]
    assistant_record = MessageRecord(
        conversationId=conversation_id,
        role="assistant",
        content=assistant_text,
        sources=sources,
    )

    # ── 8. Persist assistant message ─────────────────────────────────────
    conversation_service.add_message(assistant_record)
    conversation_service.increment_message_count(conversation_id)

    # ── 10. Return response ───────────────────────────────────────────────
    response = SendMessageResponse(
        userMessage=MessageItem.from_record(user_record),
        assistantMessage=MessageItem.from_record(assistant_record),
    )
    return func.HttpResponse(
        response.model_dump_json(by_alias=True),
        status_code=200,
        mimetype="application/json",
    )
