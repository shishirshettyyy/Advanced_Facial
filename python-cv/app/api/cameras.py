"""
app/api/cameras.py

Camera management endpoints.

POST /cameras/start   — start a camera stream
POST /cameras/stop    — stop a camera stream
GET  /cameras/status  — list all camera statuses
GET  /cameras/{id}/status — single camera status
POST /cameras/test    — probe an RTSP/USB URL briefly
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, Optional

import cv2
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.services.attendance_notifier import attendance_notifier
from app.services.camera_manager import camera_manager

logger = logging.getLogger(__name__)

router = APIRouter()


# --------------------------------------------------------------------------- #
# Request / Response models
# --------------------------------------------------------------------------- #

class StartCameraRequest(BaseModel):
    camera_id: str
    rtsp_url: str
    session_id: str
    node_callback_url: Optional[str] = ""
    prefetch_face_db: Optional[bool] = True  # fetch embeddings from Node.js at start


class StopCameraRequest(BaseModel):
    camera_id: str


class TestStreamRequest(BaseModel):
    rtsp_url: str


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #

@router.post("/start")
async def start_camera(
    body: StartCameraRequest,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    """
    Start a new camera stream.

    If prefetch_face_db is True (default) the service will fetch the current
    face embeddings from Node.js before starting so recognition works
    immediately.
    """
    all_statuses = camera_manager.get_all_statuses()
    if body.camera_id in all_statuses:
        existing = all_statuses[body.camera_id]
        if existing.get("status") in ("active", "connecting"):
            raise HTTPException(
                status_code=409,
                detail=f"Camera '{body.camera_id}' is already running.",
            )
        # Remove stale entry so we can restart
        camera_manager.remove_camera(body.camera_id)

    # Optionally pre-fetch face DB
    face_db: list = []
    if body.prefetch_face_db:
        try:
            face_db = await attendance_notifier.fetch_face_db()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not pre-fetch face DB: %s", exc)

    try:
        camera_manager.add_camera(
            camera_id         = body.camera_id,
            rtsp_url          = body.rtsp_url,
            session_id        = body.session_id,
            node_callback_url = body.node_callback_url or "",
            face_db           = face_db,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return {
        "success":    True,
        "message":    f"Camera '{body.camera_id}' started.",
        "faceDbSize": len(face_db),
    }


@router.post("/stop")
async def stop_camera(body: StopCameraRequest) -> Dict[str, Any]:
    """Stop a running camera stream."""
    all_statuses = camera_manager.get_all_statuses()
    if body.camera_id not in all_statuses:
        raise HTTPException(
            status_code=404,
            detail=f"Camera '{body.camera_id}' not found.",
        )
    # run_in_executor so the join() doesn't block the event loop
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, camera_manager.remove_camera, body.camera_id)
    return {"success": True, "cameraId": body.camera_id}


@router.get("/status")
async def get_all_statuses() -> Dict[str, Any]:
    """Return status for all registered cameras."""
    return {"cameras": camera_manager.get_all_statuses()}


@router.get("/{camera_id}/status")
async def get_camera_status(camera_id: str) -> Dict[str, Any]:
    """Return status for a single camera."""
    status = camera_manager.get_status(camera_id)
    if status is None:
        raise HTTPException(
            status_code=404,
            detail=f"Camera '{camera_id}' not found.",
        )
    return status


@router.post("/test")
async def test_stream(body: TestStreamRequest) -> Dict[str, Any]:
    """
    Open a stream briefly, read up to 5 frames, then close it.

    Returns resolution and measured FPS.  Does NOT persist the camera.
    """

    def _probe(rtsp_url: str) -> Dict[str, Any]:
        cap_arg: int | str = rtsp_url
        if rtsp_url.strip().isdigit():
            cap_arg = int(rtsp_url.strip())

        cap = cv2.VideoCapture(cap_arg)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        if not cap.isOpened():
            return {"success": False, "message": "Could not open stream.", "resolution": "", "fps": 0.0}

        width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        t0 = time.monotonic()
        frames_read = 0
        for _ in range(5):
            ret, _ = cap.read()
            if not ret:
                break
            frames_read += 1
        elapsed = time.monotonic() - t0

        cap.release()

        if frames_read == 0:
            return {"success": False, "message": "Stream opened but no frames received.", "resolution": "", "fps": 0.0}

        fps = frames_read / elapsed if elapsed > 0 else 0.0
        return {
            "success":    True,
            "message":    f"Stream OK — read {frames_read} frames.",
            "resolution": f"{width}x{height}",
            "fps":        round(fps, 2),
        }

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _probe, body.rtsp_url)
    return result
