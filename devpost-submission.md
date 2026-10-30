# Seeknimbly PhysicalOS — Devpost draft

**Tagline:** One operating system for humans, AI agents, and machines.

## Inspiration

Factories coordinate qualifications, machine health, and dispatch across disconnected systems. When a cell fails, supervisors need a safe, explainable, auditable recovery path—not an autonomous model that can invent eligibility or command equipment.

## What it does

PhysicalOS replays a public AI4I machine-health failure, marks the affected synthetic CNC unavailable, computes an eligible alternate assignment with deterministic safety rules, optionally asks Nebius-hosted NVIDIA Nemotron for a one-sentence explanation, requires a human supervisor decision, runs a simulated dispatch, and records an append-only audit trail.

## How we built it

- FastAPI orchestration backend (safety engine, workflow state machine, SQLite audit, simulated adapters)
- Next.js enterprise console (Command Center, orchestration, approvals, datasets, executions, audit)
- UCI AI4I 2020 (CC BY 4.0) as the open industrial event source
- Nebius Token Factory OpenAI-compatible adapter for `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`

## Challenges we ran into

Preserving a hard boundary between probabilistic explanation and deterministic eligibility; keeping dataset provenance honest when mapping public UDIs onto simulated plant IDs; delivering a complete demo without physical robot control.

## Accomplishments that we're proud of

A working end-to-end recovery demo, enterprise UI, documented dataset provenance, automated backend tests, and an inference path that fails closed or falls back to clearly labeled rules—never fake AI success.

## What we learned

Industrial AI demos are strongest when the model is downstream of safety and upstream of human approval.

## What's next

Durable PostgreSQL state, richer multi-supervisor auth, and future-facing ROS 2 / Open-RMF adapters that remain simulation-gated until real integrations are tested.

## Built with

FastAPI, Pydantic, SQLite, Next.js, React, TypeScript, Tailwind CSS, TanStack Query, React Flow, Recharts, Nebius Token Factory, NVIDIA Nemotron, UCI AI4I 2020

## Try it out

- Repository: **PENDING PUBLICATION**
- Live demo: **PENDING APPROVED DEPLOY**
- Video: **PENDING PUBLIC YOUTUBE UPLOAD**

## Truth checks before submission

- [ ] `/api/inference/test` succeeds with a real Nebius key (if claiming AI evidence)
- [ ] Dashboard shows `source: nebius_token_factory` only after a real call
- [ ] Public GitHub + MIT LICENSE
- [ ] YouTube video under three minutes
- [ ] Official hackathon rules/eligibility/deadline confirmed
- [ ] Explicit entrant approval to submit

Recommended track: **Best apps and agents**.
