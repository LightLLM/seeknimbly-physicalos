# Hackathon submission draft

Do not submit this draft. It is notes for a later Devpost form. Live demo URL and video URL are blank because they were not produced in this session.

## Project title

Seeknimbly PhysicalOS

## Short description

A simulation-only operating picture for factory work: public machine-health data, deterministic safety checks, an optional Nebius-hosted NVIDIA explanation, and a human approval before any simulated dispatch.

## Inspiration

Production exceptions still get resolved across spreadsheets, radios, and separate robot tools. Supervisors need one place to see who can legally take the work, and a record of who allowed it.

## What we built

A FastAPI orchestration API and a Next.js supervisor console. The demo replays a row from the UCI AI4I 2020 Predictive Maintenance dataset, marks a simulated CNC unavailable, proposes an eligible worker, alternate machine, and simulated robot, and completes only after approval.

## How it works

Industrial event, context, deterministic safety validation, optional Nebius explanation, human approval, simulated dispatch, execution record, audit trail. The model does not authorize execution.

## Technologies

Python, FastAPI, Pydantic, SQLite, Next.js, React, TypeScript, Tailwind CSS, TanStack Query, React Flow, Recharts.

## Nebius / NVIDIA

Adapter target: `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` at `https://api.tokenfactory.us-central1.nebius.com/v1/chat/completions`.

This workspace has no `NEBIUS_API_KEY`. `/api/inference/test` returns 503 until both the key and model are set. Rules fallback is labeled as such. Do not paste a model score, latency, or “verified” claim into Devpost until a live response is captured.

## Open data

UCI AI4I 2020, DOI 10.24432/C5HS5C. UCI describes the table as synthetic. See `docs/DATA_PROVENANCE.md`. The local CSV has 10,000 rows and was already in the repo at inspection (522,048 bytes). NASA, ROS 2, Open-RMF, OPC UA, and MTConnect are references only.

## Challenges

Keeping explanation separate from eligibility, and keeping the demo request-driven so a serverless host does not need a background worker.

## Accomplishments that were checked here

- Backend pytest: 19 passed.
- Frontend Vitest: 16 passed across 4 files.
- Unsafe worker assignment and an unavailable material robot both stop before Nebius.
- The approved path can complete a simulated execution and reject a second dispatch.

## What we learned

A one-sentence model explanation is useful only when the IDs were chosen by code and a person still has to approve.

## What's next

Durable shared storage, real identity, and a ROS 2 adapter that stays disabled until a lab allows it. Not physical control from this demo.

## Links

- GitHub: https://github.com/LightLLM/seeknimbly-physicalos (publish only after the operator pushes)
- Live demo: not deployed in this session
- Demo video: not recorded

## Suggested video (under 3:00)

0:00 problem, 0:20 command center, 0:40 AI4I replay, 1:05 validation and explanation provenance, 1:30 approval, 1:55 simulated completion, 2:20 audit, 2:40 human + agent + robot vision. Use the running app, not mock screenshots.

## Checklist before submitting

- [ ] Live `/api/inference/test` with `verified: true`
- [ ] Public repo
- [ ] Public demo URL you have opened yourself
- [ ] Public YouTube video under three minutes
- [ ] Hackathon category, eligibility, and deadline re-read on the official page
- [ ] Entrant identity fields filled by the entrant
