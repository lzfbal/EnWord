import json
import sqlite3
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "enword.db"

app = Flask(__name__, static_folder=str(ROOT), static_url_path="")


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS word_progress (
                id INTEGER PRIMARY KEY,
                status TEXT NOT NULL,
                stage INTEGER NOT NULL DEFAULT 0,
                nextReviewAt INTEGER NOT NULL DEFAULT 0,
                lastReviewedAt INTEGER NOT NULL DEFAULT 0,
                rightCount INTEGER NOT NULL DEFAULT 0,
                wrongCount INTEGER NOT NULL DEFAULT 0,
                tags TEXT NOT NULL DEFAULT '[]'
            )
            """
        )
        conn.commit()


def row_to_record(row: sqlite3.Row) -> dict:
    tags_raw = row["tags"] if row["tags"] is not None else "[]"
    try:
        tags = json.loads(tags_raw)
    except json.JSONDecodeError:
        tags = []

    return {
        "id": row["id"],
        "status": row["status"],
        "stage": row["stage"],
        "nextReviewAt": row["nextReviewAt"],
        "lastReviewedAt": row["lastReviewedAt"],
        "rightCount": row["rightCount"],
        "wrongCount": row["wrongCount"],
        "tags": tags if isinstance(tags, list) else [],
    }


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "db": str(DB_PATH)}


@app.get("/api/progress")
def get_progress():
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, status, stage, nextReviewAt, lastReviewedAt, rightCount, wrongCount, tags
            FROM word_progress
            ORDER BY id ASC
            """
        ).fetchall()

    data = [row_to_record(r) for r in rows]
    return jsonify(data)


@app.post("/api/progress")
def upsert_progress():
    payload = request.get_json(silent=True) or {}

    try:
        word_id = int(payload["id"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "Invalid or missing field: id"}), 400

    record = {
        "id": word_id,
        "status": str(payload.get("status", "new")),
        "stage": int(payload.get("stage", 0)),
        "nextReviewAt": int(payload.get("nextReviewAt", 0)),
        "lastReviewedAt": int(payload.get("lastReviewedAt", 0)),
        "rightCount": int(payload.get("rightCount", 0)),
        "wrongCount": int(payload.get("wrongCount", 0)),
        "tags": payload.get("tags", []),
    }

    if not isinstance(record["tags"], list):
        record["tags"] = []

    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO word_progress (
                id, status, stage, nextReviewAt, lastReviewedAt, rightCount, wrongCount, tags
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                status=excluded.status,
                stage=excluded.stage,
                nextReviewAt=excluded.nextReviewAt,
                lastReviewedAt=excluded.lastReviewedAt,
                rightCount=excluded.rightCount,
                wrongCount=excluded.wrongCount,
                tags=excluded.tags
            """,
            (
                record["id"],
                record["status"],
                record["stage"],
                record["nextReviewAt"],
                record["lastReviewedAt"],
                record["rightCount"],
                record["wrongCount"],
                json.dumps(record["tags"], ensure_ascii=False),
            ),
        )
        conn.commit()

    return jsonify({"ok": True})


@app.get("/")
def root_index():
    return send_from_directory(ROOT, "index.html")


@app.get("/<path:path>")
def static_files(path: str):
    return send_from_directory(ROOT, path)


if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=8000, debug=False)
