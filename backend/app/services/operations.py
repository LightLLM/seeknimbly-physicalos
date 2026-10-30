"""Workflow, audit, replay, and dispatch. Route handlers stay thin."""

from __future__ import annotations

import json
from datetime import datetime
from urllib.parse import urlparse

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.core.config import (
    RULES_FALLBACK,
    TIE_BREAK,
    ai_configured,
    iso,
    nebius_base_url,
    proposal_ttl,
    require_ai,
    utcnow,
)
from backend.app.db.models import (
    AuditEvent,
    DatasetImport,
    Execution,
    OperationalEvent,
    Proposal,
    ResourceState,
    Workflow,
    WorkflowTransition,
)
from backend.app.db.session import reset_state
from backend.app.domain.catalog import (
    AFFECTED_ORDER_ID,
    ALLOWED_TRANSITIONS,
    MACHINES,
    ORDERS,
    ROBOTS,
    TARGET_MACHINE_ID,
    TERMINAL_STATES,
    UNAVAILABLE_ROBOT_ID,
    WORKERS,
)
from backend.app.domain.safety import SafetyError, World, select_assignment
from backend.app.integrations.datasets.ai4i import csv_available, failure_modes, first_failure, load_rows, row_by_udi
from backend.app.integrations.nebius import explain_assignment
from backend.app.integrations.robotics.adapters import SimulatedMachineAdapter, adapter_for_robot_type


def explain_validated(assignment: dict) -> dict | None:
    if require_ai() and not ai_configured():
        raise HTTPException(503, "Nebius credentials are required")
    if ai_configured():
        host = (urlparse(nebius_base_url()).hostname or "").lower()
        if "openai.com" in host or ("nebius" not in host and "tokenfactory" not in host):
            raise HTTPException(502, "Inference host is not Nebius Token Factory")
    return explain_assignment(
        {"id": assignment["order_id"], "task": assignment["task"]},
        {"name": assignment["worker_name"], "skills": [assignment["skill"]], "id": assignment["worker_id"]},
        {"id": assignment["machine_id"], "type": assignment["skill"]},
        {"id": assignment["robot_id"], "type": assignment["robot_type"]},
    )


def _run_simulation(assignment: dict, outcome: str) -> dict:
    machine = SimulatedMachineAdapter()
    robot = adapter_for_robot_type(assignment["robot_type"])
    capability = assignment["skill"]
    machine_resource = {
        "id": assignment["machine_id"],
        "status": "operational",
        "available": True,
        "capabilities": [capability],
        "type": capability,
    }
    robot_resource = {
        "id": assignment["robot_id"],
        "status": "available",
        "available": True,
        "capabilities": [assignment["robot_type"]],
        "type": assignment["robot_type"],
    }
    machine_task = {"id": assignment["order_id"], "capability": capability, "type": capability}
    robot_task = {"id": assignment["order_id"], "capability": assignment["robot_type"], "type": assignment["robot_type"]}
    machine_step = machine.dispatch(machine_resource, machine_task)
    if outcome == "failure":
        failed = robot.fail(robot.dispatch(robot_resource, robot_task), "simulated_adapter_failure")
        return {"status": "failed", "simulated": True, "adapters": [machine.name, robot.name], "steps": [machine_step, failed]}
    robot_step = robot.dispatch(robot_resource, robot_task)
    return {
        "status": "completed",
        "simulated": True,
        "adapters": [machine.name, robot.name],
        "steps": [machine_step, machine.complete(machine_step), robot_step, robot.complete(robot_step)],
    }


def write_audit(
    db: Session,
    *,
    action: str,
    actor: str,
    resource: str | None = None,
    previous: str | None = None,
    new: str | None = None,
    evidence: str | None = None,
    model: str | None = None,
    detail: dict | None = None,
) -> None:
    db.add(
        AuditEvent(
            action=action,
            detail=json.dumps(detail or {}),
            created_at=iso(),
            actor=actor,
            resource=resource,
            previous_state=previous,
            new_state=new,
            evidence_ref=evidence,
            model=model,
        )
    )


def _status_map(db: Session) -> dict[tuple[str, str], str]:
    return {(row.kind, row.resource_id): row.status for row in db.query(ResourceState).all()}


def set_status(db: Session, kind: str, resource_id: str | int, status: str) -> None:
    row = db.get(ResourceState, (kind, str(resource_id)))
    if row is None:
        raise HTTPException(404, f"Unknown {kind} {resource_id}")
    row.status = status


