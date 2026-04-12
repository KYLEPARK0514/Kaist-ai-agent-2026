from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional, Tuple


ROOT = Path(__file__).resolve().parents[1]
DB_DIR = ROOT / ".data"
DB_PATH = DB_DIR / "syllabi.db"


class SyllabusStore:
    def __init__(self, db_path: Path = DB_PATH) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_schema(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS syllabi (
                    id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS syllabus_chunks (
                    syllabus_id TEXT NOT NULL,
                    chunk_index INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    PRIMARY KEY (syllabus_id, chunk_index)
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS program_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def list_all(self, include_full_text: bool = False) -> List[Dict]:
        with self._connect() as conn:
            rows = conn.execute("SELECT payload FROM syllabi ORDER BY rowid DESC").fetchall()
        items = [json.loads(row["payload"]) for row in rows]
        if include_full_text:
            return items
        return [{k: v for k, v in item.items() if k != "fullText"} for item in items]

    def upsert_many(self, entries: List[Dict]) -> int:
        if not entries:
            return 0
        with self._connect() as conn:
            conn.executemany(
                "INSERT OR REPLACE INTO syllabi (id, payload) VALUES (?, ?)",
                [(entry["id"], json.dumps(entry, ensure_ascii=False)) for entry in entries],
            )
            conn.commit()
        return len(entries)

    def delete_one(self, entry_id: str) -> bool:
        with self._connect() as conn:
            conn.execute("DELETE FROM syllabus_chunks WHERE syllabus_id = ?", (entry_id,))
            cursor = conn.execute("DELETE FROM syllabi WHERE id = ?", (entry_id,))
            conn.commit()
        return cursor.rowcount > 0

    def delete_all(self) -> int:
        with self._connect() as conn:
            count = conn.execute("SELECT COUNT(*) AS cnt FROM syllabi").fetchone()["cnt"]
            conn.execute("DELETE FROM syllabus_chunks")
            conn.execute("DELETE FROM syllabi")
            conn.commit()
        return int(count)

    def replace_chunks(self, syllabus_id: str, chunks: List[str]) -> int:
        with self._connect() as conn:
            conn.execute("DELETE FROM syllabus_chunks WHERE syllabus_id = ?", (syllabus_id,))
            if chunks:
                conn.executemany(
                    "INSERT INTO syllabus_chunks (syllabus_id, chunk_index, text) VALUES (?, ?, ?)",
                    [(syllabus_id, idx, text) for idx, text in enumerate(chunks)],
                )
            conn.commit()
        return len(chunks)

    def list_all_chunks(self) -> List[Tuple[str, int, str]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT syllabus_id, chunk_index, text FROM syllabus_chunks ORDER BY syllabus_id, chunk_index"
            ).fetchall()
        return [(row["syllabus_id"], int(row["chunk_index"]), row["text"]) for row in rows]

    def get_payload(self, syllabus_id: str) -> Optional[Dict]:
        with self._connect() as conn:
            row = conn.execute("SELECT payload FROM syllabi WHERE id = ?", (syllabus_id,)).fetchone()
        return json.loads(row["payload"]) if row else None

    def get_setting(self, key: str) -> Optional[str]:
        with self._connect() as conn:
            row = conn.execute("SELECT value FROM program_settings WHERE key = ?", (key,)).fetchone()
        return str(row["value"]) if row else None

    def set_settings(self, items: Dict[str, str]) -> None:
        if not items:
            return
        with self._connect() as conn:
            conn.executemany(
                "INSERT OR REPLACE INTO program_settings (key, value) VALUES (?, ?)",
                [(k, v) for k, v in items.items()],
            )
            conn.commit()

    def list_settings(self) -> Dict[str, str]:
        with self._connect() as conn:
            rows = conn.execute("SELECT key, value FROM program_settings").fetchall()
        return {str(r["key"]): str(r["value"]) for r in rows}

