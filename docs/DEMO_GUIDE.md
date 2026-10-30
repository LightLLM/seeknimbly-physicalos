# Demo guide

PhysicalOS is a simulation. Nothing in this guide contacts a real machine or robot.

## Start

From the repository root:

```bash
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\uvicorn api.index:app --host 127.0.0.1 --port 8000
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. The API is http://127.0.0.1:8000. Set `NEXT_PUBLIC_API_BASE_URL` if the API is not on port 8000.

Copy `.env.example` to `.env` only when you have a Nebius Token Factory key. Without `NEBIUS_API_KEY` and `NEBIUS_MODEL`, recommendations stay in **deterministic rules fallback**. That label is not an AI explanation.

If `DEMO_ADMIN_TOKEN` is set, paste the same value into Settings. The browser stores it in localStorage and sends it as `X-Demo-Admin-Token`. It is not a `NEXT_PUBLIC_` variable.

## Primary path (about three minutes)

1. Command Center. KPIs come from `/api/state` and the SQLite queue.
2. Replay the first AI4I failure (UDI 51 in the bundled file, power-failure flag). Simulated machine `M-CNC-01` goes to fault. Work order `O1` is the affected order. The UDI is not a machine id.
3. Generate a recommendation. The safety engine should select worker 1 (Amina), alternate CNC `M-CNC-02`, and material robot `R1`.
4. Read the explanation. With no Nebius key, the text starts with "Deterministic rules fallback". With a real key, `source` is `nebius_token_factory` and the response includes the model id and the provider request id.
5. Create the proposal and approve it in the confirmation dialog. A second decision returns 409.
6. Simulate dispatch. The execution completes in the same request. Status is simulated.
7. Open Audit and confirm proposal, approval, and dispatch events.

`POST /api/demo/reset` restores the seed. It requires the demo token when one is configured.

## Supporting checks

- Post a proposal for worker 8 (Luis, maintenance only) on `O1`. The API returns 400 and does not call Nebius.
- `POST /api/events/replay` with `{"scenario":"robot_unavailable"}` marks `R1` unavailable. `GET /api/recommend/O1` then returns 409 because no second material robot is seeded.

## What not to claim on camera

- Do not show `/api/inference/test` as verified unless the response has `verified: true` from a live Nebius call in that session.
- Do not describe AI4I rows as live plant sensors. UCI describes the dataset as synthetic.
- Do not imply physical robot motion. Adapters are simulated. `Ros2CompatibilityAdapter` does not send commands.
