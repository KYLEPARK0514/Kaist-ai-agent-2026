"""KAIST AI Agent — Flask HTTP server for Azure App Service.

Handles both legacy EduPath routes and the new conversation/document API.
Routes are served from the same origin as the built SPA.
"""
from __future__ import annotations

import binascii
import logging
import mimetypes
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, make_response, request, send_from_directory

# ── Legacy EduPath modules (same directory) ──────────────────────────────
from edupath_agent import run_agent
from syllabus_rag import retrieve_best_chunks, synthesize_answer
from syllabus_store import SyllabusStore
from syllabus_text import (
    build_syllabus_record_from_text,
    chunk_text as _chunk_text_legacy,
    extract_pdf_text_from_base64,
)

# ── New conversation / document service modules ───────────────────────────
from models.conversation import (
    ConversationDetailResponse,
    ConversationListResponse,
    ConversationSummary,
    CreateConversationRequest,
    MessageItem,
    MessageRecord,
    MessageSource,
    SendMessageRequest,
    SendMessageResponse,
)
from models.document import (
    DocumentListResponse,
    DocumentMetadataResponse,
    UpdateDocumentRequest,
    UploadDocumentResponse,
)
from services import (
    blob_service,
    chat_service,
    conversation_service,
    cosmos_service,
    pdf_service,
    search_service,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[1]
WEB_DIST = ROOT / "kaist-ai-webapp" / "dist"
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "change-me")
STORE = SyllabusStore()

app = Flask(__name__, static_folder=None)


# ── Helpers ───────────────────────────────────────────────────────────────

def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_admin() -> bool:
    return request.headers.get("X-Admin-Token", "") == ADMIN_TOKEN


def _text_for_indexing(entry: dict) -> str:
    full = entry.get("fullText")
    if isinstance(full, str) and full.strip():
        return full
    parts: list[str] = []
    for key in ("summary", "aiSummary", "name"):
        val = entry.get(key)
        if isinstance(val, str) and val.strip():
            parts.append(val)
    weeks = entry.get("weeks")
    if isinstance(weeks, list):
        parts.extend(str(w) for w in weeks if str(w).strip())
    return "\n".join(parts).strip()


def _reindex_syllabus(entry: dict) -> int:
    text = _text_for_indexing(entry)
    chunks = _chunk_text_legacy(text) if text else []
    return STORE.replace_chunks(str(entry["id"]), chunks)


# ── CORS ──────────────────────────────────────────────────────────────────

@app.after_request
def _add_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Admin-Token"
    return response


@app.route("/api/<path:path>", methods=["OPTIONS"])
def _options_handler(path: str):
    return make_response("", 204)


# ══════════════════════════════════════════════════════════════════════════
# Legacy EduPath API
# ══════════════════════════════════════════════════════════════════════════

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "service": "KAIST DFMBA EduPath AI Agent"})


@app.route("/api/syllabi", methods=["GET"])
def list_syllabi():
    return jsonify({"items": STORE.list_all(include_full_text=False)})


@app.route("/api/program/settings", methods=["GET"])
def get_program_settings():
    return jsonify({"settings": STORE.list_settings()})


@app.route("/api/agent/analyze", methods=["POST"])
def agent_analyze():
    payload = request.get_json(force=True, silent=True) or {}
    profile = payload.get("profile", {})
    if not isinstance(profile, dict):
        return jsonify({"error": "profile은 객체여야 합니다."}), 400
    syllabi = STORE.list_all(include_full_text=False)
    program_settings = STORE.list_settings()
    result = run_agent(profile, syllabi=syllabi, program_settings=program_settings)
    return jsonify(result)


@app.route("/api/syllabus/rag", methods=["POST"])
def syllabus_rag():
    payload = request.get_json(force=True, silent=True) or {}
    question = str(payload.get("question") or "").strip()
    if not question:
        return jsonify({"error": "question이 필요합니다."}), 400
    syllabus_id = payload.get("syllabusId") or payload.get("syllabus_id")
    syllabus_id_str = str(syllabus_id).strip() if syllabus_id else None
    raw_chunks = STORE.list_all_chunks()
    hits = retrieve_best_chunks(raw_chunks, question, top_k=8, syllabus_id=syllabus_id_str)
    answer = synthesize_answer(question, hits)
    return jsonify({"answer": answer, "citations": hits})


@app.route("/api/admin/syllabi/upload", methods=["POST"])
def admin_syllabi_upload():
    if not _require_admin():
        return jsonify({"error": "관리자 권한이 없습니다."}), 401
    payload = request.get_json(force=True, silent=True) or {}
    entries = payload.get("items", [])
    if not isinstance(entries, list):
        return jsonify({"error": "items는 배열이어야 합니다."}), 400
    normalized = [
        item for item in entries
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    ]
    for item in normalized:
        item.setdefault("uploadedAt", _utc_now_iso())
    saved = STORE.upsert_many(normalized)
    chunks_written = sum(_reindex_syllabus(item) for item in normalized)
    return jsonify({"saved": saved, "chunksWritten": chunks_written})


