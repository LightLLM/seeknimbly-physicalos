from __future__ import annotations

from abc import ABC, abstractmethod
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SimulationAdapter(ABC):
    name: str
    capability: str

    @abstractmethod
    def discover(self) -> dict:
        raise NotImplementedError

    def available(self, resource: dict) -> bool:
        return bool(resource.get("available", True)) and str(resource.get("status", "available")).lower() not in {
            "fault",
            "offline",
            "maintenance",
        }

    def validate_task(self, resource: dict, task: dict) -> tuple[bool, str]:
        caps = set(resource.get("capabilities") or [resource.get("type")])
        needed = task.get("capability") or task.get("type")
        if needed and needed not in caps:
            return False, f"Capability {needed} not supported by {resource.get('id')}"
        if not self.available(resource):
            return False, f"Resource {resource.get('id')} unavailable"
        return True, "ok"

    def dispatch(self, resource: dict, task: dict) -> dict:
        ok, detail = self.validate_task(resource, task)
        if not ok:
            return {"status": "failed", "detail": detail, "adapter": self.name, "at": _now()}
        return {
            "status": "dispatched",
            "detail": f"{self.name} accepted simulated task {task.get('id')}",
            "adapter": self.name,
            "resource_id": resource.get("id"),
            "at": _now(),
            "simulation": True,
        }

    def complete(self, dispatch_result: dict) -> dict:
        result = deepcopy(dispatch_result)
        result.update({"status": "completed", "finished_at": _now()})
        return result

    def fail(self, dispatch_result: dict, reason: str) -> dict:
        result = deepcopy(dispatch_result)
        result.update({"status": "failed", "detail": reason, "finished_at": _now()})
        return result

    def cancel(self, dispatch_result: dict) -> dict:
        result = deepcopy(dispatch_result)
        result.update({"status": "cancelled", "finished_at": _now()})
        return result


class SimulatedMaterialHandlingAdapter(SimulationAdapter):
    name = "SimulatedMaterialHandlingAdapter"
    capability = "material"

    def discover(self) -> dict:
        return {"adapter": self.name, "capability": self.capability, "physical_control": False}


class SimulatedWeldingAdapter(SimulationAdapter):
    name = "SimulatedWeldingAdapter"
    capability = "welding"

    def discover(self) -> dict:
        return {"adapter": self.name, "capability": self.capability, "physical_control": False}


class SimulatedInspectionAdapter(SimulationAdapter):
    name = "SimulatedInspectionAdapter"
    capability = "inspection"

    def discover(self) -> dict:
        return {"adapter": self.name, "capability": self.capability, "physical_control": False}


class SimulatedMachineAdapter(SimulationAdapter):
    name = "SimulatedMachineAdapter"
    capability = "machine"

    def discover(self) -> dict:
        return {"adapter": self.name, "capability": self.capability, "physical_control": False}

    def available(self, resource: dict) -> bool:
        return str(resource.get("status", "")).lower() not in {"fault", "offline", "maintenance"}


class Ros2CompatibilityAdapter:
    """Future-facing interface only. Physical robot commands are never activated."""

    name = "Ros2CompatibilityAdapter"
    active = False

    def discover(self) -> dict:
        return {
            "adapter": self.name,
            "active": False,
            "note": "Interface stub for future ROS 2 / Open-RMF integration. No physical commands are issued.",
        }

    def command(self, *_args: Any, **_kwargs: Any) -> dict:
        return {"accepted": False, "reason": "Physical ROS 2 control is disabled in this hackathon build."}


ADAPTERS = {
    "material": SimulatedMaterialHandlingAdapter(),
    "welding": SimulatedWeldingAdapter(),
    "inspection": SimulatedInspectionAdapter(),
    "machine": SimulatedMachineAdapter(),
}


def adapter_for_robot_type(robot_type: str) -> SimulationAdapter:
    return ADAPTERS.get(robot_type, ADAPTERS["material"])
