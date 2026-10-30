from __future__ import annotations

import json
import os
import sqlite3
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

app = FastAPI(title="Seeknimbly PhysicalOS", version="1.0.0")
_lock = Lock()
_db_path = Path(os.getenv("PHYSICALOS_DB", "/tmp/physicalos.db" if os.getenv("VERCEL") else "physicalos.db"))

WORKERS = [
    {"id": 1, "name": "Amina", "skills": ["CNC", "inspection"], "available": True},
    {"id": 2, "name": "Mateo", "skills": ["welding"], "available": True},
    {"id": 3, "name": "Priya", "skills": ["assembly", "inspection"], "available": False},
    {"id": 4, "name": "Jonas", "skills": ["CNC"], "available": True},
    {"id": 5, "name": "Elena", "skills": ["assembly"], "available": True},
    {"id": 6, "name": "Sam", "skills": ["welding", "inspection"], "available": True},
    {"id": 7, "name": "Noor", "skills": ["packaging"], "available": True},
    {"id": 8, "name": "Luis", "skills": ["maintenance"], "available": True},
]
ORDERS = [
    {"id": "O1", "task": "CNC housing", "skill": "CNC", "robot_type": "material"},
    {"id": "O2", "task": "Weld frame", "skill": "welding", "robot_type": "welding"},
    {"id": "O3", "task": "Assemble actuator", "skill": "assembly", "robot_type": "material"},
    {"id": "O4", "task": "Final inspection", "skill": "inspection", "robot_type": "inspection"},
    {"id": "O5", "task": "Package shipment", "skill": "packaging", "robot_type": "material"},
]
ROBOTS = [
    {"id": "R1", "type": "material", "available": True},
    {"id": "R2", "type": "welding", "available": True},
    {"id": "R3", "type": "inspection", "available": True},
]


class ProposalIn(BaseModel):
    order_id: str
    worker_id: int
    robot_id: str
    source: str
    rationale: str
    model: str | None = None


class DecisionIn(BaseModel):
    approve: bool


def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(_db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("CREATE TABLE IF NOT EXISTS proposals (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT, worker_id INTEGER, robot_id TEXT, source TEXT, rationale TEXT, model TEXT, status TEXT DEFAULT 'pending', created_at TEXT)")
    connection.execute("CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT, detail TEXT, created_at TEXT)")
    connection.commit()
    return connection


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _eligible(order_id: str) -> tuple[dict, dict, dict]:
    order = next((item for item in ORDERS if item["id"] == order_id), None)
    if order is None:
        raise HTTPException(404, "Unknown order")
    worker = next((item for item in WORKERS if item["available"] and order["skill"] in item["skills"]), None)
    robot = next((item for item in ROBOTS if item["available"] and item["type"] == order["robot_type"]), None)
    if worker is None or robot is None:
        raise HTTPException(409, "No safe eligible assignment")
    return order, worker, robot


def _nebius_explanation(order: dict, worker: dict, robot: dict) -> dict | None:
    key = os.getenv("NEBIUS_API_KEY")
    model = os.getenv("NEBIUS_MODEL")
    if not key or not model:
        return None
    base = os.getenv("NEBIUS_BASE_URL", "https://api.tokenfactory.nebius.com/v1").rstrip("/")
    prompt = (
        "Explain this already safety-validated manufacturing assignment in one concise sentence. "
        "Do not change IDs or claim real robot control. "
        f"Order={order['id']} task={order['task']}; worker={worker['name']} skills={worker['skills']}; "
        f"simulated_robot={robot['id']} type={robot['type']}."
    )
    payload = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": "You are an auditable factory dispatch explainer. Deterministic safety checks always prevail."},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 100,
        "temperature": 0.1,
    }).encode()
    request = urllib.request.Request(
        f"{base}/chat/completions",
        data=payload,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            result = json.load(response)
        text = result["choices"][0]["message"]["content"].strip()
        return {"rationale": text, "model": model, "request_id": result.get("id")}
    except (urllib.error.URLError, urllib.error.HTTPError, KeyError, IndexError, json.JSONDecodeError) as exc:
        if os.getenv("PHYSICALOS_REQUIRE_AI", "false").lower() == "true":
            raise HTTPException(502, f"Nebius inference failed: {type(exc).__name__}") from exc
        return None


@app.get("/", response_class=HTMLResponse)
def home() -> str:
    return Path(__file__).with_name("index.html").read_text(encoding="utf-8")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "ai_configured": bool(os.getenv("NEBIUS_API_KEY") and os.getenv("NEBIUS_MODEL")), "model": os.getenv("NEBIUS_MODEL")}