@app.route("/api/admin/syllabi/ingest-pdf", methods=["POST"])
def admin_syllabi_ingest_pdf():
    if not _require_admin():
        return jsonify({"error": "관리자 권한이 없습니다."}), 401
    payload = request.get_json(force=True, silent=True) or {}
    file_name = str(payload.get("fileName") or payload.get("filename") or "syllabus.pdf")
    b64 = payload.get("pdfBase64") or payload.get("pdf_base64") or ""
    if not isinstance(b64, str) or not b64.strip():
        return jsonify({"error": "pdfBase64가 필요합니다."}), 400
    try:
        _, text = extract_pdf_text_from_base64(b64.strip())
    except binascii.Error:
        return jsonify({"error": "PDF Base64 형식이 올바르지 않습니다."}), 400
    except Exception as exc:
        return jsonify({"error": f"PDF 처리 실패: {exc}"}), 400
    if not text.strip():
        return jsonify({"error": "PDF에서 텍스트를 추출하지 못했습니다. 텍스트 레이어가 있는 PDF인지 확인하세요."}), 400
    record = build_syllabus_record_from_text(text=text, file_name=file_name, source_kind="pdf")
    record["uploadedAt"] = _utc_now_iso()
    STORE.upsert_many([record])
    chunk_count = _reindex_syllabus(record)
    return jsonify({
        "saved": 1,
        "item": {k: v for k, v in record.items() if k != "fullText"},
        "chunks": chunk_count,
    })


@app.route("/api/admin/program/settings", methods=["POST"])
def admin_program_settings():
    if not _require_admin():
        return jsonify({"error": "관리자 권한이 없습니다."}), 401
    payload = request.get_json(force=True, silent=True) or {}
    settings = payload.get("settings", payload)
    if not isinstance(settings, dict):
        return jsonify({"error": "settings 객체가 필요합니다."}), 400
    cleaned = {str(k): str(v) for k, v in settings.items() if v is not None}
    STORE.set_settings(cleaned)
    return jsonify({"ok": True, "settings": STORE.list_settings()})


@app.route("/api/admin/syllabi", methods=["DELETE"])
def admin_delete_all_syllabi():
    if not _require_admin():
        return jsonify({"error": "관리자 권한이 없습니다."}), 401
    deleted = STORE.delete_all()
    return jsonify({"deleted": deleted})


@app.route("/api/admin/syllabi/<entry_id>", methods=["DELETE"])
def admin_delete_syllabus(entry_id: str):
    if not _require_admin():
        return jsonify({"error": "관리자 권한이 없습니다."}), 401
    if not entry_id:
        return jsonify({"error": "id가 필요합니다."}), 400
    ok = STORE.delete_one(entry_id)
    if not ok:
        return jsonify({"error": "대상을 찾을 수 없습니다."}), 404
    return jsonify({"deleted": 1})


# ══════════════════════════════════════════════════════════════════════════
# Conversation API
# ══════════════════════════════════════════════════════════════════════════

@app.route("/api/conversations", methods=["GET"])
def list_conversations():
    try:
        records = conversation_service.list_conversations()
        summaries = [ConversationSummary.from_record(r) for r in records]
        body = ConversationListResponse(conversations=summaries, total=len(summaries))
        return make_response(
            body.model_dump_json(by_alias=True), 200, {"Content-Type": "application/json"}
        )
    except Exception as exc:
        logger.exception("list_conversations failed")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/conversations", methods=["POST"])
def create_conversation():
    raw = request.get_json(force=True, silent=True) or {}
    try:
        payload = CreateConversationRequest.model_validate(raw)
    except Exception as exc:
        return jsonify({"error": "Validation failed.", "details": str(exc)}), 400
    try:
        record = conversation_service.create_conversation(payload.title)
        summary = ConversationSummary.from_record(record)
        return make_response(
            summary.model_dump_json(by_alias=True), 201, {"Content-Type": "application/json"}
        )
    except Exception as exc:
        logger.exception("create_conversation failed")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/conversations/<conversation_id>", methods=["GET"])
def get_conversation(conversation_id: str):
    try:
        record = conversation_service.get_conversation(conversation_id)
        if record is None:
            return jsonify({"error": f"Conversation '{conversation_id}' not found."}), 404
        messages = conversation_service.get_messages(conversation_id)
        response = ConversationDetailResponse(
            conversation=ConversationSummary.from_record(record),
            messages=[MessageItem.from_record(m) for m in messages],
        )
        return make_response(
            response.model_dump_json(by_alias=True), 200, {"Content-Type": "application/json"}
        )
    except Exception as exc:
        logger.exception("get_conversation failed for id=%s", conversation_id)
        return jsonify({"error": str(exc)}), 500


