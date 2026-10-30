from __future__ import annotations

import json
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_audit(
    connection,
    *,
    action: str,
    detail: dict | str | None = None,
    actor: str = "system",
    resource_type: str | None = None,
    resource_id: str | None = None,
    previous_state: str | None = None,
    new_state: str | None = None,
    evidence_ref: str | None = None,
    model: str | None = None,
    inference_request_id: str | None = None,
) -> dict:
    payload = detail if isinstance(detail, str) else json.dumps(detail or {})
    cursor = connection.execute(
        """
        INSERT INTO audit(action, detail, actor, resource_type, resource_id, previous_state, new_state, evidence_ref, model, inference_request_id, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            action,
            payload,
            actor,
            resource_type,
            str(resource_id) if resource_id is not None else None,
            previous_state,
            new_state,
            evidence_ref,
            model,
            inference_request_id,
            _now(),
        ),
    )
    return {"id": cursor.lastrowid, "action": action}


def list_audit(connection) -> list[dict]:
    rows = connection.execute("SELECT * FROM audit ORDER BY id DESC").fetchall()
    results = []
    for row in rows:
        item = dict(row)
        detail = item.get("detail")
        if isinstance(detail, str):
            try:
                item["detail"] = json.loads(detail)
            except json.JSONDecodeError:
                pass
        results.append(item)
    return results
