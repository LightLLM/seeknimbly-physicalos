"""Deterministic eligibility. The model is not consulted here."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from backend.app.core.config import DEMO_NOW, TIE_BREAK
from backend.app.domain.catalog import AVAILABLE_MACHINE, SKILL_CERTS, UNAVAILABLE_MACHINE


class SafetyError(Exception):
    def __init__(self, status_code: int, message: str, checks: list[dict] | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.checks = checks or []


@dataclass
class World:
    workers: list[dict]
    orders: list[dict]
    robots: list[dict]
    machines: list[dict]
    occupied: set[tuple[str, str]]


def _mark(checks: list[dict], rule: str, ok: bool, detail: str) -> None:
    checks.append({"rule": rule, "ok": ok, "detail": detail})


def _cert_ok(worker: dict, skill: str) -> bool:
    allowed = SKILL_CERTS.get(skill, set())
    for cert in worker.get("certifications", []):
        if cert["name"] not in allowed:
            continue
        expires = datetime.fromisoformat(cert["valid_until"])
        if expires > DEMO_NOW:
            return True
    return False


def select_assignment(world: World, order_id: str) -> tuple[dict, list[dict]]:
    """Pick the deterministic assignment or raise SafetyError. Never calls a model."""
    checks: list[dict] = []
    order = next((item for item in world.orders if item["id"] == order_id), None)
    if order is None:
        _mark(checks, "work_order_exists", False, order_id)
        raise SafetyError(404, "Unknown order", checks)
    _mark(checks, "work_order_exists", True, order["id"])

    unmet = [dep for dep in order["depends_on"] if _order_status(world, dep) != "completed"]
    if unmet:
        _mark(checks, "dependencies_satisfied", False, ",".join(unmet))
        raise SafetyError(409, "No safe eligible assignment", checks)
    _mark(checks, "dependencies_satisfied", True, "satisfied" if order["depends_on"] else "none")

    workers = [
        worker
        for worker in sorted(world.workers, key=lambda item: item["id"])
        if worker["available"]
        and order["skill"] in worker["skills"]
        and worker["on_shift"]
        and _cert_ok(worker, order["skill"])
        and ("worker", str(worker["id"])) not in world.occupied
    ]
    if not workers:
        _mark(checks, "worker_available", False, "no eligible worker")
        raise SafetyError(409, "No safe eligible assignment", checks)
    worker = workers[0]
    _mark(checks, "worker_exists", True, str(worker["id"]))
    _mark(checks, "worker_available", True, worker["name"])
    _mark(checks, "worker_skills", True, order["skill"])
    _mark(checks, "certifications_valid", True, order["skill"])
    _mark(checks, "worker_not_double_booked", True, str(worker["id"]))

    machines = [
        machine
        for machine in sorted(world.machines, key=lambda item: item["id"])
        if machine["capability"] == order["machine_capability"]
        and machine["status"] in AVAILABLE_MACHINE
        and machine["status"] not in UNAVAILABLE_MACHINE
        and ("machine", machine["id"]) not in world.occupied
    ]
    if not machines:
        _mark(checks, "machine_available", False, order["machine_capability"])
        raise SafetyError(409, "No safe eligible assignment", checks)
    machine = machines[0]
    _mark(checks, "machine_exists", True, machine["id"])
    _mark(checks, "machine_available", True, machine["status"])
    _mark(checks, "machine_supports_operation", True, machine["capability"])
    _mark(checks, "machine_not_fault_or_maintenance", True, machine["status"])

    robots = [
        robot
        for robot in sorted(world.robots, key=lambda item: item["id"])
        if robot["available"]
        and robot["type"] == order["robot_type"]
        and ("robot", robot["id"]) not in world.occupied
    ]
    if not robots:
        _mark(checks, "robot_available", False, order["robot_type"])
        raise SafetyError(409, "No safe eligible assignment", checks)
    robot = robots[0]
    _mark(checks, "robot_exists", True, robot["id"])
    _mark(checks, "robot_available", True, robot["id"])
    _mark(checks, "robot_capability", True, robot["type"])
    _mark(checks, "robot_not_double_booked", True, robot["id"])
    _mark(checks, "matches_computed_assignment", True, TIE_BREAK)
    _mark(checks, "proposal_not_expired", True, "selection is not a stored proposal")
    _mark(checks, "workflow_transition", True, "enforced separately by the workflow engine")

    assignment = {
        "order_id": order["id"],
        "worker_id": worker["id"],
        "worker_name": worker["name"],
        "machine_id": machine["id"],
        "robot_id": robot["id"],
        "robot_type": robot["type"],
        "task": order["task"],
        "skill": order["skill"],
    }
    return assignment, checks


def _order_status(world: World, order_id: str) -> str:
    order = next((item for item in world.orders if item["id"] == order_id), None)
    return order["status"] if order else "missing"