@app.route("/api/conversations/<conversation_id>", methods=["DELETE"])
def delete_conversation(conversation_id: str):
    record = conversation_service.get_conversation(conversation_id)
    if record is None:
        return jsonify({"error": f"Conversation '{conversation_id}' not found."}), 404
    try:
        conversation_service.delete_conversation(conversation_id)
        return make_response("", 204)
    except Exception as exc:
        logger.exception("delete_conversation failed for id=%s", conversation_id)
        return jsonify({"error": str(exc)}), 500


@app.route("/api/conversations/<conversation_id>/messages", methods=["POST"])
def send_message(conversation_id: str):
    raw = request.get_json(force=True, silent=True) or {}
    try:
        payload = SendMessageRequest.model_validate(raw)
    except Exception as exc:
        return jsonify({"error": "Validation failed.", "details": str(exc)}), 400

    conversation = conversation_service.get_conversation(conversation_id)
    if conversation is None:
        return jsonify({"error": f"Conversation '{conversation_id}' not found."}), 404

    user_record = MessageRecord(
        conversationId=conversation_id,
        role="user",
        content=payload.content,
        sources=[],
    )
    conversation_service.add_message(user_record)
    conversation_service.increment_message_count(conversation_id)

    history_window = int(os.environ.get("CHAT_HISTORY_WINDOW", "20"))
    all_messages = conversation_service.get_messages(conversation_id)
    history = all_messages[-history_window:] if len(all_messages) > history_window else all_messages

    top_k = int(os.environ.get("SEARCH_TOP_K", "8"))
    try:
        chunks = search_service.hybrid_search(payload.content, top_k=top_k)
    except Exception:
        logger.exception("Hybrid search failed; proceeding with empty context")
        chunks = []

    try:
        assistant_text = chat_service.generate_response(
            user_query=payload.content,
            search_results=chunks,
            history=history,
        )
    except Exception as exc:
        logger.exception("Gemini generation failed")
        return jsonify({"error": "AI response generation failed.", "detail": str(exc)}), 502

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
    conversation_service.add_message(assistant_record)
    conversation_service.increment_message_count(conversation_id)

    response = SendMessageResponse(
        userMessage=MessageItem.from_record(user_record),
        assistantMessage=MessageItem.from_record(assistant_record),
    )
    return make_response(
        response.model_dump_json(by_alias=True), 200, {"Content-Type": "application/json"}
    )


# ══════════════════════════════════════════════════════════════════════════
# Document API
# ══════════════════════════════════════════════════════════════════════════

@app.route("/api/documents", methods=["GET"])
def list_documents():
    try:
        raw_items = cosmos_service.list_documents()
    except Exception as exc:
        logger.exception("Failed to list documents: %s", exc)
        return jsonify({"error": "Internal server error. Please try again later."}), 500
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
    body = DocumentListResponse(documents=documents, count=len(documents))
    return make_response(
        body.model_dump_json(by_alias=True), 200, {"Content-Type": "application/json"}
    )


@app.route("/api/documents", methods=["POST"])
def upload_document():
    file_data: bytes | None = None
    original_filename = "document.pdf"

    if "file" in request.files:
        uploaded = request.files["file"]
        file_data = uploaded.read()
        original_filename = uploaded.filename or original_filename
    else:
        body = request.get_data()
        if body:
            file_data = body
            content_disposition = request.headers.get("Content-Disposition", "")
            if "filename=" in content_disposition:
                for part in content_disposition.split(";"):
                    part = part.strip()
                    if part.startswith("filename="):
                        original_filename = part[len("filename="):].strip('"').strip("'")

    if not file_data:
        return jsonify({"error": "A PDF file is required. Send as multipart/form-data field 'file'."}), 400
    if not file_data.startswith(b"%PDF"):
        return jsonify({"error": "Uploaded file does not appear to be a valid PDF."}), 400

    document_id = str(uuid.uuid4())
    blob_name = f"{document_id}/{original_filename}"
    uploaded_at = _utc_now_iso()

    try:
        blob_service.upload_blob(blob_name, file_data, content_type="application/pdf")
        raw_text = pdf_service.extract_text(file_data)
        text_chunks = pdf_service.chunk_text(raw_text)
        embeddings = pdf_service.embed_texts(text_chunks)

        metadata_item: dict = {
            "id": document_id,
            "documentId": document_id,
            "type": "metadata",
            "filename": original_filename,
            "blobName": blob_name,
            "chunkCount": len(text_chunks),
            "uploadedAt": uploaded_at,
        }
        cosmos_service.create_metadata_item(metadata_item)

        for idx, (chunk_content, embedding) in enumerate(zip(text_chunks, embeddings)):
            chunk_item: dict = {
                "id": str(uuid.uuid4()),
                "documentId": document_id,
                "type": "chunk",
                "content": chunk_content,
                "chunkIndex": idx,
                "embedding": embedding,
            }
            cosmos_service.create_chunk_item(chunk_item)

        response_body = UploadDocumentResponse(
            documentId=document_id,
            filename=original_filename,
            chunkCount=len(text_chunks),
            uploadedAt=uploaded_at,
        )
        return make_response(
            response_body.model_dump_json(by_alias=True), 201, {"Content-Type": "application/json"}
        )
    except Exception as exc:
        logger.exception("upload_document failed")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/documents/<document_id>", methods=["GET"])
