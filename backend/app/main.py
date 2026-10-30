from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from backend.app.core.auth import require_demo_auth
from backend.app.core.config import settings
from backend.app.db.database import connect
from backend.app.integrations import nebius
from backend.app.integrations.datasets import ai4i
from backend.app.integrations.robotics.adapters import ADAPTERS, Ros2CompatibilityAdapter, adapter_for_robot_type
from backend.app.services import audit_service, event_engine, workflow_engine
from backend.app.services.factory_seed import seed_factory
from backend.app.services.safety_engine import compute_eligible_assignment, validate_proposed_assignment

app = FastAPI(title="Seeknimbly PhysicalOS", version="2.0.0")
_lock = Lock()
_store: dict = seed_factory()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://frontend-zeta-beige-43.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def preserve_rewritten_path(request, call_next):
    """Undo Vercel's internal function prefix while retaining the requested route."""
    prefix = "/api/index"
    if request.scope["path"].startswith(prefix):
        request.scope["path"] = request.scope["path"][len(prefix) :] or "/"
    return await call_next(request)


class ProposalIn(BaseModel):
    model_config = {"extra": "ignore"}

    order_id: str
    worker_id: int
    robot_id: str
    source: str
    rationale: str
    model: str | None = None
    machine_id: str | None = None
    inference_request_id: str | None = None
    workflow_id: str | None = None
    idempotency_key: str | None = None


class DecisionIn(BaseModel):
    approve: bool
    idempotency_key: str | None = None


class ReplayIn(BaseModel):
    udi: int | None = None
    scenario: str = "machine_degradation"


class ImportIn(BaseModel):
    dataset_id: str = "uci-ai4i-2020"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _reset_store() -> None:
    global _store
    _store = seed_factory()
    settings.reload()


def _html_home() -> str:
    html_path = Path(__file__).resolve().parents[2] / "api" / "index.html"
    if html_path.exists():
        return html_path.read_text(encoding="utf-8")
    return "<html><body><h1>Seeknimbly PhysicalOS</h1><p>API online. Open the Next.js frontend on port 3000.</p></body></html>"


def _kpis(connection) -> dict:
    pending = connection.execute("SELECT COUNT(*) AS c FROM proposals WHERE status='pending'").fetchone()["c"]
    completed = connection.execute("SELECT COUNT(*) AS c FROM executions WHERE status='completed'").fetchone()["c"]
    active_orders = sum(1 for item in _store["orders"] if str(item.get("status", "")).lower() in {"active", "exception", "queued"})
    available_workers = sum(1 for item in _store["workers"] if item.get("available"))
    operational_machines = sum(
        1 for item in _store["machines"] if str(item.get("status", "")).lower() in {"available", "idle", "running", "simulated"}
    )
    available_robots = sum(1 for item in _store["robots"] if item.get("available"))
    active_exceptions = sum(1 for item in _store["events"] if str(item.get("severity", "")).lower() in {"critical", "high", "warning"})
    return {
        "active_work_orders": {"label": "Active work orders", "value": active_orders},
        "available_workers": {"label": "Available workers", "value": available_workers},
        "operational_machines": {"label": "Operational machines", "value": operational_machines},
        "available_robots": {"label": "Available robots", "value": available_robots},
        "pending_approvals": {"label": "Pending approvals", "value": pending},
        "active_exceptions": {"label": "Active exceptions", "value": active_exceptions},
        "completed_simulated_tasks": {"label": "Completed simulated tasks", "value": completed},
        "nebius_inference_status": {
            "label": "Nebius inference",
            "value": "verified" if _store.get("inference_verified") else ("configured" if settings.ai_configured else "rules"),
        },
    }


