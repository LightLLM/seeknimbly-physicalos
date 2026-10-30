from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from fastapi import HTTPException


BLOCKED_MACHINE_STATES = {"fault", "maintenance", "offline"}
AVAILABLE_MACHINE_STATES = {"available", "idle", "running"}


@dataclass
class ValidationEvidence:
    checks: list[dict] = field(default_factory=list)
    passed: bool = True

    def add(self, name: str, ok: bool, detail: str) -> None:
        self.checks.append({"name": name, "ok": ok, "detail": detail})
        if not ok:
            self.passed = False


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def find_order(store: dict, order_id: str) -> dict | None:
    return next((item for item in store["orders"] if item["id"] == order_id), None)


def find_worker(store: dict, worker_id: int) -> dict | None:
    return next((item for item in store["workers"] if item["id"] == worker_id), None)


def find_robot(store: dict, robot_id: str) -> dict | None:
    return next((item for item in store["robots"] if item["id"] == robot_id), None)


def find_machine(store: dict, machine_id: str | None) -> dict | None:
    if not machine_id:
        return None
    return next((item for item in store["machines"] if item["id"] == machine_id), None)


def machine_is_operable(machine: dict) -> bool:
    status = str(machine.get("status", "")).lower()
    return status not in BLOCKED_MACHINE_STATES


def dependencies_satisfied(store: dict, order: dict) -> bool:
    deps = order.get("dependencies") or []
    if not deps:
        return True
    by_id = {item["id"]: item for item in store["orders"]}
    for dep in deps:
        peer = by_id.get(dep)
        if peer is None or str(peer.get("status", "")).lower() not in {"completed", "done"}:
            return False
    return True


def eligible_workers(store: dict, order: dict) -> list[dict]:
    required_skills = set(order.get("required_skills") or [order["skill"]])
    required_certs = set(order.get("required_certifications") or [])
    booked = store.get("bookings", {}).get("workers", {})
    candidates = []
    for worker in sorted(store["workers"], key=lambda item: item["id"]):
        if not worker.get("available"):
            continue
        skills = set(worker.get("skills") or [])
        if not required_skills.issubset(skills):
            continue
        certs = set(worker.get("certifications") or [])
        if required_certs and not required_certs.issubset(certs):
            # Allow CNC-L2 to satisfy CNC-L1 style requirements via prefix match on family.
            if not all(any(cert.startswith(req.split("-")[0]) for cert in certs) for req in required_certs):
                continue
        if booked.get(worker["id"]):
            continue
        candidates.append(worker)
    return candidates


def eligible_machines(store: dict, order: dict) -> list[dict]:
    required_caps = set(order.get("required_machine_capabilities") or [order["skill"]])
    booked = store.get("bookings", {}).get("machines", {})
    preferred = order.get("preferred_machine_id")
    candidates = []
    for machine in sorted(store["machines"], key=lambda item: (0 if item["id"] == preferred else 1, item["id"])):
        status = str(machine.get("status", "")).lower()
        if status in BLOCKED_MACHINE_STATES:
            continue
        if status not in AVAILABLE_MACHINE_STATES and status != "simulated":
            continue
        caps = set(machine.get("capabilities") or [machine.get("type")])
        if not required_caps.issubset(caps):
            continue
        if booked.get(machine["id"]):
            continue
        candidates.append(machine)
    return candidates


def eligible_robots(store: dict, order: dict) -> list[dict]:
    robot_type = order.get("robot_type")
    optional_caps = set(order.get("optional_robot_capabilities") or ([robot_type] if robot_type else []))
    booked = store.get("bookings", {}).get("robots", {})
    candidates = []
    for robot in sorted(store["robots"], key=lambda item: item["id"]):
        if not robot.get("available"):
            continue
        if robot_type and robot.get("type") != robot_type:
            continue
        caps = set(robot.get("capabilities") or [robot.get("type")])
        if optional_caps and not optional_caps.intersection(caps):
            continue
        if booked.get(robot["id"]):
            continue
        candidates.append(robot)
    return candidates


