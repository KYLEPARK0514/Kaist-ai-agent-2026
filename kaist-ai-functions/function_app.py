"""Azure Functions entry point — registers all blueprints.

Endpoints
---------
GET    /api/health                           Health check
POST   /api/documents                        Upload PDF, extract, embed, store
GET    /api/documents                        List all documents
GET    /api/documents/{id}                   Get single document metadata
PATCH  /api/documents/{id}                   Update document metadata (rename)
DELETE /api/documents/{id}                   Delete document (blob + CosmosDB)
GET    /api/conversations                    List all conversations
POST   /api/conversations                    Create new conversation
GET    /api/conversations/{id}               Get conversation + message history
POST   /api/conversations/{id}/messages      Send message, receive Gemini response
DELETE /api/conversations/{id}               Delete conversation + all messages
"""
import json
import logging
from datetime import datetime, timezone

import azure.functions as func

from blueprints.upload_document import bp as upload_document_bp
from blueprints.list_documents import bp as list_documents_bp
from blueprints.get_document import bp as get_document_bp
from blueprints.update_document import bp as update_document_bp
from blueprints.delete_document import bp as delete_document_bp
from blueprints.list_conversations import bp as list_conversations_bp
from blueprints.create_conversation import bp as create_conversation_bp
from blueprints.get_conversation import bp as get_conversation_bp
from blueprints.send_message import bp as send_message_bp
from blueprints.delete_conversation import bp as delete_conversation_bp
from models.document import ExtractedDocumentInfo, QueueProcessPdfMessage
from services import blob_service, cosmos_service, pdf_service

logger = logging.getLogger(__name__)

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# ---------------------------------------------------------------------------
# Register document management blueprints
# ---------------------------------------------------------------------------
app.register_blueprint(upload_document_bp)
app.register_blueprint(list_documents_bp)
app.register_blueprint(get_document_bp)
app.register_blueprint(update_document_bp)
app.register_blueprint(delete_document_bp)

# ---------------------------------------------------------------------------
# Register conversation management blueprints (Phase 4)
# ---------------------------------------------------------------------------
app.register_blueprint(list_conversations_bp)
app.register_blueprint(create_conversation_bp)
app.register_blueprint(get_conversation_bp)
app.register_blueprint(send_message_bp)
app.register_blueprint(delete_conversation_bp)


# ---------------------------------------------------------------------------
# Health check (inline — no separate blueprint needed)
# ---------------------------------------------------------------------------
@app.route(route="health", methods=["GET"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/health — Returns 200 OK when the function host is running."""
    return func.HttpResponse(
        json.dumps({"status": "ok"}),
        status_code=200,
        mimetype="application/json",
    )


# ---------------------------------------------------------------------------
# Chat endpoint — placeholder until Phase 4
# ---------------------------------------------------------------------------
@app.route(route="chat", methods=["POST"])
def chat(req: func.HttpRequest) -> func.HttpResponse:
    """POST /api/chat — Placeholder; full implementation in Phase 4."""
    return func.HttpResponse(
        json.dumps({"error": "Chat endpoint is not yet implemented. Coming in Phase 4."}),
        status_code=501,
        mimetype="application/json",
    )


@app.queue_trigger(
    arg_name="msg",
    queue_name="pdf-processing",
    connection="AZURE_STORAGE_CONNECTION_STRING",
)
def process_pdf_queue_message(msg: func.QueueMessage) -> None:
    """Queue Trigger: PDF 분석 → 구조화 추출 → CosmosDB 적재."""
    raw_payload = msg.get_body().decode("utf-8")
    queue_payload = QueueProcessPdfMessage.model_validate_json(raw_payload)
    document_id = queue_payload.documentId
    logger.info("Queue processing started for %s", document_id)

    metadata = cosmos_service.get_document(document_id)
    if not metadata:
        logger.warning("Metadata not found for queued document: %s", document_id)
        return

    try:
        metadata["status"] = "processing"
        metadata["updatedAt"] = datetime.now(timezone.utc).isoformat()
        cosmos_service.upsert_item(metadata)

        pdf_bytes = blob_service.download_blob(queue_payload.blobName)
        raw_text = pdf_service.extract_text(pdf_bytes)
        chunks = pdf_service.chunk_text(raw_text)
        embeddings = pdf_service.embed_texts(chunks)
        extracted = pdf_service.extract_structured_info(raw_text, ExtractedDocumentInfo)

        for idx, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
            chunk_item = {
                "id": f"{document_id}_chunk_{idx}",
                "documentId": document_id,
                "type": "chunk",
                "content": chunk_text,
                "chunkIndex": idx,
                "embedding": embedding,
            }
            cosmos_service.upsert_item(chunk_item)

        metadata["chunkCount"] = len(chunks)
        metadata["status"] = "processed"
        metadata["title"] = extracted.title
        metadata["summary"] = extracted.summary
        metadata["keyPoints"] = extracted.key_points
        metadata["labels"] = extracted.labels
        metadata["hashtags"] = extracted.hashtags
        metadata["categories"] = extracted.categories
        metadata["updatedAt"] = datetime.now(timezone.utc).isoformat()
        cosmos_service.upsert_item(metadata)
        logger.info("Queue processing finished for %s with %d chunks", document_id, len(chunks))
    except Exception as exc:
        logger.exception("Queue processing failed for %s: %s", document_id, exc)
        metadata["status"] = "failed"
        metadata["errorMessage"] = str(exc)
        metadata["updatedAt"] = datetime.now(timezone.utc).isoformat()
        cosmos_service.upsert_item(metadata)
        raise
