from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional


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
            conn.commit()

    def list_all(self) -> List[Dict]:
        with self._connect() as conn:
            rows = conn.execute("SELECT payload FROM syllabi ORDER BY rowid DESC").fetchall()
        return [json.loads(row["payload"]) for row in rows]

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
            cursor = conn.execute("DELETE FROM syllabi WHERE id = ?", (entry_id,))
            conn.commit()
        return cursor.rowcount > 0

    def delete_all(self) -> int:
        with self._connect() as conn:
            count = conn.execute("SELECT COUNT(*) AS cnt FROM syllabi").fetchone()["cnt"]
            conn.execute("DELETE FROM syllabi")
            conn.commit()
        return int(count)

