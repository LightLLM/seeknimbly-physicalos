"""Immutable demo catalog. Runtime status lives in the database."""

from __future__ import annotations

WORKERS: list[dict] = [
    {
        "id": 1,
        "name": "Amina",
        "skills": ["CNC", "inspection"],
        "available": True,
        "shift": "A",
        "on_shift": True,
        "certifications": [
            {"name": "CNC-L2", "valid_until": "2027-12-31T00:00:00+00:00"},
            {"name": "ISO-9001", "valid_until": "2027-12-31T00:00:00+00:00"},
        ],
    },
    {
        "id": 2,
        "name": "Mateo",
        "skills": ["welding"],
        "available": True,
        "shift": "A",
        "on_shift": True,
        "certifications": [{"name": "WELD-GTAW", "valid_until": "2027-12-31T00:00:00+00:00"}],
    },
    {
        "id": 3,
        "name": "Priya",
        "skills": ["assembly", "inspection"],
        "available": False,
        "shift": "B",
        "on_shift": False,
        "certifications": [{"name": "ASSY-L1", "valid_until": "2027-12-31T00:00:00+00:00"}],
    },
    {
        "id": 4,
        "name": "Jonas",
        "skills": ["CNC"],
        "available": True,
        "shift": "A",
        "on_shift": True,
        "certifications": [{"name": "CNC-L1", "valid_until": "2027-12-31T00:00:00+00:00"}],
    },
    {
        "id": 5,
        "name": "Elena",
        "skills": ["assembly"],
        "available": True,
        "shift": "B",
        "on_shift": True,
        "certifications": [{"name": "ASSY-L2", "valid_until": "2027-12-31T00:00:00+00:00"}],
    },
    {
        "id": 6,
        "name": "Sam",
        "skills": ["welding", "inspection"],
        "available": True,
        "shift": "A",
        "on_shift": True,
        "certifications": [
            {"name": "WELD-GTAW", "valid_until": "2027-12-31T00:00:00+00:00"},
            {"name": "INSPECT-L1", "valid_until": "2027-12-31T00:00:00+00:00"},
        ],
    },
    {
        "id": 7,
        "name": "Noor",
        "skills": ["packaging"],
        "available": True,
        "shift": "B",
        "on_shift": True,
        "certifications": [{"name": "PACK-L1", "valid_until": "2027-12-31T00:00:00+00:00"}],
    },
    {
        "id": 8,
        "name": "Luis",
        "skills": ["maintenance"],
        "available": True,
        "shift": "C",
        "on_shift": True,
        "certifications": [{"name": "MAINT-L2", "valid_until": "2027-12-31T00:00:00+00:00"}],
    },
]

ORDERS: list[dict] = [
    {
        "id": "O1",
        "task": "CNC housing",
        "product": "Gear housing GH-100",
        "quantity": 24,
        "priority": "high",
        "deadline": "2026-11-02T16:00:00+00:00",
        "skill": "CNC",
        "machine_capability": "CNC",
        "robot_type": "material",
        "depends_on": [],
        "status": "ready",
    },
    {
        "id": "O2",
        "task": "Weld frame",
        "product": "Frame weldment FW-20",
        "quantity": 12,
        "priority": "high",
        "deadline": "2026-11-03T16:00:00+00:00",
        "skill": "welding",
        "machine_capability": "welding",
        "robot_type": "welding",
        "depends_on": [],
        "status": "ready",
    },
    {
        "id": "O3",
        "task": "Assemble actuator",
        "product": "Linear actuator LA-7",
        "quantity": 18,
        "priority": "medium",
        "deadline": "2026-11-04T16:00:00+00:00",
        "skill": "assembly",
        "machine_capability": "assembly",
        "robot_type": "material",
        "depends_on": ["O2"],
        "status": "ready",
    },
    {
        "id": "O4",
        "task": "Final inspection",
        "product": "Linear actuator LA-7",
        "quantity": 18,
        "priority": "medium",
        "deadline": "2026-11-05T16:00:00+00:00",
        "skill": "inspection",
        "machine_capability": "inspection",
        "robot_type": "inspection",
        "depends_on": ["O3"],
        "status": "ready",
    },
    {
        "id": "O5",
        "task": "Package shipment",
        "product": "Linear actuator LA-7",
        "quantity": 18,
        "priority": "low",
        "deadline": "2026-11-06T16:00:00+00:00",
        "skill": "packaging",
        "machine_capability": "packaging",
        "robot_type": "material",
        "depends_on": ["O4"],
        "status": "ready",
    },
]

