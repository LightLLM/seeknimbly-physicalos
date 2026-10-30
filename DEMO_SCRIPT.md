# Demo video script (target 2:30)

## 0:00–0:20 — Problem and promise

“Factories coordinate qualifications, availability, urgent work orders, and machines across disconnected systems. PhysicalOS proposes a safe assignment, keeps a supervisor in control, and records every decision.”

Show the title, synthetic-data label, and counts.

## 0:20–0:55 — Deterministic guardrails

Select O1 and click **Recommend**. Point out the selected worker and simulated robot. Explain that availability, qualifications, and compatibility are checked in code before model inference.

## 0:55–1:25 — Nebius + NVIDIA evidence

Show `/api/inference/test` returning `verified: true`, provider `Nebius Token Factory`, and the exact NVIDIA model. Return to the dashboard and show the recommendation source as `nebius_token_factory`. Do not record this segment until a real call succeeds.

## 1:25–2:00 — Human approval and audit

Request supervisor approval, approve the pending proposal, and show the audit events. Explain that the model cannot approve its own recommendation or control real machinery.

## 2:00–2:30 — Architecture and impact

Briefly show the repository README and architecture: synthetic factory state → deterministic eligibility → Nebius-hosted NVIDIA explanation → supervisor → audit trail. Close with the vision: an auditable control plane for human, AI-agent, and robotic work.

## Capture checklist

- Browser at 1920×1080 or 1280×720; zoom so text is readable.
- No API key, account email, private repository, terminal history, or personal tabs visible.
- Public YouTube visibility, no copyrighted music, and final duration under 3:00.
- Show at least one complete workflow and the real inference evidence.