def _recommendation_payload(order_id: str) -> dict:
    order, worker, machine, robot, evidence = compute_eligible_assignment(_store, order_id)
    ai = nebius.explain_assignment(order, worker, machine, robot)
    if ai:
        source = "nebius_token_factory"
        rationale = ai["rationale"]
        model = ai["model"]
        request_id = ai.get("request_id")
        explanation_kind = "ai"
    else:
        source = "rules"
        rationale = (
            "Deterministic rules fallback: the safety engine selected this assignment without Nebius inference. "
            "This sentence is not an AI-generated explanation and it is not an authorization to execute."
        )
        model = None
        request_id = None
        explanation_kind = "deterministic_rules_fallback"
    return {
        "order_id": order["id"],
        "worker_id": worker["id"],
        "robot_id": robot["id"],
        "machine_id": machine["id"],
        "source": source,
        "rationale": rationale,
        "explanation": rationale,
        "model": model,
        "inference_request_id": request_id,
        "explanation_kind": explanation_kind,
        "safety_checks": evidence.checks,
        "validation": {"passed": evidence.passed, "evidence": evidence.checks},
    }


@app.get("/", response_class=HTMLResponse)
def home() -> str:
    return _html_home()


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "ai_configured": settings.ai_configured,
        "model": settings.nebius_model if settings.ai_configured else None,
        "environment": settings.app_env,
        "simulation_mode": True,
        "nebius_status": {
            "configured": settings.ai_configured,
            "verified": bool(_store.get("inference_verified")),
            "model": settings.nebius_model if settings.ai_configured else None,
            "status": "verified" if _store.get("inference_verified") else ("configured" if settings.ai_configured else "unconfigured"),
        },
    }


@app.get("/api/state")
def state() -> dict:
    with connect() as connection:
        kpis = _kpis(connection)
    return {
        "workers": _store["workers"],
        "orders": _store["orders"],
        "robots": _store["robots"],
        "machines": _store["machines"],
        "events": _store["events"],
        "kpis": kpis,
        "nebius_status": {
            "configured": settings.ai_configured,
            "verified": bool(_store.get("inference_verified")),
            "status": "verified" if _store.get("inference_verified") else ("configured" if settings.ai_configured else "unconfigured"),
        },
        "adapters": {key: adapter.discover() for key, adapter in ADAPTERS.items()},
        "ros2": Ros2CompatibilityAdapter().discover(),
    }


@app.get("/api/recommend/{order_id}")
def recommend(order_id: str) -> dict:
    with _lock:
        payload = _recommendation_payload(order_id)
        with connect() as connection:
            audit_service.write_audit(
                connection,
                action="recommendation_generated",
                detail={"order_id": order_id, "source": payload["source"], "machine_id": payload["machine_id"]},
                actor="safety_engine",
                resource_type="work_order",
                resource_id=order_id,
                model=payload.get("model"),
                inference_request_id=payload.get("inference_request_id"),
            )
            if payload["source"] == "nebius_token_factory":
                audit_service.write_audit(
                    connection,
                    action="ai_inference_success",
                    detail={"order_id": order_id},
                    actor="nebius",
                    model=payload.get("model"),
                    inference_request_id=payload.get("inference_request_id"),
                )
            connection.commit()
        return payload


@app.get("/api/inference/test")
def inference_test() -> dict:
    # Credentials first so a post-dispatch factory state cannot mask a missing Nebius key as 409.
    if not settings.ai_configured:
        raise HTTPException(status_code=503, detail="Set NEBIUS_API_KEY and NEBIUS_MODEL")
    with _lock:
        try:
            order, worker, machine, robot, _evidence = compute_eligible_assignment(_store, "O1")
        except HTTPException:
            order = next(item for item in _store["orders"] if item["id"] == "O1")
            worker = next(item for item in _store["workers"] if item["id"] == 1)
            machine = next(item for item in _store["machines"] if item["id"] == "M-CNC-02")
            robot = next(item for item in _store["robots"] if item["id"] == "R1")
        result = nebius.test_inference(order, worker, machine, robot)
        _store["inference_verified"] = True
        with connect() as connection:
            audit_service.write_audit(
                connection,
                action="ai_inference_verified",
                detail={"endpoint": "/api/inference/test"},
                actor="nebius",
                model=result.get("model"),
                inference_request_id=result.get("request_id"),
            )
            connection.commit()
        return result