def occupied_resources(db: Session, ignore_proposal_id: int | None = None) -> set[tuple[str, str]]:
    occupied: set[tuple[str, str]] = set()
    executions = {item.proposal_id: item for item in db.query(Execution).all()}
    proposals = db.query(Proposal).filter(Proposal.status.in_(("pending", "approved"))).all()
    for proposal in proposals:
        if proposal.id == ignore_proposal_id:
            continue
        if proposal.status == "approved":
            execution = executions.get(proposal.id)
            if execution is not None and execution.status in {"completed", "failed", "cancelled"}:
                continue
        occupied.add(("worker", str(proposal.worker_id)))
        occupied.add(("robot", proposal.robot_id))
        if proposal.machine_id:
            occupied.add(("machine", proposal.machine_id))
    return occupied


def build_world(db: Session, ignore_proposal_id: int | None = None) -> World:
    statuses = _status_map(db)
    occupied = occupied_resources(db, ignore_proposal_id)
    workers = []
    for worker in WORKERS:
        status = statuses.get(("worker", str(worker["id"])), "unavailable")
        workers.append(
            {
                **worker,
                "certifications": list(worker["certifications"]),
                "status": status,
                "available": status == "available" and worker["on_shift"],
            }
        )
    orders = []
    for order in ORDERS:
        orders.append({**order, "depends_on": list(order["depends_on"]), "status": statuses.get(("order", order["id"]), order["status"])})
    robots = []
    for robot in ROBOTS:
        status = statuses.get(("robot", robot["id"]), "unavailable")
        robots.append({**robot, "status": status, "available": status == "available"})
    machines = []
    for machine in MACHINES:
        machines.append({**machine, "status": statuses.get(("machine", machine["id"]), machine["status"])})
    return World(workers=workers, orders=orders, robots=robots, machines=machines, occupied=occupied)


def transition(
    db: Session,
    workflow: Workflow,
    new_state: str,
    actor: str,
    *,
    audit_action: str | None = None,
    detail: dict | None = None,
    model: str | None = None,
) -> None:
    allowed = ALLOWED_TRANSITIONS.get(workflow.state, set())
    if new_state not in allowed:
        raise HTTPException(409, f"Illegal workflow transition {workflow.state} -> {new_state}")
    previous = workflow.state
    workflow.state = new_state
    workflow.updated_at = iso()
    db.add(
        WorkflowTransition(
            workflow_id=workflow.id,
            previous_state=previous,
            new_state=new_state,
            actor=actor,
            evidence_ref=None,
            created_at=workflow.updated_at,
        )
    )
    if audit_action:
        write_audit(
            db,
            action=audit_action,
            actor=actor,
            resource=f"workflow:{workflow.id}",
            previous=previous,
            new=new_state,
            model=model,
            detail=detail,
        )


def _open_workflow(db: Session, order_id: str) -> Workflow | None:
    rows = db.query(Workflow).filter(Workflow.order_id == order_id).order_by(Workflow.id.desc()).all()
    return next((row for row in rows if row.state not in TERMINAL_STATES), None)


def _create_workflow(db: Session, order_id: str, origin: str, event_id: int | None = None) -> Workflow:
    now = iso()
    workflow = Workflow(
        order_id=order_id,
        state="EVENT_DETECTED",
        origin=origin,
        event_id=event_id,
        proposal_id=None,
        context_json="{}",
        created_at=now,
        updated_at=now,
    )
    db.add(workflow)
    db.flush()
    return workflow


def _read_context(workflow: Workflow) -> dict:
    try:
        value = json.loads(workflow.context_json or "{}")
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def _fail_validation(db: Session, workflow: Workflow, actor: str, exc: SafetyError) -> None:
    if workflow.state == "CONTEXT_RESOLVED":
        transition(
            db,
            workflow,
            "VALIDATION_FAILED",
            actor,
            audit_action="validation_failed",
            detail={"message": str(exc), "checks": exc.checks},
        )
    else:
        write_audit(
            db,
            action="validation_failed",
            actor=actor,
            resource=f"workflow:{workflow.id}",
            detail={"message": str(exc), "checks": exc.checks},
        )
    db.commit()


