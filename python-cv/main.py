"""
main.py

FastAPI application entry point for the Smart Attendance CV Service.

Run with:
    uvicorn main:app --host 0.0.0.0 --port 8001 --reload
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# --------------------------------------------------------------------------- #
# Logging must be configured before any other import that uses a logger.
# --------------------------------------------------------------------------- #
from app.core.config import get_settings
from app.core.logging import setup_logging

_settings = get_settings()
setup_logging(level=_settings.log_level, environment=_settings.environment)

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# Deferred imports (after logging is set up)
# --------------------------------------------------------------------------- #
from app.api import cameras, health, recognition  # noqa: E402
from app.services.attendance_notifier import attendance_notifier  # noqa: E402
from app.services.camera_manager import camera_manager  # noqa: E402
from app.services.face_engine import get_face_engine  # noqa: E402


# --------------------------------------------------------------------------- #
# Lifespan
# --------------------------------------------------------------------------- #

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup and shutdown handlers."""
    # ---- Startup ----
    logger.info("=" * 60)
    logger.info("Smart Attendance CV Service — starting up")
    logger.info("Port: %d | Backend: %s | Environment: %s",
                _settings.port, _settings.face_recognition_backend, _settings.environment)
    logger.info("=" * 60)

    # Eagerly initialise the face engine so the first request is fast.
    try:
        engine = get_face_engine()
        logger.info("FaceEngine ready — backend: %s", engine.backend_name)
    except Exception as exc:  # noqa: BLE001
        logger.critical("FaceEngine initialisation FAILED: %s", exc)
        # Don't abort startup; detection endpoints will return errors gracefully.

    yield

    # ---- Shutdown ----
    logger.info("Shutting down — stopping all camera streams…")
    camera_manager.stop_all()
    await attendance_notifier.close()
    logger.info("Shutdown complete.")


# --------------------------------------------------------------------------- #
# Application
# --------------------------------------------------------------------------- #

app = FastAPI(
    title       = "Smart Attendance CV Service",
    description = (
        "Computer vision service for the Smart Attendance System. "
        "Provides RTSP camera management, face detection, and recognition."
    ),
    version     = "1.0.0",
    lifespan    = lifespan,
    docs_url    = "/docs",
    redoc_url   = "/redoc",
)

# ---- CORS ----
app.add_middleware(
    CORSMiddleware,
    allow_origins     = _settings.cors_origins_list,
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ---- Routers ----
app.include_router(health.router,          tags=["health"])
app.include_router(cameras.router,    prefix="/cameras",     tags=["cameras"])
app.include_router(recognition.router, prefix="/recognition", tags=["recognition"])


# --------------------------------------------------------------------------- #
# Dev entry point
# --------------------------------------------------------------------------- #
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host    = "0.0.0.0",
        port    = _settings.port,
        reload  = _settings.is_development,
        log_level = _settings.log_level.lower(),
    )
