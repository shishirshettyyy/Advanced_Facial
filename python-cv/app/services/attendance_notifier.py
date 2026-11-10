"""
app/services/attendance_notifier.py

Sends recognition events to the Node.js backend via HTTP.
Uses httpx async client with retry-once logic.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Global async client — reused across requests for connection pooling.
# Instantiated lazily so tests can override settings before first use.
_client: Optional[httpx.AsyncClient] = None


def _get_client() -> httpx.AsyncClient:
    global _client  # noqa: PLW0603
    if _client is None or _client.is_closed:
        settings = get_settings()
        _client = httpx.AsyncClient(
            base_url=settings.node_backend_url,
            timeout=httpx.Timeout(10.0, connect=5.0),
            headers={
                "Content-Type": "application/json",
                "X-Internal-Secret": settings.internal_secret,
            },
        )
    return _client


class AttendanceNotifier:
    """Posts recognition events and face-enrolment data to the Node.js backend."""

    # ------------------------------------------------------------------ #
    # Recognition event
    # ------------------------------------------------------------------ #

    async def notify_recognition(
        self,
        camera_id: str,
        session_id: str,
        student_id: Optional[str],
        confidence: float,
        bbox: Dict[str, int],
        is_unknown: bool,
        frame_snapshot: Optional[str] = None,  # base64 JPEG thumbnail
    ) -> bool:
        """
        POST /internal/recognition-event to Node.js.

        Returns True if the notification was accepted (2xx), False otherwise.
        Retries once on network failure.
        """
        payload: Dict[str, Any] = {
            "cameraId": camera_id,
            "sessionId": session_id,
            "studentId": student_id,
            "confidence": round(confidence, 4),
            "bbox": bbox,
            "isUnknown": is_unknown,
        }
        if frame_snapshot:
            payload["frameThumbnail"] = frame_snapshot

        return await self._post_with_retry("/internal/recognition-event", payload)

    # ------------------------------------------------------------------ #
    # Face enrolment
    # ------------------------------------------------------------------ #

    async def save_face_profile(
        self,
        student_id: str,
        avg_embedding: list,
        samples_processed: int,
        quality_score: float,
    ) -> bool:
        """
        POST /internal/face-profile to store an average embedding on Node.js.
        """
        payload: Dict[str, Any] = {
            "studentId": student_id,
            "avgEmbedding": avg_embedding,
            "samplesProcessed": samples_processed,
            "qualityScore": round(quality_score, 4),
        }
        return await self._post_with_retry("/internal/face-profile", payload)

    # ------------------------------------------------------------------ #
    # Face DB fetch
    # ------------------------------------------------------------------ #

    async def fetch_face_db(self) -> list:
        """
        GET /api/students/embeddings from Node.js.

        Returns a list of {studentId: str, avgEmbedding: List[float]} dicts,
        or an empty list on failure.
        """
        client = _get_client()
        try:
            resp = await client.get("/api/students/embeddings")
            resp.raise_for_status()
            data = resp.json()
            embeddings: list = data if isinstance(data, list) else data.get("embeddings", [])
            logger.info("FaceDB: fetched %d embeddings from Node.js", len(embeddings))
            return embeddings
        except httpx.HTTPStatusError as exc:
            logger.error(
                "fetch_face_db HTTP error %s — %s",
                exc.response.status_code,
                exc.response.text[:200],
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("fetch_face_db error: %s", exc)
        return []

    # ------------------------------------------------------------------ #
    # Internal helper
    # ------------------------------------------------------------------ #

    async def _post_with_retry(self, path: str, payload: Dict) -> bool:
        """POST payload to path, retry once on failure."""
        client = _get_client()
        for attempt in range(2):
            try:
                resp = await client.post(path, json=payload)
                if resp.is_success:
                    logger.debug("POST %s → %s", path, resp.status_code)
                    return True
                logger.warning(
                    "POST %s attempt %d returned %s: %s",
                    path,
                    attempt + 1,
                    resp.status_code,
                    resp.text[:200],
                )
            except httpx.TimeoutException:
                logger.warning("POST %s attempt %d timed out", path, attempt + 1)
            except Exception as exc:  # noqa: BLE001
                logger.error("POST %s attempt %d error: %s", path, attempt + 1, exc)
        return False

    # ------------------------------------------------------------------ #
    # Lifecycle
    # ------------------------------------------------------------------ #

    async def close(self) -> None:
        global _client  # noqa: PLW0603
        if _client and not _client.is_closed:
            await _client.aclose()
            _client = None


# Module-level singleton
attendance_notifier = AttendanceNotifier()