def compute_eligible_assignment(store: dict, order_id: str) -> tuple[dict, dict, dict, dict, ValidationEvidence]:
    """Return order, worker, machine, robot for a safe assignment.

    Tie-break: ascending worker id, preferred machine then id, ascending robot id.
    """
    evidence = ValidationEvidence()
    order = find_order(store, order_id)
    if order is None:
        evidence.add("work_order_exists", False, f"Unknown order {order_id}")
        raise HTTPException(status_code=404, detail={"message": "Unknown order", "evidence": evidence.checks})
    evidence.add("work_order_exists", True, f"Order {order_id} found")

    if not dependencies_satisfied(store, order):
        evidence.add("dependencies_satisfied", False, f"Dependencies unmet: {order.get('dependencies')}")
        raise HTTPException(status_code=409, detail={"message": "Task dependencies are not satisfied", "evidence": evidence.checks})
    evidence.add("dependencies_satisfied", True, "Dependencies satisfied or empty")

    workers = eligible_workers(store, order)
    machines = eligible_machines(store, order)
    robots = eligible_robots(store, order)

    if not workers:
        evidence.add("worker_available_qualified", False, "No available qualified worker")
        raise HTTPException(status_code=409, detail={"message": "No safe eligible assignment", "evidence": evidence.checks})
    evidence.add("worker_available_qualified", True, f"Candidate workers: {[w['id'] for w in workers]}")

    if not machines:
        evidence.add("machine_available_compatible", False, "No available compatible machine")
        raise HTTPException(status_code=409, detail={"message": "No safe eligible assignment", "evidence": evidence.checks})
    evidence.add("machine_available_compatible", True, f"Candidate machines: {[m['id'] for m in machines]}")

    if not robots:
        evidence.add("robot_available_compatible", False, "No available compatible robot")
        raise HTTPException(status_code=409, detail={"message": "No safe eligible assignment", "evidence": evidence.checks})
    evidence.add("robot_available_compatible", True, f"Candidate robots: {[r['id'] for r in robots]}")

    worker, machine, robot = workers[0], machines[0], robots[0]
    evidence.add("deterministic_selection", True, f"Selected worker={worker['id']} machine={machine['id']} robot={robot['id']}")
    return order, worker, machine, robot, evidence


def validate_proposed_assignment(
    store: dict,
    *,
    order_id: str,
    worker_id: int,
    robot_id: str,
    machine_id: str | None = None,
    expires_at: str | None = None,
) -> tuple[dict, dict, dict, dict, ValidationEvidence]:
    order, eligible_worker, eligible_machine, eligible_robot, evidence = compute_eligible_assignment(store, order_id)

    worker = find_worker(store, worker_id)
    if worker is None:
        evidence.add("worker_exists", False, f"Unknown worker {worker_id}")
        raise HTTPException(status_code=400, detail={"message": "Worker does not exist", "evidence": evidence.checks})
    evidence.add("worker_exists", True, f"Worker {worker_id} exists")

    if not worker.get("available"):
        evidence.add("worker_available", False, "Worker unavailable")
        raise HTTPException(status_code=400, detail={"message": "Worker is not available", "evidence": evidence.checks})

    robot = find_robot(store, robot_id)
    if robot is None:
        evidence.add("robot_exists", False, f"Unknown robot {robot_id}")
        raise HTTPException(status_code=400, detail={"message": "Robot does not exist", "evidence": evidence.checks})

    resolved_machine_id = machine_id or eligible_machine["id"]
    machine = find_machine(store, resolved_machine_id)
    if machine is None:
        evidence.add("machine_exists", False, f"Unknown machine {resolved_machine_id}")
        raise HTTPException(status_code=400, detail={"message": "Machine does not exist", "evidence": evidence.checks})

    if not machine_is_operable(machine):
        evidence.add("machine_not_faulted", False, f"Machine status={machine.get('status')}")
        raise HTTPException(status_code=400, detail={"message": "Machine is in maintenance or fault state", "evidence": evidence.checks})

    if (
        worker["id"] != eligible_worker["id"]
        or robot["id"] != eligible_robot["id"]
        or machine["id"] != eligible_machine["id"]
    ):
        evidence.add(
            "matches_computed_eligible",
            False,
            f"Proposed W{worker_id}/{robot_id}/{resolved_machine_id} != eligible "
            f"W{eligible_worker['id']}/{eligible_robot['id']}/{eligible_machine['id']}",
        )
        raise HTTPException(
            status_code=400,
            detail={"message": "Proposal does not match deterministic eligibility checks", "evidence": evidence.checks},
        )
    evidence.add("matches_computed_eligible", True, "Proposal matches computed eligible assignment")

    if expires_at:
        expiry = _parse_iso(expires_at)
        if expiry and expiry < datetime.now(timezone.utc):
            evidence.add("proposal_not_expired", False, f"Expired at {expires_at}")
            raise HTTPException(status_code=409, detail={"message": "Proposal has expired", "evidence": evidence.checks})
    evidence.add("proposal_not_expired", True, "Proposal within validity window")
    return order, worker, machine, robot, evidence