def get_document(document_id: str):
    try:
        item = cosmos_service.get_document(document_id)
    except Exception:
        logger.exception("Failed to retrieve document %s", document_id)
        return jsonify({"error": "Internal server error. Please try again later."}), 500
    if item is None:
        return jsonify({"error": f"Document '{document_id}' not found."}), 404
    response = DocumentMetadataResponse(
        id=item["id"],
        documentId=item["documentId"],
        filename=item["filename"],
        blobName=item["blobName"],
        chunkCount=item["chunkCount"],
        uploadedAt=item["uploadedAt"],
    )
    return make_response(
        response.model_dump_json(), 200, {"Content-Type": "application/json"}
    )


@app.route("/api/documents/<document_id>", methods=["PATCH"])
def update_document(document_id: str):
    raw = request.get_json(force=True, silent=True) or {}
    try:
        update_req = UpdateDocumentRequest(**raw)
    except Exception as exc:
        return jsonify({"error": "Validation error.", "details": str(exc)}), 400
    try:
        updated_item = cosmos_service.update_document(document_id, {"filename": update_req.filename})
    except Exception as exc:
        from azure.cosmos import exceptions as cosmos_exceptions
        if isinstance(exc, cosmos_exceptions.CosmosResourceNotFoundError):
            return jsonify({"error": f"Document '{document_id}' not found."}), 404
        logger.exception("update_document failed for %s", document_id)
        return jsonify({"error": str(exc)}), 500
    response = DocumentMetadataResponse(
        id=updated_item["id"],
        documentId=updated_item["documentId"],
        filename=updated_item["filename"],
        blobName=updated_item["blobName"],
        chunkCount=updated_item["chunkCount"],
        uploadedAt=updated_item["uploadedAt"],
    )
    return make_response(
        response.model_dump_json(), 200, {"Content-Type": "application/json"}
    )


@app.route("/api/documents/<document_id>", methods=["DELETE"])
def delete_document(document_id: str):
    try:
        metadata = cosmos_service.get_document(document_id)
    except Exception:
        logger.exception("Failed to look up document %s", document_id)
        return jsonify({"error": "Internal server error. Please try again later."}), 500
    if metadata is None:
        return jsonify({"error": f"Document '{document_id}' not found."}), 404

    blob_name: str = metadata.get("blobName", "")
    try:
        items_deleted = cosmos_service.delete_document_items(document_id)
    except Exception:
        logger.exception("Failed to delete CosmosDB items for document %s", document_id)
        return jsonify({"error": "Internal server error. Please try again later."}), 500

    if blob_name:
        try:
            blob_service.delete_blob(blob_name)
        except Exception as exc:
            logger.warning("Failed to delete blob %s: %s", blob_name, exc)

    return jsonify({"documentId": document_id, "itemsDeleted": items_deleted})


# ══════════════════════════════════════════════════════════════════════════
# SPA / static file serving
# ══════════════════════════════════════════════════════════════════════════

@app.route("/assets/<path:filename>", methods=["GET"])
def static_assets(filename: str):
    assets_dir = WEB_DIST / "assets"
    if not (assets_dir / filename).is_file():
        return make_response("Not found", 404)
    mime, _ = mimetypes.guess_type(filename)
    return send_from_directory(str(assets_dir), filename, mimetype=mime or "application/octet-stream")


@app.route("/favicon.ico", methods=["GET"])
def favicon():
    fav = WEB_DIST / "favicon.ico"
    if fav.is_file():
        return send_from_directory(str(WEB_DIST), "favicon.ico", mimetype="image/x-icon")
    return make_response("Not found", 404)


@app.route("/", defaults={"path": ""}, methods=["GET"])
@app.route("/<path:path>", methods=["GET"])
def spa_fallback(path: str):
    idx = WEB_DIST / "index.html"
    if idx.is_file():
        return send_from_directory(str(WEB_DIST), "index.html")
    return make_response(
        "Frontend not built. Run: cd kaist-ai-webapp && npm run build", 503
    )


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port)