def recommend_order(db: Session, order_id: str, actor: str) -> dict:
    world = build_world(db)
    if not any(order["id"] == order_id for order in world.orders):
        raise HTTPException(404, "Unknown order")
    workflow = _open_workflow(db, order_id)
    if workflow is None:
        workflow = _create_workflow(db, order_id, "direct_recommendation")
        transition(db, workflow, "CONTEXT_RESOLVED", actor)
    elif workflow.state == "EVENT_DETECTED":
        transition(db, workflow, "CONTEXT_RESOLVED", actor)
    if workflow.state in TERMINAL_STATES:
        raise HTTPException(409, f"Cannot recommend from state {workflow.state}")

    try:
        assignment, checks = select_assignment(world, order_id)
    except SafetyError as exc:
        _fail_validation(db, workflow, actor, exc)
        raise HTTPException(exc.status_code, str(exc)) from exc

    if workflow.state == "CONTEXT_RESOLVED":
        transition(
            db,
            workflow,
            "SAFETY_VALIDATED",
            actor,
            audit_action="safety_validated",
            detail={"checks": checks, "assignment": assignment},
        )
    elif workflow.state not in {"SAFETY_VALIDATED", "AI_EXPLAINED", "APPROVAL_PENDING"}:
        raise HTTPException(409, f"Cannot recommend from state {workflow.state}")

    ai = explain_validated(assignment)
    if ai is None:
        source = "rules"
        rationale = RULES_FALLBACK
        model = None
        request_id = None
        inference = {
            "source": "deterministic_rules_fallback",
            "model": None,
            "explanation": RULES_FALLBACK,
            "request_id": None,
        }
    else:
        source = "nebius_token_factory"
        rationale = ai["explanation"]
        model = ai["model"]
        request_id = ai["request_id"]
        inference = ai

    context = _read_context(workflow)
    context["assignment"] = assignment
    context["checks"] = checks
    context["inference"] = inference
    workflow.context_json = json.dumps(context)

    if workflow.state == "SAFETY_VALIDATED":
        transition(db, workflow, "AI_EXPLAINED", actor)
        transition(
            db,
            workflow,
            "APPROVAL_PENDING",
            actor,
            audit_action="explanation_recorded",
            model=model,
            detail={"source": inference["source"], "request_id": request_id},
        )
    elif workflow.state == "AI_EXPLAINED":
        transition(
            db,
            workflow,
            "APPROVAL_PENDING",
            actor,
            audit_action="explanation_recorded",
            model=model,
            detail={"source": inference["source"], "request_id": request_id},
        )
    else:
        write_audit(
            db,
            action="explanation_recorded",
            actor=actor,
            resource=f"workflow:{workflow.id}",
            model=model,
            detail={"source": inference["source"], "request_id": request_id},
        )
    db.commit()
    return {
        "order_id": assignment["order_id"],
        "worker_id": assignment["worker_id"],
        "robot_id": assignment["robot_id"],
        "machine_id": assignment["machine_id"],
        "source": source,
        "rationale": rationale,
        "explanation": rationale,
        "model": model,
        "inference_request_id": request_id,
        "inference": inference,
        "safety_checks": checks,
        "workflow_id": workflow.id,
        "tie_break": TIE_BREAK,
    }


def create_proposal_record(db: Session, body, actor: str) -> dict:
    existing = (
        db.query(Proposal).filter(Proposal.order_id == body.order_id, Proposal.status == "pending").one_or_none()
    )
    if existing is not None:
        raise HTTPException(409, "Open proposal already exists for this order")
    world = build_world(db)
    try:
        assignment, checks = select_assignment(world, body.order_id)
    except SafetyError as exc:
        write_audit(db, action="validation_failed", actor=actor, resource=f"order:{body.order_id}", detail={"message": str(exc)})
        db.commit()
        raise HTTPException(exc.status_code, str(exc)) from exc
    machine_id = body.machine_id or assignment["machine_id"]
    matches = (
        assignment["worker_id"] == body.worker_id
        and assignment["robot_id"] == body.robot_id
        and assignment["machine_id"] == machine_id
    )
    if not matches:
        write_audit(
            db,
            action="validation_failed",
            actor=actor,
            resource=f"order:{body.order_id}",
            detail={"message": "proposal does not match computed assignment"},
        )
        db.commit()
        raise HTTPException(400, "Proposal does not match deterministic eligibility checks")

    workflow = _open_workflow(db, body.order_id)
    if workflow is None:
        workflow = _create_workflow(db, body.order_id, "proposal")
    for target in ("CONTEXT_RESOLVED", "SAFETY_VALIDATED", "AI_EXPLAINED", "APPROVAL_PENDING"):
        if workflow.state == target:
            continue
        allowed = ALLOWED_TRANSITIONS.get(workflow.state, set())
        if target in allowed and workflow.state != "APPROVAL_PENDING":
            transition(db, workflow, target, actor)
        if workflow.state == "APPROVAL_PENDING":
            break
    now = iso()
    proposal = Proposal(
        order_id=body.order_id,
        worker_id=body.worker_id,
        robot_id=body.robot_id,
        machine_id=assignment["machine_id"],
        source=body.source,
        rationale=body.rationale,
        model=body.model,
        request_id=getattr(body, "inference_request_id", None),
        status="pending",
        created_at=now,
        expires_at=(utcnow() + proposal_ttl()).isoformat(),
        workflow_id=workflow.id,
        evidence_json=json.dumps({"checks": checks, "tie_break": TIE_BREAK}),
    )
    db.add(proposal)
    db.flush()
    workflow.proposal_id = proposal.id
    write_audit(
        db,
        action="proposal_created",
        actor=actor,
        resource=f"proposal:{proposal.id}",
        new="pending",
        detail={"id": proposal.id, "order_id": proposal.order_id},
    )
    db.commit()
    return {"id": proposal.id, "status": "pending", "workflow_id": workflow.id}


