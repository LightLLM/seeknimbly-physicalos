# Security

## Secrets

- `NEBIUS_API_KEY` and `DEMO_ADMIN_TOKEN` are server-side or operator-entered.
- The frontend reads the demo token from localStorage (`seeknimbly.demoAdminToken`) and sends `X-Demo-Admin-Token`. It is not compiled into the bundle.
- Logs for inference failures record the exception type, not the bearer token or response body.

## Authorization

Mutating routes use `require_demo_auth`:

- If `DEMO_ADMIN_TOKEN` is set, the header must match.
- If it is empty and `DEMO_MODE=true` (the default), local demo calls are allowed and the actor is not taken from a client-supplied name.
- If demo mode is off and no token is set, mutating calls are rejected.

This is a hackathon demo control, not enterprise SSO.

## Safety boundary

- Eligibility is computed in `safety_engine.py` before any Nebius call.
- A proposal that does not match that assignment is rejected with 400.
- The model text is stored as an explanation. Approval is a separate human decision.
- Simulated adapters do not open sockets to robots. `Ros2CompatibilityAdapter.command` returns `accepted: false`.
- Dataset import reads only the bundled AI4I file. Request bodies cannot choose an arbitrary filesystem path.

## Other controls

- CORS allows the configured frontend origin plus localhost ports 3000 and 8000.
- Inference refuses hosts that contain `api.openai.com`.
- Audit rows are inserted. Ordinary routes do not update or delete historical audit rows. Demo reset clears the demo database on purpose.
- Approval updates use `status='pending'` so a second decision returns 409.
- A second simulate for the same workflow returns 409.
- Errors from Nebius include the HTTP status or exception class, not the key.

## Known limits

- Empty `DEMO_ADMIN_TOKEN` plus `DEMO_MODE=true` leaves mutating routes open on a reachable API. Set a token before any shared deploy.
- SQLite on a serverless disk is not durable and is not a multi-tenant store.
- Dependency audit (`pip` / `npm audit`) was not treated as a release gate in this session. Run it before a public launch.
