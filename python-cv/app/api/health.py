"""
app/api/health.py

Health-check endpoint.
"""

from __future__ import annotations

import time
from typing import Any, Dict

from fastapi import APIRouter

from app.services.camera_manager import camera_manager
from app.services.face_engine import get_face_engine

router = APIRouter()

_START_TIME: float = time.monotonic()


@router.get("/health", tags=["health"])
async def health_check() -> Dict[str, Any]:
    """
    Returns service health status including:
    - Face engine backend in use
    - Number of active camera streams
    - Service uptime in seconds
    """
    engine = get_face_engine()

    all_statuses = camera_manager.get_all_statuses()
    active_count = sum(
        1 for s in all_statuses.values() if s.get("status") == "active"
    )

    return {
        "status": "ok",
        "uptime": round(time.monotonic() - _START_TIME, 2),
        "backends": {
            "faceEngine":    engine.backend_name,
        },
        "camerasActive":  active_count,
        "camerasTotal":   len(all_statuses),
    }