def decide_proposal(db: Session, proposal_id: int, approve: bool, actor: str, idempotency_key: str | None) -> dict:
    proposal = db.get(Proposal, proposal_id)
    if proposal is None:
        raise HTTPException(404, "Unknown proposal")
    if idempotency_key and proposal.decision_key == idempotency_key and proposal.status != "pending":
        return {"id": proposal.id, "status": proposal.status, "workflow_id": proposal.workflow_id}
    if proposal.status == "pending" and proposal.expires_at:
        if datetime.fromisoformat(proposal.expires_at) <= utcnow():
            proposal.status = "expired"
            workflow = db.get(Workflow, proposal.workflow_id) if proposal.workflow_id else None
            if workflow is not None and workflow.state == "APPROVAL_PENDING":
                transition(db, workflow, "EXPIRED", actor, audit_action="proposal_expired", detail={"id": proposal.id})
            else:
                write_audit(db, action="proposal_expired", actor=actor, resource=f"proposal:{proposal.id}", new="expired")
            db.commit()
            raise HTTPException(409, "Proposal expired")
    if proposal.status != "pending":
        raise HTTPException(409, "Proposal already decided")

    if approve:
        world = build_world(db, ignore_proposal_id=proposal.id)
        try:
            assignment, _checks = select_assignment(world, proposal.order_id)
        except SafetyError as exc:
            proposal.status = "failed"
            db.commit()
            raise HTTPException(409, str(exc)) from exc
        if (
            assignment["worker_id"] != proposal.worker_id
            or assignment["robot_id"] != proposal.robot_id
            or assignment["machine_id"] != proposal.machine_id
        ):
            proposal.status = "failed"
            write_audit(db, action="validation_failed", actor=actor, resource=f"proposal:{proposal.id}", new="failed")
            db.commit()
            raise HTTPException(409, "Assignment no longer matches the safety engine")

    new_status = "approved" if approve else "rejected"
    proposal.status = new_status
    proposal.decided_at = iso()
    proposal.decision_key = idempotency_key
    workflow = db.get(Workflow, proposal.workflow_id) if proposal.workflow_id else None
    action = "proposal_approved" if approve else "proposal_rejected"
    target = "APPROVED" if approve else "REJECTED"
    if workflow is not None and workflow.state == "APPROVAL_PENDING":
        transition(db, workflow, target, actor, audit_action=action, detail={"id": proposal.id})
    else:
        write_audit(db, action=action, actor=actor, resource=f"proposal:{proposal.id}", new=new_status, detail={"id": proposal.id})
    db.commit()
    return {"id": proposal.id, "status": new_status, "workflow_id": proposal.workflow_id}


