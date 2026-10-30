from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException


LEGAL_TRANSITIONS = {
    "EVENT_DETECTED": {"CONTEXT_RESOLVED", "CANCELLED", "ESCALATED"},
    "CONTEXT_RESOLVED": {"SAFETY_VALIDATED", "VALIDATION_FAILED", "CANCELLED"},
    "SAFETY_VALIDATED": {"AI_EXPLAINED", "APPROVAL_PENDING", "VALIDATION_FAILED"},
    "AI_EXPLAINED": {"APPROVAL_PENDING", "CANCELLED"},
    "APPROVAL_PENDING": {"APPROVED", "REJECTED", "EXPIRED", "CANCELLED"},
    "APPROVED": {"SIMULATED_DISPATCH", "EXPIRED", "CANCELLED"},
    "SIMULATED_DISPATCH": {"RUNNING", "EXECUTION_FAILED", "CANCELLED"},
    "RUNNING": {"COMPLETED", "EXECUTION_FAILED", "CANCELLED"},
    "VALIDATION_FAILED": set(),
    "REJECTED": set(),
    "EXPIRED": set(),
    "EXECUTION_FAILED": {"ESCALATED", "CANCELLED"},
    "COMPLETED": set(),
    "CANCELLED": set(),
    "ESCALATED": set(),
}

STAGE_ORDER = [
    "EVENT_DETECTED",
    "CONTEXT_RESOLVED",
    "SAFETY_VALIDATED",
    "AI_EXPLAINED",
    "APPROVAL_PENDING",
    "APPROVED",
    "SIMULATED_DISPATCH",
    "RUNNING",
    "COMPLETED",
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _history(raw: str | list | None) -> list[dict]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return list(raw)
    try:
        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def stages_for(state: str) -> list[dict]:
    terminal_fail = {
        "VALIDATION_FAILED": "VALIDATION_FAILED",
        "REJECTED": "REJECTED",
        "EXPIRED": "EXPIRED",
        "EXECUTION_FAILED": "EXECUTION_FAILED",
        "CANCELLED": "CANCELLED",
        "ESCALATED": "ESCALATED",
    }
    stages = []
    reached = False
    if state in terminal_fail and state not in STAGE_ORDER:
        # Show pipeline up to the last successful-ish point as completed, mark current fail.
        for name in STAGE_ORDER:
            if name == "APPROVAL_PENDING" and state == "REJECTED":
                stages.append({"id": name, "name": name, "label": name.replace("_", " ").title(), "status": "failed"})
                break
            if name in {"SAFETY_VALIDATED", "CONTEXT_RESOLVED"} and state == "VALIDATION_FAILED":
                stages.append({"id": name, "name": name, "label": name.replace("_", " ").title(), "status": "failed"})
                break
            stages.append({"id": name, "name": name, "label": name.replace("_", " ").title(), "status": "completed"})
        else:
            stages.append({"id": state, "name": state, "label": state.replace("_", " ").title(), "status": "failed"})
        if not any(item["id"] == state for item in stages):
            stages.append({"id": state, "name": state, "label": state.replace("_", " ").title(), "status": "failed"})
        return stages

    for name in STAGE_ORDER:
        if name == state:
            stages.append({"id": name, "name": name, "label": name.replace("_", " ").title(), "status": "active" if state != "COMPLETED" else "completed"})
            reached = True
        elif not reached:
            stages.append({"id": name, "name": name, "label": name.replace("_", " ").title(), "status": "completed"})
        else:
            stages.append({"id": name, "name": name, "label": name.replace("_", " ").title(), "status": "pending"})
    return stages


def create_workflow(connection, *, order_id: str, event_id: str, machine_id: str | None) -> dict:
    workflow_id = f"wf_{uuid.uuid4().hex[:10]}"
    now = _now()
    history = [{"state": "EVENT_DETECTED", "at": now, "actor": "event_engine"}]
    connection.execute(
        "INSERT INTO workflows(id, order_id, event_id, machine_id, state, history, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
        (workflow_id, order_id, event_id, machine_id, "EVENT_DETECTED", json.dumps(history), now, now),
    )
    return get_workflow(connection, workflow_id)


def get_workflow(connection, workflow_id: str) -> dict:
    row = connection.execute("SELECT * FROM workflows WHERE id=?", (workflow_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Unknown workflow")
    return serialize_workflow(dict(row))


def list_workflows(connection) -> list[dict]:
    rows = connection.execute("SELECT * FROM workflows ORDER BY created_at DESC").fetchall()
    return [serialize_workflow(dict(row)) for row in rows]


def serialize_workflow(row: dict) -> dict:
    state = row["state"]
    return {
        "id": row["id"],
        "name": f"Recovery {row.get('order_id') or ''}".strip(),
        "order_id": row.get("order_id"),
        "event_id": row.get("event_id"),
        "proposal_id": row.get("proposal_id"),
        "machine_id": row.get("machine_id"),
        "status": state,
        "state": state,
        "current_stage": state,
        "stages": stages_for(state),
        "steps": stages_for(state),
        "history": _history(row.get("history")),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def transition(connection, workflow_id: str, new_state: str, *, actor: str = "system", proposal_id: int | None = None) -> dict:
    row = connection.execute("SELECT * FROM workflows WHERE id=?", (workflow_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Unknown workflow")
    current = row["state"]
    allowed = LEGAL_TRANSITIONS.get(current, set())
    if new_state not in allowed:
        raise HTTPException(status_code=409, detail=f"Illegal workflow transition {current} -> {new_state}")
    history = _history(row["history"])
    now = _now()
    history.append({"state": new_state, "at": now, "actor": actor, "from": current})
    connection.execute(
        "UPDATE workflows SET state=?, history=?, updated_at=?, proposal_id=COALESCE(?, proposal_id) WHERE id=?",
        (new_state, json.dumps(history), now, proposal_id, workflow_id),
    )
    return get_workflow(connection, workflow_id)


def advance_many(connection, workflow_id: str, states: list[str], *, actor: str = "system", proposal_id: int | None = None) -> dict:
    workflow = get_workflow(connection, workflow_id)
    for state in states:
        workflow = transition(connection, workflow_id, state, actor=actor, proposal_id=proposal_id)
    return workflow
