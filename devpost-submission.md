# Seeknimbly PhysicalOS — Devpost draft

**Tagline:** Human-approved manufacturing dispatch for workers and simulated robots, with deterministic safety checks and Nebius-hosted NVIDIA explanations.

## Inspiration

Factories frequently coordinate workforce availability, qualifications, production orders, and machine capacity across disconnected spreadsheets. A supervisor needs a safe, auditable answer when an urgent order arrives and the planned worker is unavailable.

## What it does

PhysicalOS evaluates synthetic work orders against worker availability and skills, selects a compatible simulated robot, and proposes an eligible assignment. A supervisor must approve or reject the proposal, and every action is recorded. An NVIDIA open-source model hosted by Nebius Token Factory can explain the already-validated recommendation; it cannot override the deterministic checks.

## How we built it

FastAPI serves a lightweight HTML/JavaScript dashboard and API. SQLite stores demo proposals and audit events. The safety-critical eligibility engine is deterministic. The Nebius adapter calls the OpenAI-compatible Token Factory chat-completions endpoint using a model chosen from the authenticated model catalog and returns the model and inference request provenance.

## Challenges and learning

The main design challenge was preserving a strict boundary between probabilistic explanation and deterministic operational eligibility. Human approval and visible provenance made the workflow safer and easier to audit.

## Significant updates after August 26, 2026

We turned an earlier synthetic-factory concept into a standalone, deployable workflow; added qualification and compatibility checks, supervisor approval, audit logging, tests, Vercel packaging, and the Nebius Token Factory adapter.

## Links — pending final verification

- Demo: https://seeknimbly-physicalos.vercel.app
- Repository: **PENDING PUBLICATION**
- Video: **PENDING PUBLIC YOUTUBE UPLOAD**

## Required truth checks before submission

- [ ] `/api/inference/test` succeeds with a real Nebius key and eligible NVIDIA model.
- [ ] Dashboard recommendation reports `source: nebius_token_factory`.
- [ ] Exact model ID, quality, latency, and platform feedback recorded from the real run.
- [ ] Public GitHub repository contains MIT license and setup instructions.
- [ ] Public YouTube video is under three minutes.
- [ ] All required Devpost form answers reviewed by the entrant.

## Draft form answers that require entrant input

- Submitter type and organization name.
- Country of residence and Canadian province if applicable.
- Age-majority and employee-status confirmations.
- First-hand Nemotron scores, comparisons, and Nebius feedback after the live run.

Recommended track: **Best apps and agents**. Tavily: **No**, unless a real runtime Tavily integration is added and demonstrated.