def simulate_workflow(db: Session, workflow_id: int, actor: str, outcome: str, idempotency_key: str | None) -> dict:
    if idempotency_key:
        existing = db.query(Execution).filter(Execution.idempotency_key == idempotency_key).one_or_none()
        if existing is not None:
            return _execution_dict(db, existing)
    workflow = db.get(Workflow, workflow_id)
    if workflow is None:
        raise HTTPException(404, "Unknown workflow")
    existing = db.query(Execution).filter(Execution.workflow_id == workflow.id).one_or_none()
    if existing is not None:
        raise HTTPException(409, "Workflow already dispatched")
    if workflow.state != "APPROVED":
        raise HTTPException(409, f"Illegal workflow transition {workflow.state} -> SIMULATED_DISPATCH")
    proposal = db.get(Proposal, workflow.proposal_id) if workflow.proposal_id else None
    if proposal is None or proposal.status != "approved":
        raise HTTPException(409, "Approved proposal required")

    world = build_world(db, ignore_proposal_id=proposal.id)
    try:
        assignment, _checks = select_assignment(world, workflow.order_id)
    except SafetyError as exc:
        transition(db, workflow, "EXECUTION_FAILED", actor, audit_action="execution_failed", detail={"message": str(exc)})
        db.commit()
        raise HTTPException(409, str(exc)) from exc
    if (
        assignment["worker_id"] != proposal.worker_id
        or assignment["robot_id"] != proposal.robot_id
        or assignment["machine_id"] != proposal.machine_id
    ):
        transition(db, workflow, "EXECUTION_FAILED", actor, audit_action="execution_failed", detail={"message": "assignment drift"})
        db.commit()
        raise HTTPException(409, "Assignment no longer matches the safety engine")

    result = _run_simulation(assignment, outcome)
    now = iso()
    execution = Execution(
        workflow_id=workflow.id,
        proposal_id=proposal.id,
        status="running",
        adapter=",".join(result["adapters"]),
        idempotency_key=idempotency_key,
        result_json=json.dumps(result),
        created_at=now,
        updated_at=now,
    )
    db.add(execution)
    db.flush()
    transition(db, workflow, "SIMULATED_DISPATCH", actor, audit_action="dispatch_started", detail={"execution_id": execution.id})
    transition(db, workflow, "RUNNING", actor)
    if result["status"] == "completed":
        transition(db, workflow, "COMPLETED", actor, audit_action="execution_completed", detail={"execution_id": execution.id})
        execution.status = "completed"
        set_status(db, "order", workflow.order_id, "completed")
    else:
        transition(db, workflow, "EXECUTION_FAILED", actor, audit_action="execution_failed", detail={"execution_id": execution.id})
        execution.status = "failed"
        proposal.status = "failed"
    execution.updated_at = iso()
    db.commit()
    return _execution_dict(db, execution)


