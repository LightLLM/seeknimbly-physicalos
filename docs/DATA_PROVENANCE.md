# Data Provenance — Industrial Datasets

## Primary dataset: AI4I 2020 Predictive Maintenance

| Field | Value |
|-------|-------|
| Name | AI4I 2020 Predictive Maintenance Dataset |
| Provider | UCI Machine Learning Repository |
| Source URL | https://archive.ics.uci.edu/ml/machine-learning-databases/00601/ai4i2020.csv |
| Dataset page | https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance |
| DOI | https://doi.org/10.24432/C5HS5C |
| License | CC BY 4.0 label used by this app. The UCI dataset JSON API retrieved on 2026-10-30 did not include a license field; confirm the badge on the dataset page before redistribution. |
| Version / file | `ai4i2020.csv` (10,000 instances) |
| Inspection date | 2026-10-30 |
| Local path | `data/raw/ai4i2020.csv` |
| Local file size | 522,048 bytes (already present in the workspace at inspection; not re-downloaded in that session) |

### Original fields

`UDI`, `Product ID`, `Type`, `Air temperature [K]`, `Process temperature [K]`, `Rotational speed [rpm]`, `Torque [Nm]`, `Tool wear [min]`, `Machine failure`, `TWF`, `HDF`, `PWF`, `OSF`, `RNF`

### Imported / normalized fields

| Normalized | Source |
|------------|--------|
| `udi` | `UDI` |
| `product_id` | `Product ID` |
| `type` | `Type` |
| `air_temperature_k` | `Air temperature [K]` |
| `process_temperature_k` | `Process temperature [K]` |
| `rotational_speed_rpm` | `Rotational speed [rpm]` |
| `torque_nm` | `Torque [Nm]` |
| `tool_wear_min` | `Tool wear [min]` |
| `machine_failure` | `Machine failure` |
| `twf` / `hdf` / `pwf` / `osf` / `rnf` | matching failure-mode flags |

### Transformation logic

1. CSV is read with Python's `csv.DictReader`.
2. Numeric columns are coerced to `int` / `float`.
3. Deterministic event rule: **`machine_failure == 1`** → `machine_health_exception`.
4. Failure-mode flags are collected into a human-readable mode list for the event message.
5. The first matching failure row (or a requested `udi`) is mapped onto simulated plant machine **`M-CNC-01`**.

### Synthetic additions (application-side only)

- Simulated machine IDs (`M-CNC-01`, `M-CNC-02`, …) are **not** AI4I identifiers.
- Work orders, workers, robots, approvals, and executions are synthetic factory fixtures.
- Mapping note is stored on each replayed event under `synthetic_mapping`.

### Limitations

- AI4I itself is a **synthetic** industrial dataset designed to reflect predictive-maintenance patterns; it is not live plant telemetry.
- PhysicalOS does **not** present historical dataset measurements as live sensor feeds.
- No physical CNC, PLC, or robot is contacted.
- Only failure-flagged rows create operational exceptions; non-failure UDIs return HTTP 400 on replay.

### Repeatable ingestion

```bash
# CSV already at data/raw/ai4i2020.csv after Phase 0 download
curl -L -o data/raw/ai4i2020.csv \
  https://archive.ics.uci.edu/ml/machine-learning-databases/00601/ai4i2020.csv

# Or via API after backend start
curl -X POST http://localhost:8000/api/datasets/import
curl -X POST http://localhost:8000/api/events/replay -H "Content-Type: application/json" -d "{}"
```

## Evaluated but not integrated as primary runtime sources

| Source | Role in this build |
|--------|--------------------|
| NASA Prognostics Data Repository | Documented as future candidate; not required for the demo path |
| ROS 2 message schemas | Reference only via `Ros2CompatibilityAdapter` stub (inactive) |
| Open-RMF | Conceptual reference only — **no runtime Open-RMF integration** |
| OPC UA / MTConnect | Schema inspiration only — **no physical equipment connection** |

## Citation

AI4I 2020 Predictive Maintenance Dataset [Dataset]. (2020). UCI Machine Learning Repository. https://doi.org/10.24432/C5HS5C