ROBOTS: list[dict] = [
    {"id": "R1", "name": "Material handler", "type": "material", "available": True, "status": "available"},
    {"id": "R2", "name": "Welding robot", "type": "welding", "available": True, "status": "available"},
    {"id": "R3", "name": "Inspection robot", "type": "inspection", "available": True, "status": "available"},
]

MACHINES: list[dict] = [
    {"id": "M-CNC-01", "name": "CNC cell 1", "station": "cnc", "capability": "CNC", "status": "operational", "line": "A"},
    {"id": "M-CNC-02", "name": "CNC cell 2", "station": "cnc", "capability": "CNC", "status": "operational", "line": "A"},
    {"id": "M-WELD-01", "name": "Welding cell", "station": "welding", "capability": "welding", "status": "operational", "line": "A"},
    {"id": "M-ASSY-01", "name": "Assembly cell", "station": "assembly", "capability": "assembly", "status": "operational", "line": "A"},
    {"id": "M-INSP-01", "name": "Inspection cell", "station": "inspection", "capability": "inspection", "status": "operational", "line": "A"},
    {"id": "M-PACK-01", "name": "Packaging cell", "station": "packaging", "capability": "packaging", "status": "operational", "line": "A"},
]

# A published failure row is applied to this simulated machine and order.
# The dataset UDI is never treated as a machine identifier.
TARGET_MACHINE_ID = "M-CNC-01"
ALTERNATE_MACHINE_ID = "M-CNC-02"
AFFECTED_ORDER_ID = "O1"
UNAVAILABLE_ROBOT_ID = "R1"

SKILL_CERTS: dict[str, set[str]] = {
    "CNC": {"CNC-L1", "CNC-L2"},
    "welding": {"WELD-GTAW"},
    "assembly": {"ASSY-L1", "ASSY-L2"},
    "inspection": {"INSPECT-L1", "ISO-9001"},
    "packaging": {"PACK-L1"},
    "maintenance": {"MAINT-L2"},
}

UNAVAILABLE_MACHINE = {"fault", "maintenance", "offline"}
AVAILABLE_MACHINE = {"operational", "idle"}

WORKFLOW_PATH = [
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

TERMINAL_STATES = {
    "COMPLETED",
    "REJECTED",
    "EXPIRED",
    "VALIDATION_FAILED",
    "EXECUTION_FAILED",
    "CANCELLED",
    "ESCALATED",
}

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "EVENT_DETECTED": {"CONTEXT_RESOLVED", "CANCELLED"},
    "CONTEXT_RESOLVED": {"SAFETY_VALIDATED", "VALIDATION_FAILED", "CANCELLED"},
    "SAFETY_VALIDATED": {"AI_EXPLAINED", "CANCELLED"},
    "AI_EXPLAINED": {"APPROVAL_PENDING", "CANCELLED"},
    "APPROVAL_PENDING": {"APPROVED", "REJECTED", "EXPIRED", "ESCALATED", "CANCELLED"},
    "APPROVED": {"SIMULATED_DISPATCH", "EXECUTION_FAILED", "CANCELLED"},
    "SIMULATED_DISPATCH": {"RUNNING", "EXECUTION_FAILED"},
    "RUNNING": {"COMPLETED", "EXECUTION_FAILED", "CANCELLED"},
    "COMPLETED": set(),
    "REJECTED": set(),
    "EXPIRED": set(),
    "VALIDATION_FAILED": set(),
    "EXECUTION_FAILED": set(),
    "CANCELLED": set(),
    "ESCALATED": set(),
}
