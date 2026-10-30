# Deployment

This session did not deploy the app and did not call `vercel`. A previous README mentioned https://seeknimbly-physicalos.vercel.app. That URL was not rechecked here.

## Local

- API: `uvicorn api.index:app --host 127.0.0.1 --port 8000`
- UI: `npm run dev` in `frontend/`
- Database: SQLite at `PHYSICALOS_DB` (default `./physicalos.db`). On Vercel the code uses `/tmp/physicalos.db`, which is ephemeral.

## Suggested hosted split

- Next.js frontend as its own project, with `NEXT_PUBLIC_API_BASE_URL` pointing at the API origin.
- FastAPI as `api/index.py`. `vercel.json` rewrites traffic to that function. Do not put the Next.js app in the same Vercel project as that rewrite; the rewrite would capture the UI routes.
- Set `NEBIUS_API_KEY`, `NEBIUS_MODEL`, and `NEBIUS_BASE_URL` only on the API host.
- Set `DEMO_ADMIN_TOKEN` before exposing mutating routes.
- Prefer PostgreSQL (`DATABASE_URL`) if more than one instance must share workflow state. The current Python path uses SQLite through `PHYSICALOS_DB` / `db_path()`. A Postgres URL in `DATABASE_URL` is not wired through the live SQLite connection helper.

## Smoke URLs after a deploy you choose to make

```text
/
/api/health
/api/state
/api/recommend/O1
/api/inference/test
```

`/api/inference/test` returns 503 until both Nebius variables are set. A 200 with `verified: true` is the only evidence of a live call. This repository does not contain that evidence.

## Do not

- Deploy, buy infrastructure, or submit to Devpost without an explicit decision.
- Put the API key in any `NEXT_PUBLIC_` variable or in the frontend bundle.
