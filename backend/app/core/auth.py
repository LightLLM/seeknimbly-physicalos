from __future__ import annotations

from fastapi import Header, HTTPException

from backend.app.core.config import settings


def require_demo_auth(x_demo_admin_token: str | None = Header(default=None, alias="X-Demo-Admin-Token")) -> None:
    """Protect mutating demo routes.

    - If DEMO_ADMIN_TOKEN is set, the header must match.
    - If unset and DEMO_MODE is true, allow local hackathon use.
    - If unset and DEMO_MODE is false, reject.
    """
    expected = settings.demo_admin_token
    if expected:
        if not x_demo_admin_token or x_demo_admin_token != expected:
            raise HTTPException(status_code=401, detail="Invalid or missing X-Demo-Admin-Token")
        return
    if settings.demo_mode:
        return
    raise HTTPException(status_code=401, detail="DEMO_ADMIN_TOKEN is required when DEMO_MODE=false")