@app.get("/api/state")
def state() -> dict:
    return {"workers": WORKERS, "orders": ORDERS, "robots": ROBOTS}


@app.get("/api/recommend/{order_id}")
def recommend(order_id: str) -> dict:
    order, worker, robot = _eligible(order_id)
    ai = _nebius_explanation(order, worker, robot)
    return {
        "order_id": order["id"], "worker_id": worker["id"], "robot_id": robot["id"],
        "source": "nebius_token_factory" if ai else "rules",
        "rationale": ai["rationale"] if ai else "Qualified available assignment",
        "model": ai["model"] if ai else None,
        "inference_request_id": ai.get("request_id") if ai else None,
    }


@app.get("/api/inference/test")
def inference_test() -> dict:
    if not os.getenv("NEBIUS_API_KEY") or not os.getenv("NEBIUS_MODEL"):
        raise HTTPException(503, "Set NEBIUS_API_KEY and NEBIUS_MODEL")
    order, worker, robot = _eligible("O1")
    result = _nebius_explanation(order, worker, robot)
    if not result:
        raise HTTPException(502, "Nebius inference did not return a verified result")
    return {"verified": True, "provider": "Nebius Token Factory", **result}


@app.post("/api/proposals", status_code=201)
def create_proposal(proposal: ProposalIn) -> dict:
    order, worker, robot = _eligible(proposal.order_id)
    if worker["id"] != proposal.worker_id or robot["id"] != proposal.robot_id:
        raise HTTPException(400, "Proposal does not match deterministic eligibility checks")
    with _lock, _connect() as connection:
        cursor = connection.execute(
            "INSERT INTO proposals(order_id,worker_id,robot_id,source,rationale,model,created_at) VALUES(?,?,?,?,?,?,?)",
            (proposal.order_id, proposal.worker_id, proposal.robot_id, proposal.source, proposal.rationale, proposal.model, _now()),
        )
        proposal_id = cursor.lastrowid
        connection.execute("INSERT INTO audit(action,detail,created_at) VALUES(?,?,?)", ("proposal_created", json.dumps({"id": proposal_id}), _now()))
        connection.commit()
    return {"id": proposal_id, "status": "pending"}


@app.get("/api/proposals")
def proposals() -> list[dict]:
    with _connect() as connection:
        return [dict(row) for row in connection.execute("SELECT * FROM proposals ORDER BY id DESC")]


@app.post("/api/proposals/{proposal_id}/decision")
def decision(proposal_id: int, decision_in: DecisionIn) -> dict:
    status = "approved" if decision_in.approve else "rejected"
    with _lock, _connect() as connection:
        existing = connection.execute("SELECT * FROM proposals WHERE id=?", (proposal_id,)).fetchone()
        if existing is None:
            raise HTTPException(404, "Unknown proposal")
        if existing["status"] != "pending":
            raise HTTPException(409, "Proposal already decided")
        connection.execute("UPDATE proposals SET status=? WHERE id=?", (status, proposal_id))
        connection.execute("INSERT INTO audit(action,detail,created_at) VALUES(?,?,?)", (f"proposal_{status}", json.dumps({"id": proposal_id}), _now()))
        connection.commit()
    return {"id": proposal_id, "status": status}


@app.get("/api/audit")
def audit() -> list[dict]:
    with _connect() as connection:
        return [dict(row) for row in connection.execute("SELECT * FROM audit ORDER BY id DESC")]