@app.post("/api/proposals", status_code=201)
def create_proposal(proposal: ProposalIn, _: None = Depends(require_demo_auth)) -> dict:
    with _lock, connect() as connection:
        if proposal.idempotency_key:
            existing = connection.execute(
                "SELECT * FROM proposals WHERE idempotency_key=?",
                (proposal.idempotency_key,),
            ).fetchone()
            if existing:
                return {"id": existing["id"], "status": existing["status"], "workflow_id": existing["workflow_id"]}

        order, worker, machine, robot, evidence = validate_proposed_assignment(
            _store,
            order_id=proposal.order_id,
            worker_id=proposal.worker_id,
            robot_id=proposal.robot_id,
            machine_id=proposal.machine_id,
        )
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=settings.proposal_ttl_seconds)).isoformat()
        workflow_id = proposal.workflow_id
        if not workflow_id:
            wf = workflow_engine.create_workflow(
                connection,
                order_id=order["id"],
                event_id=f"manual_{uuid.uuid4().hex[:8]}",
                machine_id=machine["id"],
            )
            workflow_id = wf["id"]

        current = workflow_engine.get_workflow(connection, workflow_id)["state"]
        pending_states: list[str] = []
        if current == "EVENT_DETECTED":
            pending_states.append("CONTEXT_RESOLVED")
            current = "CONTEXT_RESOLVED"
        if current == "CONTEXT_RESOLVED":
            pending_states.append("SAFETY_VALIDATED")
            current = "SAFETY_VALIDATED"
        if current == "SAFETY_VALIDATED":
            if proposal.source == "nebius_token_factory":
                pending_states.append("AI_EXPLAINED")
                current = "AI_EXPLAINED"
            else:
                pending_states.append("APPROVAL_PENDING")
                current = "APPROVAL_PENDING"
        if current == "AI_EXPLAINED":
            pending_states.append("APPROVAL_PENDING")
        if pending_states:
            workflow_engine.advance_many(connection, workflow_id, pending_states, actor="proposal_service")

        cursor = connection.execute(
            """
            INSERT INTO proposals(order_id, worker_id, robot_id, machine_id, source, rationale, model, inference_request_id, workflow_id, status, idempotency_key, created_at, expires_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                proposal.order_id,
                proposal.worker_id,
                proposal.robot_id,
                machine["id"],
                proposal.source,
                proposal.rationale,
                proposal.model,
                proposal.inference_request_id,
                workflow_id,
                "pending",
                proposal.idempotency_key,
                _now(),
                expires_at,
            ),
        )
        proposal_id = cursor.lastrowid
        connection.execute("UPDATE workflows SET proposal_id=? WHERE id=?", (proposal_id, workflow_id))
        audit_service.write_audit(
            connection,
            action="proposal_created",
            detail={"id": proposal_id, "order_id": proposal.order_id, "evidence": evidence.checks},
            actor="supervisor_api",
            resource_type="proposal",
            resource_id=str(proposal_id),
            new_state="pending",
            model=proposal.model,
            inference_request_id=proposal.inference_request_id,
        )
        connection.commit()
        return {"id": proposal_id, "status": "pending", "workflow_id": workflow_id}


@app.get("/api/proposals")
def proposals() -> list[dict]:
    with connect() as connection:
        return [dict(row) for row in connection.execute("SELECT * FROM proposals ORDER BY id DESC")]


@app.post("/api/proposals/{proposal_id}/decision")
def decision(proposal_id: int, decision_in: DecisionIn, _: None = Depends(require_demo_auth)) -> dict:
    with _lock, connect() as connection:
        existing = connection.execute("SELECT * FROM proposals WHERE id=?", (proposal_id,)).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="Unknown proposal")
        if existing["status"] != "pending":
            raise HTTPException(status_code=409, detail="Proposal already decided")

        expires_at = existing["expires_at"] if "expires_at" in existing.keys() else None
        validate_proposed_assignment(
            _store,
            order_id=existing["order_id"],
            worker_id=existing["worker_id"],
            robot_id=existing["robot_id"],
            machine_id=existing["machine_id"],
            expires_at=expires_at,
        )

        status = "approved" if decision_in.approve else "rejected"
        now = _now()
        connection.execute(
            "UPDATE proposals SET status=?, decided_at=? WHERE id=? AND status='pending'",
            (status, now, proposal_id),
        )
        changed = connection.execute("SELECT changes()").fetchone()[0]
        if changed != 1:
            raise HTTPException(status_code=409, detail="Proposal already decided")

        workflow_id = existing["workflow_id"]
        if workflow_id:
            target = "APPROVED" if decision_in.approve else "REJECTED"
            workflow_engine.transition(connection, workflow_id, target, actor="supervisor", proposal_id=proposal_id)

        audit_service.write_audit(
            connection,
            action=f"proposal_{status}",
            detail={"id": proposal_id},
            actor="supervisor",
            resource_type="proposal",
            resource_id=str(proposal_id),
            previous_state="pending",
            new_state=status,
        )
        connection.commit()
        return {"id": proposal_id, "status": status, "workflow_id": workflow_id}


@app.get("/api/audit")
def audit() -> list[dict]:
    with connect() as connection:
        return audit_service.list_audit(connection)


@app.get("/api/datasets")
def datasets() -> list[dict]:
    return ai4i.dataset_catalog(_store)


@app.post("/api/datasets/import")
def import_dataset(body: ImportIn = ImportIn(), _: None = Depends(require_demo_auth)) -> dict:
    with _lock, connect() as connection:
        meta = ai4i.import_dataset(_store)
        audit_service.write_audit(
            connection,
            action="dataset_imported",
            detail={"dataset_id": meta.get("id"), "row_count": meta.get("row_count"), "status": meta.get("status")},
            actor="data_engine",
            resource_type="dataset",
            resource_id=str(meta.get("id")),
        )
        connection.commit()
        return meta


@app.get("/api/machines")
def machines() -> list[dict]:
    return _store["machines"]


@app.get("/api/robots")
def robots() -> list[dict]:
    return _store["robots"]


@app.get("/api/events")
def events() -> list[dict]:
    return _store["events"]


@app.post("/api/events/replay")
def replay_event(body: ReplayIn = ReplayIn(), _: None = Depends(require_demo_auth)) -> dict:
    with _lock, connect() as connection:
        if body.scenario == "robot_unavailable":
            result = event_engine.mark_material_robot_unavailable(_store, connection)
            audit_service.write_audit(
                connection,
                action="event_replayed",
                detail={"scenario": "robot_unavailable", "robot_id": "R1", "order_id": "O1"},
                actor="event_engine",
                resource_type="robot",
                resource_id="R1",
            )
            connection.commit()
            return result
        if body.scenario != "machine_degradation":
            raise HTTPException(status_code=400, detail="Unknown replay scenario")
        if not ai4i.csv_available():
            raise HTTPException(status_code=503, detail="AI4I CSV missing. Place file at data/raw/ai4i2020.csv or run import after download.")
        if not _store.get("datasets"):
            ai4i.import_dataset(_store)
        result = event_engine.replay_machine_health(_store, connection, body.udi)
        audit_service.write_audit(
            connection,
            action="event_replayed",
            detail={"udi": result["udi"], "machine_id": result["machine_id"], "order_id": result["order_id"]},
            actor="event_engine",
            resource_type="event",
            resource_id=result["event"]["id"],
            new_state="CONTEXT_RESOLVED",
            evidence_ref=result["dataset"],
        )
        connection.commit()
        return result


@app.get("/api/workflows")
def workflows() -> list[dict]:
    with connect() as connection:
        return workflow_engine.list_workflows(connection)


@app.get("/api/workflows/{workflow_id}")
def workflow(workflow_id: str) -> dict:
    with connect() as connection:
        return workflow_engine.get_workflow(connection, workflow_id)


@app.post("/api/workflows/{workflow_id}/simulate")
def simulate_workflow(workflow_id: str, _: None = Depends(require_demo_auth)) -> dict:
    with _lock, connect() as connection:
        wf = workflow_engine.get_workflow(connection, workflow_id)
        if wf["state"] != "APPROVED":
            raise HTTPException(status_code=409, detail=f"Workflow must be APPROVED before simulation (current={wf['state']})")

        proposal_id = wf.get("proposal_id")
        if not proposal_id:
            raise HTTPException(status_code=409, detail="Workflow has no linked proposal")
        proposal = connection.execute("SELECT * FROM proposals WHERE id=?", (proposal_id,)).fetchone()
        if proposal is None:
            raise HTTPException(status_code=404, detail="Linked proposal missing")

        # Revalidate immediately before dispatch.
        order, worker, machine, robot, evidence = validate_proposed_assignment(
            _store,
            order_id=proposal["order_id"],
            worker_id=proposal["worker_id"],
            robot_id=proposal["robot_id"],
            machine_id=proposal["machine_id"],
            expires_at=proposal["expires_at"] if "expires_at" in proposal.keys() else None,
        )

        existing_exec = connection.execute(
            "SELECT * FROM executions WHERE workflow_id=? AND status IN ('running','completed','dispatched')",
            (workflow_id,),
        ).fetchone()
        if existing_exec:
            raise HTTPException(status_code=409, detail="Dispatch already recorded for this workflow")

        robot_adapter = adapter_for_robot_type(robot["type"])
        machine_adapter = ADAPTERS["machine"]
        task = {"id": f"task_{proposal_id}", "capability": robot["type"], "order_id": order["id"]}
        robot_dispatch = robot_adapter.dispatch(robot, task)
        machine_dispatch = machine_adapter.dispatch(machine, {"id": task["id"], "capability": machine["type"], "type": machine["type"]})

        workflow_engine.transition(connection, workflow_id, "SIMULATED_DISPATCH", actor="dispatch_engine")
        workflow_engine.transition(connection, workflow_id, "RUNNING", actor="dispatch_engine")

        steps = [
            {"id": "revalidate", "name": "Revalidate", "label": "Revalidate safety", "status": "completed", "detail": evidence.checks},
            {"id": "robot_dispatch", "name": "Robot", "label": robot_adapter.name, "status": robot_dispatch["status"]},
            {"id": "machine_dispatch", "name": "Machine", "label": machine_adapter.name, "status": machine_dispatch["status"]},
        ]

        if robot_dispatch["status"] == "failed" or machine_dispatch["status"] == "failed":
            workflow_engine.transition(connection, workflow_id, "EXECUTION_FAILED", actor="dispatch_engine")
            status = "failed"
            robot_final = robot_adapter.fail(robot_dispatch, robot_dispatch.get("detail", "failed"))
            machine_final = machine_adapter.fail(machine_dispatch, machine_dispatch.get("detail", "failed"))
        else:
            robot_final = robot_adapter.complete(robot_dispatch)
            machine_final = machine_adapter.complete(machine_dispatch)
            workflow_engine.transition(connection, workflow_id, "COMPLETED", actor="dispatch_engine")
            status = "completed"
            # Book resources for the completed simulated task and clear exception on order.
            _store["bookings"]["workers"][worker["id"]] = proposal_id
            _store["bookings"]["robots"][robot["id"]] = proposal_id
            _store["bookings"]["machines"][machine["id"]] = proposal_id
            worker["available"] = False
            worker["assigned_tasks"] = list(worker.get("assigned_tasks") or []) + [order["id"]]
            robot["available"] = False
            robot["status"] = "simulated"
            robot["assigned_tasks"] = list(robot.get("assigned_tasks") or []) + [order["id"]]
            machine["status"] = "simulated"
            machine["assigned_order_id"] = order["id"]
            order["status"] = "completed"
            order["machine_id"] = machine["id"]
            _store["completed_simulated_tasks"] = int(_store.get("completed_simulated_tasks") or 0) + 1

        steps.append({"id": "finalize", "name": "Finalize", "label": "Complete simulation", "status": status})
        execution_id = f"ex_{uuid.uuid4().hex[:10]}"
        now = _now()
        result = {
            "robot": robot_final,
            "machine": machine_final,
            "worker_id": worker["id"],
            "order_id": order["id"],
            "simulation": True,
        }
        connection.execute(
            """
            INSERT INTO executions(id, workflow_id, proposal_id, adapter, status, steps, summary, result, created_at, started_at, finished_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                execution_id,
                workflow_id,
                proposal_id,
                robot_adapter.name,
                status,
                json.dumps(steps),
                f"Simulated dispatch for {order['id']} via {robot_adapter.name}",
                json.dumps(result),
                now,
                now,
                now,
            ),
        )
        audit_service.write_audit(
            connection,
            action="simulated_dispatch" if status == "completed" else "execution_failed",
            detail={"execution_id": execution_id, "workflow_id": workflow_id, "proposal_id": proposal_id},
            actor="dispatch_engine",
            resource_type="execution",
            resource_id=execution_id,
            new_state=status,
        )
        connection.commit()
        return {
            "id": execution_id,
            "execution_id": execution_id,
            "execution": get_execution_row(connection, execution_id),
            "workflow_id": workflow_id,
            "status": status,
            "simulated": True,
        }


