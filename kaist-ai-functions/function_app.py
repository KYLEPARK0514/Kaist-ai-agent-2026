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
