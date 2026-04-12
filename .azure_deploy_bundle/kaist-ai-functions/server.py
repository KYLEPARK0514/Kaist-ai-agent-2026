import json
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

from edupath_agent import run_agent
from syllabus_store import SyllabusStore


ROOT = Path(__file__).resolve().parents[1]
WEB_DIST = ROOT / "kaist-ai-webapp" / "build"
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "change-me")
STORE = SyllabusStore()


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
            self._send_json({"ok": True, "service": "EduPath AI Agent"})
            return
        if path == "/api/syllabi":
            self._send_json({"items": STORE.list_all()})
            return

        if WEB_DIST.is_dir():
            if path.startswith("/assets/"):
                target = WEB_DIST / path.lstrip("/")
                if target.is_file():
                    mime, _ = mimetypes.guess_type(str(target))
                    self._send_file(target, mime or "application/octet-stream")
                    return
            if path in ("/", "/index.html", "/user", "/admin"):
                idx = WEB_DIST / "index.html"
                if idx.is_file():
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
                result = run_agent(profile)
                self._send_json(result)
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
                saved = STORE.upsert_many(normalized)
                self._send_json({"saved": saved})
                return

            self.send_error(404, "Not found")
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
    print(f"EduPath AI API at http://{host}:{port}")
    if (WEB_DIST / "index.html").is_file():
        print(f"SPA (production build): http://{host}:{port}/")
    else:
        print("SPA not built. Run: cd kaist-ai-webapp && npm install && npm run build")
        print("Dev UI with hot reload: cd kaist-ai-webapp && npm run dev  (proxies /api to this server)")
    print("Admin API token set via ADMIN_TOKEN environment variable.")
    server.serve_forever()


if __name__ == "__main__":
    main()
