# Seeknimbly PhysicalOS

Supervisor console for simulated factory work. A public machine-health table can raise an exception, the safety engine picks an eligible worker, machine, and robot, and a person approves before any simulated dispatch. An optional Nebius-hosted NVIDIA model may explain that assignment. It does not approve it and it does not move equipment.

## End-to-end data flow

What happens when you start the app and run the primary demo (Factory Operations → Demo runbook):

```mermaid
flowchart TD
    START["Start app<br/>uvicorn :8000 + Next.js :3000"]
    UI["Factory Operations UI<br/>http://localhost:3000"]
    API["FastAPI orchestration<br/>http://127.0.0.1:8000"]
    SEED["Seeded factory state<br/>8 workers · 5 orders · 6 machines · 3 robots"]
    DS["Bundled UCI AI4I 2020 CSV<br/>data/raw/ai4i2020.csv"]
    REPLAY["Replay machine-health event<br/>POST /api/events/replay"]
    EVT["Operational Event Engine<br/>fault M-CNC-01 · affect O1"]
    SAFE["Deterministic Safety Engine<br/>GET /api/recommend/O1"]
    FAIL["Invalid assignment<br/>HTTP 4xx · no Nebius call"]
    NEB["Nebius Token Factory<br/>POST /chat/completions"]
    NEM["NVIDIA Nemotron<br/>nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"]
    RULES["Rules fallback<br/>labeled · not AI"]
    PROP["Create proposal<br/>POST /api/proposals"]
    SUP["Supervisor approval<br/>POST /api/proposals/{id}/decision"]
    SIM["Simulated dispatch<br/>POST /api/workflows/{id}/simulate"]
    MON["Execution monitoring<br/>GET /api/executions"]
    AUD["Append-only audit trail<br/>GET /api/audit"]

    START --> UI
    START --> API
    API --> SEED
    UI -->|"Demo runbook / live queries"| API
    DS --> REPLAY --> EVT --> SAFE
    SAFE -->|"unsafe / ineligible"| FAIL
    SAFE -->|"validated assignment only"| NEB
    NEB -->|"credentials + model available"| NEM
    NEB -->|"missing key or inference failure<br/>PHYSICALOS_REQUIRE_AI=false"| RULES
    NEM -->|"one-sentence explanation"| PROP
    RULES --> PROP
    SAFE --> PROP
    PROP --> SUP -->|"approved"| SIM --> MON --> AUD
    SUP -->|"rejected"| AUD
    EVT --> AUD
    SAFE --> AUD
    PROP --> AUD
    SIM --> AUD
```

**Safety boundary:** Nebius Nemotron explains a validated recommendation. It cannot change resource IDs, invent certifications, approve work, or command equipment. Simulated adapters only.

## Run

```bash
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\uvicorn api.index:app --host 127.0.0.1 --port 8000
```

```bash
cd frontend
npm install
npm run dev
```

| Surface | URL |
|---------|-----|
| Factory Operations UI | http://localhost:3000 |
| API | http://127.0.0.1:8000 |
| Health | http://127.0.0.1:8000/api/health |
| Inference probe | http://127.0.0.1:8000/api/inference/test |

Tests: `.venv\Scripts\python -m pytest -q` and, in `frontend/`, `npm run test` · `npm run test:e2e`.

Copy `.env.example` to `.env` when you have a Nebius Token Factory key. Required model id: `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`. Base URL: `https://api.tokenfactory.us-central1.nebius.com/v1`. Without a key, recommendations use a deterministic rules fallback and say so.

## What is implemented

- Eight synthetic workers, five work orders, six simulated machines, three simulated robots.
- Replay of the bundled UCI AI4I 2020 CSV (`data/raw/ai4i2020.csv`, 10,000 rows). A `Machine failure = 1` row faults simulated machine `M-CNC-01` and affects work order `O1`. Dataset UDIs are not machine ids. UCI describes this dataset as synthetic.
- Deterministic eligibility, supervisor approve/reject, duplicate-decision rejection, simulated adapters, and an audit log.
- Next.js Factory Operations console: dashboard, factory floor, work orders, workforce, machines, robots, AI orchestration, approvals, executions, datasets, audit, and settings.

## What is not claimed

- Live Nebius inference requires `NEBIUS_API_KEY` and `NEBIUS_MODEL`. Without them, `/api/inference/test` returns 503 and explanations stay on the labeled rules fallback.
- No Vercel deploy is implied by this README.
- No physical robot, PLC, or ROS 2 command path is active.
- SQLite on a serverless disk is ephemeral.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Data provenance](docs/DATA_PROVENANCE.md)
- [Demo guide](docs/DEMO_GUIDE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Security](docs/SECURITY.md)
- [Hackathon draft](docs/HACKATHON_SUBMISSION.md) — not submitted

MIT license. See [LICENSE](LICENSE).