def get_execution_row(connection, execution_id: str) -> dict:
    row = connection.execute("SELECT * FROM executions WHERE id=?", (execution_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Unknown execution")
    item = dict(row)
    for key in ("steps", "result"):
        if item.get(key):
            try:
                item[key] = json.loads(item[key])
            except json.JSONDecodeError:
                pass
    item["simulated"] = True
    return item


@app.get("/api/executions")
def executions() -> list[dict]:
    with connect() as connection:
        rows = connection.execute("SELECT * FROM executions ORDER BY created_at DESC").fetchall()
        results = []
        for row in rows:
            item = dict(row)
            for key in ("steps", "result"):
                if item.get(key):
                    try:
                        item[key] = json.loads(item[key])
                    except json.JSONDecodeError:
                        pass
            item["simulated"] = True
            results.append(item)
        return results


@app.get("/api/executions/{execution_id}")
def execution(execution_id: str) -> dict:
    with connect() as connection:
        return get_execution_row(connection, execution_id)


@app.post("/api/demo/reset")
def demo_reset(_: None = Depends(require_demo_auth)) -> dict:
    with _lock, connect() as connection:
        connection.execute("DELETE FROM proposals")
        connection.execute("DELETE FROM audit")
        connection.execute("DELETE FROM workflows")
        connection.execute("DELETE FROM executions")
        connection.execute("DELETE FROM datasets")
        connection.commit()
        _reset_store()
        ai4i.import_dataset(_store)
        audit_service.write_audit(connection, action="demo_reset", detail={"ok": True}, actor="demo")
        connection.commit()
        return {"status": "reset", "workers": len(_store["workers"]), "orders": len(_store["orders"]), "robots": len(_store["robots"]), "machines": len(_store["machines"])}


def reset_runtime_for_tests() -> None:
    """Test helper to reinitialize in-memory state after module reload."""
    with _lock:
        _reset_store()
