import binascii
import json
import mimetypes
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

from edupath_agent import run_agent
from syllabus_rag import retrieve_best_chunks, synthesize_answer
from syllabus_store import SyllabusStore
from syllabus_text import build_syllabus_record_from_text, chunk_text, extract_pdf_text_from_base64


ROOT = Path(__file__).resolve().parents[1]
WEB_DIST = ROOT / "kaist-ai-webapp" / "build"
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "change-me")
STORE = SyllabusStore()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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
    chunks = chunk_text(text) if text else []
    return STORE.replace_chunks(str(entry["id"]), chunks)


class EduPathHandler(BaseHTTPRequestHandler):
    def _send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, file_path: Path, content_type: str = "text/html; charset=utf-8") -> None:
        if not file_path.exists():
            self.send_error(404, "Not found")
            return
        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token")
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/health":
            self._send_json({"ok": True, "service": "KAIST DFMBA EduPath AI Agent"})
            return
        if path == "/api/syllabi":
            self._send_json({"items": STORE.list_all(include_full_text=False)})
            return
        if path == "/api/program/settings":
            self._send_json({"settings": STORE.list_settings()})
            return

        if WEB_DIST.is_dir():
            if path.startswith("/assets/"):
                target = WEB_DIST / path.lstrip("/")
                if target.is_file():
                    mime, _ = mimetypes.guess_type(str(target))
                    self._send_file(target, mime or "application/octet-stream")
                    return
            fav = WEB_DIST / "favicon.ico"
            if path == "/favicon.ico" and fav.is_file():
                self._send_file(fav, "image/x-icon")
                return
            idx = WEB_DIST / "index.html"
            if idx.is_file() and not path.startswith("/api"):
                # SPA: /admin, /user 등 모든 비-API 경로는 index.html
                self._send_file(idx)
                return

        self.send_error(404, "Not found")

    def _require_admin(self) -> bool:
        token = self.headers.get("X-Admin-Token", "")
        if token != ADMIN_TOKEN:
            self._send_json({"error": "관리자 권한이 없습니다."}, status=401)
            return False
        return True

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw) if raw else {}

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        try:
            if path == "/api/agent/analyze":
                payload = self._read_json_body()
                profile = payload.get("profile", {})
                if not isinstance(profile, dict):
                    self._send_json({"error": "profile은 객체여야 합니다."}, status=400)
                    return
                syllabi = STORE.list_all(include_full_text=False)
                program_settings = STORE.list_settings()
                result = run_agent(profile, syllabi=syllabi, program_settings=program_settings)
                self._send_json(result)
                return

            if path == "/api/syllabus/rag":
                payload = self._read_json_body()
                question = str(payload.get("question") or "").strip()
                if not question:
                    self._send_json({"error": "question이 필요합니다."}, status=400)
                    return
                syllabus_id = payload.get("syllabusId") or payload.get("syllabus_id")
                syllabus_id_str = str(syllabus_id).strip() if syllabus_id else None
                chunks = STORE.list_all_chunks()
                hits = retrieve_best_chunks(chunks, question, top_k=8, syllabus_id=syllabus_id_str)
                answer = synthesize_answer(question, hits)
                self._send_json({"answer": answer, "citations": hits})
                return

            if path == "/api/admin/syllabi/upload":
                if not self._require_admin():
                    return
                payload = self._read_json_body()
                entries = payload.get("items", [])
                if not isinstance(entries, list):
                    self._send_json({"error": "items는 배열이어야 합니다."}, status=400)
                    return
                normalized = [item for item in entries if isinstance(item, dict) and isinstance(item.get("id"), str)]
                for item in normalized:
                    item.setdefault("uploadedAt", _utc_now_iso())
                saved = STORE.upsert_many(normalized)
                chunks_written = 0
                for item in normalized:
                    chunks_written += _reindex_syllabus(item)
                self._send_json({"saved": saved, "chunksWritten": chunks_written})
                return

            if path == "/api/admin/syllabi/ingest-pdf":
                if not self._require_admin():
                    return
                payload = self._read_json_body()
                file_name = str(payload.get("fileName") or payload.get("filename") or "syllabus.pdf")
                b64 = payload.get("pdfBase64") or payload.get("pdf_base64") or ""
                if not isinstance(b64, str) or not b64.strip():
                    self._send_json({"error": "pdfBase64가 필요합니다."}, status=400)
                    return
                try:
                    _, text = extract_pdf_text_from_base64(b64.strip())
                except binascii.Error:
                    self._send_json({"error": "PDF Base64 형식이 올바르지 않습니다."}, status=400)
                    return
                except Exception as exc:  # pylint: disable=broad-except
                    self._send_json({"error": f"PDF 처리 실패: {exc}"}, status=400)
                    return
                if not text.strip():
                    self._send_json({"error": "PDF에서 텍스트를 추출하지 못했습니다. 텍스트 레이어가 있는 PDF인지 확인하세요."}, status=400)
                    return
                record = build_syllabus_record_from_text(text=text, file_name=file_name, source_kind="pdf")
                record["uploadedAt"] = _utc_now_iso()
                STORE.upsert_many([record])
                chunk_count = _reindex_syllabus(record)
                self._send_json({"saved": 1, "item": {k: v for k, v in record.items() if k != "fullText"}, "chunks": chunk_count})
                return

            if path == "/api/admin/program/settings":
                if not self._require_admin():
                    return
                payload = self._read_json_body()
                settings = payload.get("settings", payload)
                if not isinstance(settings, dict):
                    self._send_json({"error": "settings 객체가 필요합니다."}, status=400)
                    return
                cleaned = {str(k): str(v) for k, v in settings.items() if v is not None}
                STORE.set_settings(cleaned)
                self._send_json({"ok": True, "settings": STORE.list_settings()})
                return

            self.send_error(404, "Not found")
        except json.JSONDecodeError:
            self._send_json({"error": "JSON 파싱에 실패했습니다."}, status=400)
        except Exception as exc:  # pylint: disable=broad-except
            self._send_json({"error": str(exc)}, status=400)

    def do_DELETE(self) -> None:
        path = urlparse(self.path).path
        try:
            if path == "/api/admin/syllabi":
                if not self._require_admin():
                    return
                deleted = STORE.delete_all()
                self._send_json({"deleted": deleted})
                return

            prefix = "/api/admin/syllabi/"
            if path.startswith(prefix):
                if not self._require_admin():
                    return
                entry_id = path[len(prefix) :]
                if not entry_id:
                    self._send_json({"error": "id가 필요합니다."}, status=400)
                    return
                ok = STORE.delete_one(entry_id)
                if not ok:
                    self._send_json({"error": "대상을 찾을 수 없습니다."}, status=404)
                    return
                self._send_json({"deleted": 1})
                return

            self.send_error(404, "Not found")
        except Exception as exc:  # pylint: disable=broad-except
            self._send_json({"error": str(exc)}, status=400)


def main() -> None:
    host = "0.0.0.0"
    port = int(os.getenv("PORT", "8000"))
    server = HTTPServer((host, port), EduPathHandler)
    print(f"EduPath AI API at http://{host}:{port}", flush=True)
    if (WEB_DIST / "index.html").is_file():
        print(f"SPA (production build): http://{host}:{port}/", flush=True)
    else:
        print("SPA not built. Run: cd kaist-ai-webapp && npm install && npm run build", flush=True)
        print("Dev UI with hot reload: cd kaist-ai-webapp && npm run dev  (proxies /api to this server)", flush=True)
    print("Admin API token set via ADMIN_TOKEN environment variable.", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
