from __future__ import annotations

import logging
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.config import HTML_PATH, admin_token, ai_configured, app_env, demo_mode, nebius_model
from backend.app.db.session import sessions
from backend.app.domain.safety import select_assignment
from backend.app.services.operations import (
    build_world,
    create_proposal_record,
    dataset_views,
    decide_proposal,
    explain_validated,
    factory_state,
    get_execution,
    get_workflow,
    import_ai4i,
    list_audit,
    list_executions,
    list_proposals,
    list_workflows,
    recommend_order,
    replay_event,
    reset_demo,
    simulate_workflow,
)

logger = logging.getLogger("physicalos.api")
router = APIRouter()
_buckets: dict[str, list[float]] = {}


class ProposalIn(BaseModel):
    order_id: str
    worker_id: int
    robot_id: str
    source: str
    rationale: str
    model: str | None = None
    machine_id: str | None = None
    inference_request_id: str | None = None


class DecisionIn(BaseModel):
    approve: bool
    idempotency_key: str | None = None


class ReplayIn(BaseModel):
    scenario: str = "machine_degradation"
    udi: int | None = None


class ImportIn(BaseModel):
    dataset_id: str = "ai4i2020"


class SimulateIn(BaseModel):
    outcome: str = "success"
    idempotency_key: str | None = None


def db_session():
    yield from sessions()


def _limit(request: Request) -> None:
    host = request.client.host if request.client else "unknown"
    now = time.monotonic()
    bucket = [stamp for stamp in _buckets.get(host, []) if now - stamp < 60]
    if len(bucket) >= 240:
        raise HTTPException(429, "Rate limit exceeded")
    bucket.append(now)
    _buckets[host] = bucket


def actor(request: Request) -> str:
    _limit(request)
    expected = admin_token()
    provided = request.headers.get("x-demo-admin-token", "")
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        provided = provided or authorization[7:].strip()
    if expected:
        if not provided or not secrets.compare_digest(provided, expected):
            raise HTTPException(401, "Demo admin token required")
        return "demo-supervisor"
    if demo_mode():
        return "demo-supervisor"
    raise HTTPException(401, "Mutating endpoints are disabled")


def idempotency_key(request: Request, body_key: str | None) -> str | None:
    header = request.headers.get("idempotency-key")
    key = (header or body_key or "").strip()
    return key or None


@router.get("/", response_class=HTMLResponse)
def home() -> str:
    return HTML_PATH.read_text(encoding="utf-8")


@router.get("/api/health")
def health() -> dict:
    configured = ai_configured()
    return {
        "status": "ok",
        "ai_configured": configured,
        "model": nebius_model(),
        "environment": app_env(),
        "simulation_mode": True,
        "nebius_status": "configured" if configured else "not_configured",
        "auth_required": bool(admin_token()),
    }


@router.get("/api/state")
def state(db: Session = Depends(db_session)) -> dict:
    return factory_state(db)


@router.get("/api/recommend/{order_id}")
def recommend(order_id: str, db: Session = Depends(db_session)) -> dict:
    return recommend_order(db, order_id, "demo-supervisor")


@router.get("/api/inference/test")
def inference_test(db: Session = Depends(db_session)) -> dict:
    if not ai_configured():
        raise HTTPException(503, "Set NEBIUS_API_KEY and NEBIUS_MODEL")
    assignment, _checks = select_assignment(build_world(db), "O1")
    result = explain_validated(assignment)
    if not result:
        raise HTTPException(502, "Nebius inference did not return a verified result")
    return {
        "verified": True,
        "provider": "Nebius Token Factory",
        "rationale": result["explanation"],
        "model": result["model"],
        "request_id": result["request_id"],
        **result,
    }


@router.get("/api/proposals")
def proposals(db: Session = Depends(db_session)) -> list[dict]:
    return list_proposals(db)


@router.post("/api/proposals", status_code=201)
def create_proposal(body: ProposalIn, request: Request, db: Session = Depends(db_session), supervisor: str = Depends(actor)) -> dict:
    return create_proposal_record(db, body, supervisor)


@router.post("/api/proposals/{proposal_id}/decision")
def decision(
    proposal_id: int,
    body: DecisionIn,
    request: Request,
    db: Session = Depends(db_session),
    supervisor: str = Depends(actor),
) -> dict:
    return decide_proposal(db, proposal_id, body.approve, supervisor, idempotency_key(request, body.idempotency_key))


@router.get("/api/audit")
def audit(db: Session = Depends(db_session)) -> list[dict]:
    return list_audit(db)


@router.get("/api/datasets")
def datasets(db: Session = Depends(db_session)) -> list[dict]:
    return dataset_views(db)


@router.post("/api/datasets/import")
def import_dataset(body: ImportIn, db: Session = Depends(db_session), supervisor: str = Depends(actor)) -> dict:
    return import_ai4i(db, supervisor, body.dataset_id)


@router.get("/api/machines")
def machines(db: Session = Depends(db_session)) -> list[dict]:
    return factory_state(db)["machines"]


@router.get("/api/robots")
def robots(db: Session = Depends(db_session)) -> list[dict]:
    return factory_state(db)["robots"]


@router.get("/api/events")
def events(db: Session = Depends(db_session)) -> list[dict]:
    return factory_state(db)["events"]


@router.post("/api/events/replay")
def replay(body: ReplayIn, db: Session = Depends(db_session), supervisor: str = Depends(actor)) -> dict:
    if body.scenario not in {"machine_degradation", "robot_unavailable"}:
        raise HTTPException(400, "Unknown replay scenario")
    return replay_event(db, supervisor, body.scenario, body.udi)


@router.get("/api/workflows")
def workflows(db: Session = Depends(db_session)) -> list[dict]:
    return list_workflows(db)


@router.get("/api/workflows/{workflow_id}")
def workflow_detail(workflow_id: int, db: Session = Depends(db_session)) -> dict:
    return get_workflow(db, workflow_id)


@router.post("/api/workflows/{workflow_id}/simulate")
def simulate(
    workflow_id: int,
    request: Request,
    body: SimulateIn = SimulateIn(),
    db: Session = Depends(db_session),
    supervisor: str = Depends(actor),
) -> dict:
    if body.outcome not in {"success", "failure"}:
        raise HTTPException(400, "outcome must be success or failure")
    return simulate_workflow(db, workflow_id, supervisor, body.outcome, idempotency_key(request, body.idempotency_key))


@router.get("/api/executions")
def executions(db: Session = Depends(db_session)) -> list[dict]:
    return list_executions(db)


@router.get("/api/executions/{execution_id}")
def execution_detail(execution_id: int, db: Session = Depends(db_session)) -> dict:
    return get_execution(db, execution_id)


@router.post("/api/demo/reset")
def demo_reset(db: Session = Depends(db_session), supervisor: str = Depends(actor)) -> dict:
    logger.info("demo reset by %s", supervisor)
    return reset_demo(db, supervisor)