def replay_event(db: Session, actor: str, scenario: str, udi: int | None) -> dict:
    if scenario == "robot_unavailable":
        event = OperationalEvent(
            event_type="robot_unavailable",
            severity="critical",
            machine_id=None,
            order_id=AFFECTED_ORDER_ID,
            source_udi=None,
            summary=(
                f"Simulated robot {UNAVAILABLE_ROBOT_ID} was marked unavailable. "
                "No alternate material-handling robot is seeded, so O1 cannot be dispatched."
            ),
            payload_json=json.dumps({"scenario": scenario, "live_sensor": False}),
            created_at=iso(),
        )
        db.add(event)
        db.flush()
        set_status(db, "robot", UNAVAILABLE_ROBOT_ID, "unavailable")
        set_status(db, "order", AFFECTED_ORDER_ID, "blocked")
        workflow = _open_workflow(db, AFFECTED_ORDER_ID) or _create_workflow(db, AFFECTED_ORDER_ID, scenario, event.id)
        workflow.event_id = event.id
        if workflow.state == "EVENT_DETECTED":
            transition(db, workflow, "CONTEXT_RESOLVED", actor, audit_action="event_replayed", detail={"event_id": event.id})
        else:
            write_audit(db, action="event_replayed", actor=actor, resource=f"event:{event.id}", detail={"event_id": event.id})
        db.commit()
        return {"event": _event_dict(event), "workflow_id": workflow.id, "affected_order_id": AFFECTED_ORDER_ID}

    if udi is None:
        row = first_failure()
    else:
        row = row_by_udi(udi)
    if row is None:
        raise HTTPException(404, "Requested UDI is not in the bundled AI4I file" if udi is not None else "AI4I file has no failure row")
    failed = int(row.get("machine_failure") or 0) == 1
    modes = failure_modes(row)
    event = OperationalEvent(
        event_type="machine_health_fault" if failed else "machine_health_observation",
        severity="critical" if failed else "info",
        machine_id=TARGET_MACHINE_ID if failed else None,
        order_id=AFFECTED_ORDER_ID if failed else None,
        source_udi=row.get("udi"),
        summary=(
            f"AI4I row UDI {row.get('udi')} ({row.get('product_id')}) Machine failure={row.get('machine_failure')}"
            + (f" modes={','.join(modes)}" if modes else "")
            + (
                f". Applied to simulated machine {TARGET_MACHINE_ID} and work order {AFFECTED_ORDER_ID}. Not a live sensor reading."
                if failed
                else ". Observation only; simulated machine state was not changed."
            )
        ),
        payload_json=json.dumps(
            {
                "live_sensor": False,
                "source_udi": row.get("udi"),
                "source_product_id": row.get("product_id"),
                "air_temperature_k": row.get("air_temperature_k"),
                "process_temperature_k": row.get("process_temperature_k"),
                "rotational_speed_rpm": row.get("rotational_speed_rpm"),
                "torque_nm": row.get("torque_nm"),
                "tool_wear_min": row.get("tool_wear_min"),
                "failure_modes": modes,
                "synthetic_machine_id": TARGET_MACHINE_ID if failed else None,
            }
        ),
        created_at=iso(),
    )
    db.add(event)
    db.flush()
    workflow = None
    if failed:
        set_status(db, "machine", TARGET_MACHINE_ID, "fault")
        set_status(db, "order", AFFECTED_ORDER_ID, "blocked")
        workflow = _open_workflow(db, AFFECTED_ORDER_ID) or _create_workflow(db, AFFECTED_ORDER_ID, "machine_degradation", event.id)
        workflow.event_id = event.id
        if workflow.state == "EVENT_DETECTED":
            transition(db, workflow, "CONTEXT_RESOLVED", actor, audit_action="event_replayed", detail={"event_id": event.id, "udi": row.get("udi")})
        else:
            write_audit(db, action="event_replayed", actor=actor, resource=f"event:{event.id}", detail={"udi": row.get("udi")})
    else:
        write_audit(db, action="event_replayed", actor=actor, resource=f"event:{event.id}", detail={"udi": row.get("udi"), "fault": False})
    db.commit()
    return {
        "event": _event_dict(event),
        "workflow_id": workflow.id if workflow else None,
        "affected_order_id": AFFECTED_ORDER_ID if failed else None,
        "source_udi": row.get("udi"),
    }


def import_ai4i(db: Session, actor: str, dataset_id: str) -> dict:
    if dataset_id != "ai4i2020":
        raise HTTPException(400, "Only the bundled ai4i2020 dataset can be imported")
    if not csv_available():
        raise HTTPException(404, "Bundled AI4I file is missing")
    rows = load_rows()
    record = DatasetImport(dataset_id=dataset_id, row_count=len(rows), status="imported", imported_at=iso())
    db.add(record)
    write_audit(db, action="dataset_imported", actor=actor, resource="dataset:ai4i2020", detail={"row_count": len(rows)})
    db.commit()
    return {"dataset_id": dataset_id, "row_count": len(rows), "status": "imported"}


def dataset_views(db: Session) -> list[dict]:
    if not csv_available():
        return [{"id": "ai4i2020", "name": "AI4I 2020 Predictive Maintenance Dataset", "status": "missing", "row_count": 0}]
    rows = load_rows()
    failures = [row for row in rows if int(row.get("machine_failure") or 0) == 1]
    sample = [{**row, "live_sensor": False} for row in rows[:80]]
    latest = db.query(DatasetImport).filter(DatasetImport.dataset_id == "ai4i2020").order_by(DatasetImport.id.desc()).first()
    return [
        {
            "id": "ai4i2020",
            "name": "AI4I 2020 Predictive Maintenance Dataset",
            "provider": "UCI Machine Learning Repository",
            "source_url": "https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset",
            "doi": "10.24432/C5HS5C",
            "license": "Not present in the UCI API JSON retrieved on 2026-10-30. Confirm the dataset page before redistribution.",
            "row_count": len(rows),
            "failure_count": len(failures),
            "first_failure_udi": failures[0].get("udi") if failures else None,
            "timestamp_coverage": "No timestamps in the source. Rows are UDI 1 through 10000.",
            "live_sensor": False,
            "import_status": latest.status if latest else "not_imported",
            "imported_at": latest.imported_at if latest else None,
            "status": latest.status if latest else "not_imported",
            "sample": sample,
            "measurements": sample,
            "normalization": {
                "UDI": "source_udi (not a PhysicalOS machine id)",
                "Machine failure": "dataset_machine_failure == 1 triggers the demo fault",
            },
        }
    ]


