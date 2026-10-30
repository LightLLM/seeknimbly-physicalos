from __future__ import annotations

import sqlite3
from pathlib import Path

from backend.app.core.config import db_path


SCHEMA = """
CREATE TABLE IF NOT EXISTS proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    worker_id INTEGER NOT NULL,
    robot_id TEXT NOT NULL,
    machine_id TEXT,
    source TEXT,
    rationale TEXT,
    model TEXT,
    inference_request_id TEXT,
    workflow_id TEXT,
    status TEXT DEFAULT 'pending',
    idempotency_key TEXT,
    created_at TEXT NOT NULL,
    decided_at TEXT,
    expires_at TEXT
);
CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    detail TEXT,
    actor TEXT,
    resource_type TEXT,
    resource_id TEXT,
    previous_state TEXT,
    new_state TEXT,
    evidence_ref TEXT,
    model TEXT,
    inference_request_id TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    event_id TEXT,
    proposal_id INTEGER,
    machine_id TEXT,
    state TEXT NOT NULL,
    history TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS executions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT,
    proposal_id INTEGER,
    adapter TEXT,
    status TEXT NOT NULL,
    steps TEXT,
    summary TEXT,
    result TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT
);
CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    name TEXT,
    provider TEXT,
    license TEXT,
    source_url TEXT,
    status TEXT,
    row_count INTEGER,
    imported_at TEXT,
    metadata TEXT
);
"""


def connect(path: Path | None = None) -> sqlite3.Connection:
    target = path or db_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(target), check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.executescript(SCHEMA)
    connection.commit()
    _migrate(connection)
    return connection


def _migrate(connection: sqlite3.Connection) -> None:
    """Additive migrations for earlier demo databases."""
    proposal_cols = {row[1] for row in connection.execute("PRAGMA table_info(proposals)")}
    for column, ddl in {
        "machine_id": "ALTER TABLE proposals ADD COLUMN machine_id TEXT",
        "inference_request_id": "ALTER TABLE proposals ADD COLUMN inference_request_id TEXT",
        "workflow_id": "ALTER TABLE proposals ADD COLUMN workflow_id TEXT",
        "idempotency_key": "ALTER TABLE proposals ADD COLUMN idempotency_key TEXT",
        "decided_at": "ALTER TABLE proposals ADD COLUMN decided_at TEXT",
        "expires_at": "ALTER TABLE proposals ADD COLUMN expires_at TEXT",
    }.items():
        if column not in proposal_cols:
            connection.execute(ddl)

    audit_cols = {row[1] for row in connection.execute("PRAGMA table_info(audit)")}
    for column, ddl in {
        "actor": "ALTER TABLE audit ADD COLUMN actor TEXT",
        "resource_type": "ALTER TABLE audit ADD COLUMN resource_type TEXT",
        "resource_id": "ALTER TABLE audit ADD COLUMN resource_id TEXT",
        "previous_state": "ALTER TABLE audit ADD COLUMN previous_state TEXT",
        "new_state": "ALTER TABLE audit ADD COLUMN new_state TEXT",
        "evidence_ref": "ALTER TABLE audit ADD COLUMN evidence_ref TEXT",
        "model": "ALTER TABLE audit ADD COLUMN model TEXT",
        "inference_request_id": "ALTER TABLE audit ADD COLUMN inference_request_id TEXT",
    }.items():
        if column not in audit_cols:
            connection.execute(ddl)
    connection.commit()
