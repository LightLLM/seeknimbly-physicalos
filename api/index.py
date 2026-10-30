"""Vercel / uvicorn entrypoint for Seeknimbly PhysicalOS.

Preserves the historical `api.index:app` import path while the implementation
lives in `backend.app.main`.
"""

from backend.app.main import app, reset_runtime_for_tests

__all__ = ["app", "reset_runtime_for_tests"]