def reset_demo(db: Session, actor: str) -> dict:
    reset_state(db)
    write_audit(db, action="demo_reset", actor=actor, detail={"scope": "runtime state"})
    db.commit()
    return {"status": "reset"}


def factory_state(db: Session) -> dict:
    world = build_world(db)
    proposals = db.query(Proposal).all()
    executions = db.query(Execution).all()
    events = db.query(OperationalEvent).order_by(OperationalEvent.id.desc()).limit(20).all()
    assigned = _assignments(proposals, executions)
    workers = [_worker_dict(worker, assigned) for worker in world.workers]
    orders = [_order_dict(order) for order in world.orders]
    robots = [_robot_dict(robot, assigned) for robot in world.robots]
    machines = [_machine_dict(machine, assigned) for machine in world.machines]
    active_orders = [order for order in orders if order["status"] in {"ready", "blocked", "in_progress"}]
    kpis = {
        "active_work_orders": len(active_orders),
        "available_workers": sum(1 for worker in workers if worker["available"] and ("worker", str(worker["id"])) not in world.occupied),
        "operational_machines": sum(1 for machine in machines if machine["status"] in {"operational", "idle", "running"}),
        "available_robots": sum(1 for robot in robots if robot["available"] and ("robot", robot["id"]) not in world.occupied),
        "pending_approvals": sum(1 for proposal in proposals if proposal.status == "pending"),
        "active_exceptions": sum(1 for machine in machines if machine["status"] in {"fault", "maintenance", "offline"})
        + sum(1 for order in orders if order["status"] == "blocked"),
        "completed_simulated_tasks": sum(1 for execution in executions if execution.status == "completed"),
        "nebius_inference_status": "configured" if ai_configured() else "not_configured",
    }
    return {"workers": workers, "orders": orders, "robots": robots, "machines": machines, "events": [_event_dict(event) for event in events], "kpis": kpis}


def list_proposals(db: Session) -> list[dict]:
    return [_proposal_dict(row) for row in db.query(Proposal).order_by(Proposal.id.desc()).all()]


def list_audit(db: Session) -> list[dict]:
    rows = []
    for row in db.query(AuditEvent).order_by(AuditEvent.id.desc()).all():
        try:
            detail = json.loads(row.detail)
        except json.JSONDecodeError:
            detail = row.detail
        rows.append(
            {
                "id": row.id,
                "action": row.action,
                "detail": detail,
                "created_at": row.created_at,
                "actor": row.actor,
                "resource": row.resource,
                "previous_state": row.previous_state,
                "new_state": row.new_state,
                "evidence_ref": row.evidence_ref,
                "model": row.model,
            }
        )
    return rows


def list_workflows(db: Session) -> list[dict]:
    return [_workflow_dict(db, row) for row in db.query(Workflow).order_by(Workflow.id.desc()).all()]


def get_workflow(db: Session, workflow_id: int) -> dict:
    row = db.get(Workflow, workflow_id)
    if row is None:
        raise HTTPException(404, "Unknown workflow")
    return _workflow_dict(db, row)


def list_executions(db: Session) -> list[dict]:
    return [_execution_dict(db, row) for row in db.query(Execution).order_by(Execution.id.desc()).all()]


def get_execution(db: Session, execution_id: int) -> dict:
    row = db.get(Execution, execution_id)
    if row is None:
        raise HTTPException(404, "Unknown execution")
    return _execution_dict(db, row)


def _assignments(proposals: list[Proposal], executions: list[Execution]) -> dict[tuple[str, str], str]:
    done = {item.proposal_id for item in executions if item.status in {"completed", "failed", "cancelled"}}
    assigned: dict[tuple[str, str], str] = {}
    for proposal in proposals:
        if proposal.status == "pending" or (proposal.status == "approved" and proposal.id not in done):
            assigned[("worker", str(proposal.worker_id))] = proposal.order_id
            assigned[("robot", proposal.robot_id)] = proposal.order_id
            if proposal.machine_id:
                assigned[("machine", proposal.machine_id)] = proposal.order_id
    return assigned


def _worker_dict(worker: dict, assigned: dict[tuple[str, str], str]) -> dict:
    return {
        "id": worker["id"],
        "name": worker["name"],
        "skills": worker["skills"],
        "available": worker["available"] and ("worker", str(worker["id"])) not in assigned,
        "shift": worker["shift"],
        "status": worker["status"],
        "on_shift": worker["on_shift"],
        "certifications": [cert["name"] for cert in worker["certifications"]],
        "certification_records": worker["certifications"],
        "assigned_tasks": [assigned[("worker", str(worker["id"]))]] if ("worker", str(worker["id"])) in assigned else [],
    }


