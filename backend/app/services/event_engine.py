from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

from backend.app.integrations.datasets import ai4i
from backend.app.services import workflow_engine


PRIMARY_MACHINE_ID = "M-CNC-01"
AFFECTED_ORDER_ID = "O1"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def replay_machine_health(store: dict, connection, udi: int | None = None) -> dict:
    """Load a public AI4I failure row, mark the simulated CNC unavailable, open a workflow."""
    if udi is None:
        row = ai4i.first_failure()
        if row is None:
            raise HTTPException(status_code=404, detail="No failure rows available in AI4I dataset")
    else:
        row = ai4i.row_by_udi(udi)
        if row is None:
            raise HTTPException(status_code=404, detail=f"UDI {udi} not found in AI4I dataset")

    event = ai4i.detect_machine_health_event(row)
    if event is None:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Selected AI4I row is not a machine failure",
                "udi": udi,
                "rule": "machine_failure == 1",
            },
        )

    machine = next((item for item in store["machines"] if item["id"] == PRIMARY_MACHINE_ID), None)
    if machine is None:
        raise HTTPException(status_code=500, detail="Primary CNC machine missing from seed data")

    previous_status = machine.get("status")
    machine["status"] = "fault"
    machine["udi"] = row.get("udi")
    machine["product_id"] = row.get("product_id")
    machine["risk"] = "critical"
    machine["tool_wear"] = row.get("tool_wear_min")
    machine["assigned_order_id"] = None

    order = next((item for item in store["orders"] if item["id"] == AFFECTED_ORDER_ID), None)
    if order:
        order["status"] = "exception"
        order["machine_id"] = None
        order["affected_by_event"] = True

    event_id = f"evt_{uuid.uuid4().hex[:10]}"
    event_record = {
        "id": event_id,
        **event,
        "machine_id": PRIMARY_MACHINE_ID,
        "order_id": AFFECTED_ORDER_ID,
        "created_at": _now(),
        "source_dataset": ai4i.DATASET_ID,
        "synthetic_mapping": {
            "note": "AI4I UDI mapped onto simulated machine M-CNC-01; UDI is not a plant asset identifier.",
            "dataset_udi": row.get("udi"),
            "simulated_machine_id": PRIMARY_MACHINE_ID,
        },
    }
    store["events"].insert(0, event_record)

    workflow = workflow_engine.create_workflow(
        connection,
        order_id=AFFECTED_ORDER_ID,
        event_id=event_id,
        machine_id=PRIMARY_MACHINE_ID,
    )
    workflow = workflow_engine.transition(connection, workflow["id"], "CONTEXT_RESOLVED", actor="event_engine")
    return {
        "udi": row.get("udi"),
        "machine_id": PRIMARY_MACHINE_ID,
        "previous_machine_status": previous_status,
        "order_id": AFFECTED_ORDER_ID,
        "workflow_id": workflow["id"],
        "workflow": workflow,
        "event": event_record,
        "dataset": ai4i.DATASET_ID,
        "rule": "machine_failure == 1",
    }


def mark_material_robot_unavailable(store: dict, connection) -> dict:
    """Supporting scenario: the only material robot is unavailable, so O1 cannot dispatch."""
    robot = next((item for item in store["robots"] if item["id"] == "R1"), None)
    if robot is None:
        raise HTTPException(status_code=500, detail="Material robot R1 missing from seed data")
    robot["available"] = False
    robot["status"] = "unavailable"
    order = next((item for item in store["orders"] if item["id"] == AFFECTED_ORDER_ID), None)
    if order:
        order["status"] = "exception"
    event_id = f"evt_{uuid.uuid4().hex[:10]}"
    event_record = {
        "id": event_id,
        "type": "robot_unavailable",
        "event_type": "robot_unavailable",
        "severity": "critical",
        "message": "Simulated material robot R1 is unavailable. No alternate material robot is seeded, so O1 cannot be dispatched.",
        "summary": "Simulated material robot R1 is unavailable. No alternate material robot is seeded, so O1 cannot be dispatched.",
        "machine_id": None,
        "order_id": AFFECTED_ORDER_ID,
        "created_at": _now(),
        "live_sensor": False,
    }
    store["events"].insert(0, event_record)
    workflow = workflow_engine.create_workflow(connection, order_id=AFFECTED_ORDER_ID, event_id=event_id, machine_id=None)
    workflow = workflow_engine.transition(connection, workflow["id"], "CONTEXT_RESOLVED", actor="event_engine")
    return {
        "scenario": "robot_unavailable",
        "robot_id": "R1",
        "order_id": AFFECTED_ORDER_ID,
        "workflow_id": workflow["id"],
        "event": event_record,
        "message": event_record["message"],
    }
