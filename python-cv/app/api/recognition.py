"""
app/api/recognition.py

Face recognition endpoints.

POST /recognition/enroll        — enrol a student from uploaded images
POST /recognition/identify      — identify faces in an uploaded image
GET  /recognition/face-db/refresh — reload face embeddings from Node.js
"""

from __future__ import annotations

import logging
from io import BytesIO
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from PIL import Image

from app.services.attendance_notifier import attendance_notifier
from app.services.camera_manager import camera_manager
from app.services.face_engine import get_face_engine

logger = logging.getLogger(__name__)

router = APIRouter()


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _load_image_from_upload(upload: UploadFile) -> Optional[np.ndarray]:
    """Read an UploadFile and return a BGR OpenCV ndarray, or None on failure."""
    try:
        raw = upload.file.read()
        pil = Image.open(BytesIO(raw)).convert("RGB")
        frame = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
        return frame
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to decode upload '%s': %s", upload.filename, exc)
        return None


def _embedding_quality(embeddings: List[np.ndarray]) -> float:
    """
    Simple quality score: mean pairwise cosine similarity between samples.
    Higher = more consistent set of images.  Returns 1.0 for a single sample.
    """
    if len(embeddings) <= 1:
        return 1.0
    sims = []
    engine = get_face_engine()
    for i in range(len(embeddings)):
        for j in range(i + 1, len(embeddings)):
            sims.append(engine.compute_raw_cosine(embeddings[i], embeddings[j]))
    mean_sim = sum(sims) / len(sims)
    # Map [-1, 1] → [0, 1]
    return max(0.0, min(1.0, (mean_sim + 1.0) / 2.0))


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #

@router.post("/enroll")
async def enroll_student(
    student_id: str = Form(...),
    files: List[UploadFile] = File(..., description="Up to 10 face images"),
) -> Dict[str, Any]:
    """
    Enrol a student by processing up to 10 face images.

    For each image:
      1. Detect face(s)
      2. Align the largest face
      3. Extract embedding

    Then compute the average embedding and POST it to Node.js.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")
    if len(files) > 10:
        files = files[:10]

    engine     = get_face_engine()
    embeddings: List[np.ndarray] = []
    skipped    = 0

    for upload in files:
        frame = _load_image_from_upload(upload)
        if frame is None:
            skipped += 1
            continue

        detections = engine.detect_faces(frame)
        if not detections:
            logger.debug("Enrol: no face detected in '%s'", upload.filename)
            skipped += 1
            continue

        # Pick the largest face by area
        largest = max(detections, key=lambda d: d["bbox"][2] * d["bbox"][3])
        aligned = engine.align_face(frame, largest["bbox"])
        if aligned is None:
            skipped += 1
            continue

        emb = engine.extract_embedding(aligned)
        if emb is None:
            skipped += 1
            continue

        embeddings.append(emb)

    if not embeddings:
        raise HTTPException(
            status_code=422,
            detail="No usable face images — ensure faces are clearly visible.",
        )

    avg_embedding: np.ndarray = np.mean(np.stack(embeddings), axis=0)
    # Re-normalise the average
    norm = np.linalg.norm(avg_embedding)
    if norm > 1e-10:
        avg_embedding = avg_embedding / norm

    quality = _embedding_quality(embeddings)

    # Persist on Node.js side
    success = await attendance_notifier.save_face_profile(
        student_id        = student_id,
        avg_embedding     = avg_embedding.tolist(),
        samples_processed = len(embeddings),
        quality_score     = quality,
    )

    return {
        "success":          success,
        "studentId":        student_id,
        "samplesProcessed": len(embeddings),
        "samplesSkipped":   skipped,
        "qualityScore":     round(quality, 4),
    }


@router.post("/identify")
async def identify_faces(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
) -> Dict[str, Any]:
    """
    Identify all faces in a single uploaded image.

    If session_id is provided, the face database from that camera session's
    cache is used (faster).  Otherwise a fresh fetch from Node.js is performed.
    """
    frame = _load_image_from_upload(file)
    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode image.")

    engine = get_face_engine()

    # Resolve face DB
    face_db: List[Dict] = []
    if session_id:
        # Try to get from an active camera session's cache
        status = camera_manager.get_status(session_id)
        if status is None:
            # session_id supplied but no camera — treat it as a note, fetch fresh
            face_db = await attendance_notifier.fetch_face_db()
        else:
            # Access the camera state's face_db directly
            with camera_manager._lock:  # noqa: SLF001
                cam_state = camera_manager._cameras.get(session_id)  # noqa: SLF001
                face_db = cam_state.face_db if cam_state else []
    else:
        face_db = await attendance_notifier.fetch_face_db()

    detections = engine.detect_faces(frame)
    results: List[Dict] = []

    for det in detections:
        bbox    = det["bbox"]
        aligned = engine.align_face(frame, bbox)
        if aligned is None:
            results.append({
                "bbox":       {"x": bbox[0], "y": bbox[1], "w": bbox[2], "h": bbox[3]},
                "matched":    False,
                "studentId":  None,
                "confidence": 0.0,
            })
            continue

        emb = engine.extract_embedding(aligned)
        if emb is None:
            results.append({
                "bbox":       {"x": bbox[0], "y": bbox[1], "w": bbox[2], "h": bbox[3]},
                "matched":    False,
                "studentId":  None,
                "confidence": 0.0,
            })
            continue

        match = engine.match_embedding(emb, face_db)
        results.append({
            "bbox":       {"x": bbox[0], "y": bbox[1], "w": bbox[2], "h": bbox[3]},
            "matched":    match["matched"],
            "studentId":  match.get("studentId"),
            "confidence": match.get("similarity", 0.0),
        })

    return {"faces": results, "totalDetected": len(results)}


@router.get("/face-db/refresh")
async def refresh_face_db() -> Dict[str, Any]:
    """
    Re-fetch face embeddings from Node.js and push them into all active
    camera sessions.

    Returns the count of embeddings loaded.
    """
    face_db = await attendance_notifier.fetch_face_db()
    count   = len(face_db)

    # Push update to all running cameras
    all_statuses = camera_manager.get_all_statuses()
    updated = 0
    for camera_id in all_statuses:
        if camera_manager.refresh_face_db(camera_id, face_db):
            updated += 1

    logger.info("FaceDB refreshed: %d embeddings, pushed to %d cameras.", count, updated)
    return {
        "success":        True,
        "embeddingsCount": count,
        "camerasUpdated": updated,
    }