def _order_dict(order: dict) -> dict:
    return {
        "id": order["id"],
        "task": order["task"],
        "product": order["product"],
        "quantity": order["quantity"],
        "priority": order["priority"],
        "deadline": order["deadline"],
        "skill": order["skill"],
        "robot_type": order["robot_type"],
        "machine_capability": order["machine_capability"],
        "depends_on": order["depends_on"],
        "status": order["status"],
    }


def _robot_dict(robot: dict, assigned: dict[tuple[str, str], str]) -> dict:
    return {
        "id": robot["id"],
        "name": robot["name"],
        "type": robot["type"],
        "available": robot["available"] and ("robot", robot["id"]) not in assigned,
        "status": "assigned" if ("robot", robot["id"]) in assigned else robot["status"],
        "simulated": True,
        "capabilities": [robot["type"]],
        "assigned_tasks": [assigned[("robot", robot["id"])]] if ("robot", robot["id"]) in assigned else [],
    }


def _machine_dict(machine: dict, assigned: dict[tuple[str, str], str]) -> dict:
    return {
        "id": machine["id"],
        "name": machine["name"],
        "type": machine["station"],
        "status": machine["status"],
        "line": machine["line"],
        "capability": machine["capability"],
        "simulated": True,
        "assigned_tasks": [assigned[("machine", machine["id"])]] if ("machine", machine["id"]) in assigned else [],
    }


def _event_dict(event: OperationalEvent) -> dict:
    try:
        payload = json.loads(event.payload_json)
    except json.JSONDecodeError:
        payload = {}
    return {
        "id": event.id,
        "event_type": event.event_type,
        "type": event.event_type,
        "severity": event.severity,
        "machine_id": event.machine_id,
        "order_id": event.order_id,
        "source_udi": event.source_udi,
        "summary": event.summary,
        "message": event.summary,
        "created_at": event.created_at,
        "payload": payload,
    }


def _proposal_dict(row: Proposal) -> dict:
    try:
        evidence = json.loads(row.evidence_json) if row.evidence_json else None
    except json.JSONDecodeError:
        evidence = None
    return {
        "id": row.id,
        "order_id": row.order_id,
        "worker_id": row.worker_id,
        "robot_id": row.robot_id,
        "machine_id": row.machine_id,
        "source": row.source,
        "rationale": row.rationale,
        "model": row.model,
        "request_id": row.request_id,
        "status": row.status,
        "created_at": row.created_at,
        "decided_at": row.decided_at,
        "expires_at": row.expires_at,
        "workflow_id": row.workflow_id,
        "evidence": evidence,
    }


def _workflow_dict(db: Session, row: Workflow) -> dict:
    transitions = db.query(WorkflowTransition).filter(WorkflowTransition.workflow_id == row.id).order_by(WorkflowTransition.id.asc()).all()
    try:
        context = json.loads(row.context_json or "{}")
    except json.JSONDecodeError:
        context = {}
    return {
        "id": row.id,
        "order_id": row.order_id,
        "state": row.state,
        "status": row.state,
        "origin": row.origin,
        "event_id": row.event_id,
        "proposal_id": row.proposal_id,
        "context": context,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "transitions": [
            {
                "id": item.id,
                "previous_state": item.previous_state,
                "new_state": item.new_state,
                "name": item.new_state,
                "label": item.new_state,
                "status": "complete",
                "actor": item.actor,
                "created_at": item.created_at,
            }
            for item in transitions
        ],
    }


def _execution_dict(db: Session, row: Execution) -> dict:
    try:
        result = json.loads(row.result_json)
    except json.JSONDecodeError:
        result = {}
    workflow = db.get(Workflow, row.workflow_id)
    return {
        "id": row.id,
        "workflow_id": row.workflow_id,
        "proposal_id": row.proposal_id,
        "order_id": workflow.order_id if workflow else None,
        "status": row.status,
        "simulated": True,
        "adapter": row.adapter,
        "result": result,
        "steps": result.get("steps", []) if isinstance(result, dict) else [],
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "finished_at": row.updated_at if row.status in {"completed", "failed", "cancelled"} else None,
        "workflow_state": workflow.state if workflow else None,
    }
