from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from fastapi import HTTPException

from backend.app.core.config import settings

logger = logging.getLogger("physicalos.nebius")


def explain_assignment(order: dict, worker: dict, machine: dict, robot: dict, *, fail_closed: bool | None = None) -> dict | None:
    """Call Nebius Token Factory for a one-sentence explanation of a validated assignment.

    Returns None when credentials are missing or inference fails and REQUIRE_AI is false.
    Never invents a successful AI response.
    """
    closed = settings.require_ai if fail_closed is None else fail_closed
    if not settings.ai_configured:
        if closed:
            raise HTTPException(status_code=503, detail="Nebius credentials are required")
        return None
    host = settings.nebius_base_url.lower()
    if "api.openai.com" in host or "openai.com/v1" in host:
        raise HTTPException(status_code=502, detail="Refusing OpenAI-hosted inference")

    prompt = (
        "Explain this already safety-validated manufacturing assignment in one concise sentence. "
        "Do not change IDs, invent certifications, override safety rules, approve the assignment, "
        "or claim real robot or machine control. "
        f"Order={order['id']} task={order.get('task')}; "
        f"worker={worker.get('name')} skills={worker.get('skills')}; "
        f"machine={machine.get('id')} type={machine.get('type')}; "
        f"simulated_robot={robot.get('id')} type={robot.get('type')}."
    )
    payload = {
        "model": settings.nebius_model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an auditable factory dispatch explainer. "
                    "Deterministic safety checks always prevail. Human supervisors authorize execution."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "max_tokens": settings.nebius_max_output_tokens,
        "temperature": 0.1,
    }
    url = f"{settings.nebius_base_url}/chat/completions"
    headers = {"Authorization": f"Bearer {settings.nebius_api_key}", "Content-Type": "application/json"}

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, headers=headers, json=payload)
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"Nebius inference HTTP {response.status_code}")
        result: dict[str, Any] = response.json()
        text = result["choices"][0]["message"]["content"].strip()
        request_id = result.get("id")
        return {
            "source": "nebius_token_factory",
            "model": settings.nebius_model,
            "explanation": text,
            "rationale": text,
            "request_id": request_id,
            "inference_request_id": request_id,
        }
    except HTTPException:
        if closed:
            raise
        logger.warning("Nebius inference failed; falling back to rules mode")
        return None
    except (httpx.HTTPError, KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        if closed:
            raise HTTPException(status_code=502, detail=f"Nebius inference failed: {type(exc).__name__}") from exc
        logger.warning("Nebius inference error %s; rules fallback", type(exc).__name__)
        return None


def test_inference(order: dict, worker: dict, machine: dict, robot: dict) -> dict:
    if not settings.ai_configured:
        raise HTTPException(status_code=503, detail="Set NEBIUS_API_KEY and NEBIUS_MODEL")
    result = explain_assignment(order, worker, machine, robot, fail_closed=True)
    if not result:
        raise HTTPException(status_code=502, detail="Nebius inference did not return a verified result")
    return {
        "verified": True,
        "provider": "Nebius Token Factory",
        "source": "nebius_token_factory",
        "model": result["model"],
        "rationale": result["rationale"],
        "explanation": result["explanation"],
        "request_id": result.get("request_id"),
    }
