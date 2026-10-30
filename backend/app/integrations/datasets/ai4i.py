from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

from backend.app.core.config import AI4I_CSV, DATA_PROCESSED

SOURCE_URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/00601/ai4i2020.csv"
PROVIDER = "UCI Machine Learning Repository"
LICENSE = "CC BY 4.0"
DATASET_ID = "uci-ai4i-2020"
DATASET_NAME = "AI4I 2020 Predictive Maintenance"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def csv_available(path: Path | None = None) -> bool:
    target = path or AI4I_CSV
    return target.exists() and target.stat().st_size > 0


def load_rows(path: Path | None = None, limit: int | None = None) -> list[dict]:
    target = path or AI4I_CSV
    if not target.exists():
        return []
    rows: list[dict] = []
    with target.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for index, row in enumerate(reader):
            rows.append(_normalize_row({key.lstrip("\ufeff"): value for key, value in row.items()}))
            if limit is not None and index + 1 >= limit:
                break
    return rows


def _normalize_row(row: dict) -> dict:
    def num(key: str) -> float | int | None:
        raw = row.get(key)
        if raw is None or raw == "":
            return None
        try:
            if "." in str(raw):
                return float(raw)
            return int(raw)
        except ValueError:
            return None

    return {
        "udi": num("UDI"),
        "product_id": row.get("Product ID"),
        "type": row.get("Type"),
        "air_temperature_k": num("Air temperature [K]"),
        "process_temperature_k": num("Process temperature [K]"),
        "rotational_speed_rpm": num("Rotational speed [rpm]"),
        "torque_nm": num("Torque [Nm]"),
        "tool_wear_min": num("Tool wear [min]"),
        "machine_failure": int(num("Machine failure") or 0),
        "twf": int(num("TWF") or 0),
        "hdf": int(num("HDF") or 0),
        "pwf": int(num("PWF") or 0),
        "osf": int(num("OSF") or 0),
        "rnf": int(num("RNF") or 0),
    }


def failure_modes(row: dict) -> list[str]:
    mapping = {"twf": "tool_wear", "hdf": "heat_dissipation", "pwf": "power", "osf": "overstrain", "rnf": "random"}
    return [label for key, label in mapping.items() if int(row.get(key) or 0) == 1]


def first_failure(rows: list[dict] | None = None) -> dict | None:
    data = rows if rows is not None else load_rows()
    for row in data:
        if int(row.get("machine_failure") or 0) == 1:
            return row
    return None


def row_by_udi(udi: int, rows: list[dict] | None = None) -> dict | None:
    data = rows if rows is not None else load_rows()
    return next((row for row in data if int(row.get("udi") or -1) == udi), None)


def detect_machine_health_event(row: dict) -> dict | None:
    """Deterministic rule: Machine failure == 1 produces a machine-health exception."""
    if int(row.get("machine_failure") or 0) != 1:
        return None
    modes = failure_modes(row)
    return {
        "type": "machine_health_exception",
        "event_type": "machine_health_exception",
        "severity": "critical",
        "udi": row.get("udi"),
        "message": f"AI4I UDI {row.get('udi')} machine failure ({', '.join(modes) or 'unspecified'})",
        "summary": "Public dataset failure flag mapped to simulated CNC fault",
        "rule": "machine_failure == 1",
        "payload": row,
        "timestamp": _now(),
    }


def import_dataset(store: dict) -> dict:
    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
    if not csv_available():
        return {
            "id": DATASET_ID,
            "name": DATASET_NAME,
            "provider": PROVIDER,
            "license": LICENSE,
            "source_url": SOURCE_URL,
            "status": "missing",
            "row_count": 0,
            "imported_at": None,
            "sample": [],
            "measurements": [],
            "error": f"CSV not found at {AI4I_CSV}",
        }

    rows = load_rows()
    sample = rows[:120]
    failures = [row for row in rows if int(row.get("machine_failure") or 0) == 1]
    meta = {
        "id": DATASET_ID,
        "name": DATASET_NAME,
        "provider": PROVIDER,
        "license": LICENSE,
        "source_url": SOURCE_URL,
        "status": "imported",
        "row_count": len(rows),
        "failure_count": len(failures),
        "imported_at": _now(),
        "sample": sample,
        "measurements": sample,
        "normalization": {
            "udi": "UDI",
            "air_temperature_k": "Air temperature [K]",
            "process_temperature_k": "Process temperature [K]",
            "rotational_speed_rpm": "Rotational speed [rpm]",
            "torque_nm": "Torque [Nm]",
            "tool_wear_min": "Tool wear [min]",
            "machine_failure": "Machine failure",
        },
        "notes": (
            "AI4I is a synthetic industrial dataset reflecting predictive-maintenance patterns. "
            "PhysicalOS maps failure rows onto simulated machine IDs; UDI values are not claimed as plant asset IDs."
        ),
    }
    processed = DATA_PROCESSED / "ai4i_sample.json"
    processed.write_text(json.dumps({"imported_at": meta["imported_at"], "sample": sample[:50]}, indent=2), encoding="utf-8")
    store["datasets"] = [meta]
    return meta


def dataset_catalog(store: dict) -> list[dict]:
    if store.get("datasets"):
        return store["datasets"]
    if csv_available():
        rows = load_rows(limit=80)
        return [
            {
                "id": DATASET_ID,
                "name": DATASET_NAME,
                "provider": PROVIDER,
                "license": LICENSE,
                "source_url": SOURCE_URL,
                "status": "available_on_disk",
                "row_count": sum(1 for _ in AI4I_CSV.open(encoding="utf-8")) - 1,
                "imported_at": None,
                "sample": rows,
                "measurements": rows,
            }
        ]
    return []
