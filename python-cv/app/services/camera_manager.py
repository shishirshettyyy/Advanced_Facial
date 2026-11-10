"""
app/services/camera_manager.py

Manages RTSP / USB camera streams.

Each camera runs in its own background thread that reads frames and places
them in a small bounded queue.  A second function inside that thread calls
FaceEngine and AttendanceNotifier for recognition events.

Thread safety:
  - Frame queues are thread-safe (queue.Queue).
  - The cameras dict is protected by a threading.Lock.
  - FastAPI async endpoints access the manager via run_in_executor when
    they need to call blocking methods.
"""

from __future__ import annotations

import logging
import os
import queue
import threading
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

from app.core.config import get_settings
from app.services.face_engine import get_face_engine

logger = logging.getLogger(__name__)

# Tell OpenCV to use TCP for RTSP (more reliable than UDP on most networks)
os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")

_MAX_RECONNECT_ATTEMPTS = 10
_RECONNECT_DELAY_SECS   = 5


# --------------------------------------------------------------------------- #
# Centroid tracker
# --------------------------------------------------------------------------- #

@dataclass
class TrackedFace:
    """State for one tracked face region across frames."""
    track_id: int
    centroid: Tuple[float, float]
    student_id: Optional[str] = None
    confidence: float = 0.0
    consecutive_matches: int = 0
    confirmed: bool = False        # True after MIN_FACE_CONFIRMATIONS
    last_seen_frame: int = 0


class _CentroidTracker:
    """
    Minimal centroid tracker.

    Matches new detections to existing tracks by nearest-centroid distance.
    Tracks that haven't been seen for MAX_LOST frames are dropped.
    """

    _MAX_DISTANCE  = 100   # pixels
    _MAX_LOST      = 10    # frames before a track is purged

    def __init__(self) -> None:
        self._next_id: int = 0
        self._tracks: Dict[int, TrackedFace] = {}
        self._frame_count: int = 0

    def update(
        self,
        detections: List[Dict],          # {bbox, confidence, student_id?}
    ) -> List[TrackedFace]:
        """
        Update tracks with new detections.

        Returns the list of *currently active* TrackedFace objects.
        """
        self._frame_count += 1

        # Compute centroids of incoming detections
        new_centroids: List[Tuple[float, float]] = []
        for det in detections:
            x, y, w, h = det["bbox"]
            cx, cy = x + w / 2, y + h / 2
            new_centroids.append((cx, cy))

        # Match detections to existing tracks
        matched_track_ids: set = set()
        matched_det_indices: set = set()

        for tid, track in list(self._tracks.items()):
            best_dist = self._MAX_DISTANCE + 1
            best_idx  = -1
            for i, (cx, cy) in enumerate(new_centroids):
                if i in matched_det_indices:
                    continue
                dist = ((cx - track.centroid[0]) ** 2 + (cy - track.centroid[1]) ** 2) ** 0.5
                if dist < best_dist:
                    best_dist = dist
                    best_idx  = i
            if best_idx >= 0 and best_dist <= self._MAX_DISTANCE:
                # Update the matched track
                det = detections[best_idx]
                track.centroid = new_centroids[best_idx]
                track.last_seen_frame = self._frame_count

                new_sid   = det.get("student_id")
                new_conf  = det.get("confidence", 0.0)

                if new_sid and new_sid == track.student_id:
                    track.consecutive_matches += 1
                    track.confidence = new_conf
                elif new_sid:
                    track.student_id          = new_sid
                    track.confidence          = new_conf
                    track.consecutive_matches = 1
                    track.confirmed           = False  # reset if person changed
                else:
                    track.consecutive_matches = 0

                matched_track_ids.add(tid)
                matched_det_indices.add(best_idx)

        # Create new tracks for unmatched detections
        for i, det in enumerate(detections):
            if i in matched_det_indices:
                continue
            sid  = det.get("student_id")
            conf = det.get("confidence", 0.0)
            self._tracks[self._next_id] = TrackedFace(
                track_id            = self._next_id,
                centroid            = new_centroids[i],
                student_id          = sid,
                confidence          = conf,
                consecutive_matches = 1 if sid else 0,
                last_seen_frame     = self._frame_count,
            )
            self._next_id += 1

        # Remove stale tracks
        stale = [
            tid for tid, t in self._tracks.items()
            if self._frame_count - t.last_seen_frame > self._MAX_LOST
        ]
        for tid in stale:
            del self._tracks[tid]

        return list(self._tracks.values())

    def reset(self) -> None:
        self._tracks.clear()
        self._frame_count = 0


# --------------------------------------------------------------------------- #
# Camera state
# --------------------------------------------------------------------------- #

@dataclass
class CameraState:
    camera_id: str
    rtsp_url: str
    session_id: str
    node_callback_url: str = ""
    thread: Optional[threading.Thread] = None
    frame_queue: queue.Queue = field(default_factory=lambda: queue.Queue(maxsize=5))
    is_running: bool = False
    status: str = "idle"            # idle | connecting | active | error | stopped
    reconnect_count: int = 0
    frames_processed: int = 0
    tracker: _CentroidTracker = field(default_factory=_CentroidTracker)
    # In-memory face database for this session
    face_db: List[Dict] = field(default_factory=list)


# --------------------------------------------------------------------------- #
# CameraManager
# --------------------------------------------------------------------------- #

class CameraManager:
    """
    Manages multiple RTSP/USB camera streams.

    Usage:
        manager = CameraManager()
        manager.add_camera("cam1", "rtsp://...", "session_xyz")
        manager.remove_camera("cam1")
        manager.stop_all()
    """

    def __init__(self) -> None:
        self._lock    = threading.Lock()
        self._cameras: Dict[str, CameraState] = {}

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def add_camera(
        self,
        camera_id: str,
        rtsp_url: str,
        session_id: str,
        node_callback_url: str = "",
        face_db: Optional[List[Dict]] = None,
    ) -> None:
        """Register and start a camera stream."""
        with self._lock:
            if camera_id in self._cameras:
                logger.warning("Camera '%s' already registered; ignoring add.", camera_id)
                return
            settings = get_settings()
            if len(self._cameras) >= settings.max_cameras:
                raise RuntimeError(
                    f"Maximum camera limit ({settings.max_cameras}) reached."
                )
            state = CameraState(
                camera_id         = camera_id,
                rtsp_url          = rtsp_url,
                session_id        = session_id,
                node_callback_url = node_callback_url,
                face_db           = face_db or [],
            )
            self._cameras[camera_id] = state

        self._start_stream_thread(camera_id)

    def remove_camera(self, camera_id: str) -> None:
        """Stop and unregister a camera."""
        self.stop_camera(camera_id)
        with self._lock:
            self._cameras.pop(camera_id, None)

    def stop_camera(self, camera_id: str) -> None:
        """Signal the stream thread to stop and wait for it."""
        with self._lock:
            state = self._cameras.get(camera_id)
        if state is None:
            return
        state.is_running = False
        if state.thread and state.thread.is_alive():
            state.thread.join(timeout=10)
        with self._lock:
            if camera_id in self._cameras:
                self._cameras[camera_id].status = "stopped"

    def stop_all(self) -> None:
        """Stop all running cameras (called on shutdown)."""
        with self._lock:
            ids = list(self._cameras.keys())
        for cid in ids:
            self.stop_camera(cid)

    def get_status(self, camera_id: str) -> Optional[Dict]:
        with self._lock:
            state = self._cameras.get(camera_id)
        if state is None:
            return None
        return self._state_to_dict(state)

    def get_all_statuses(self) -> Dict[str, Dict]:
        with self._lock:
            snapshot = dict(self._cameras)
        return {cid: self._state_to_dict(s) for cid, s in snapshot.items()}

    def refresh_face_db(self, camera_id: str, face_db: List[Dict]) -> bool:
        """Replace the in-memory face DB for a running camera session."""
        with self._lock:
            state = self._cameras.get(camera_id)
        if state is None:
            return False
        state.face_db = face_db
        logger.info(
            "FaceDB refreshed for camera '%s': %d embeddings.", camera_id, len(face_db)
        )
        return True

    # ------------------------------------------------------------------ #
    # Stream thread
    # ------------------------------------------------------------------ #

    def _start_stream_thread(self, camera_id: str) -> None:
        with self._lock:
            state = self._cameras.get(camera_id)
        if state is None:
            return
        state.is_running = True
        state.status     = "connecting"
        t = threading.Thread(
            target=self._stream_reader_thread,
            args=(camera_id,),
            daemon=True,
            name=f"cam-{camera_id}",
        )
        state.thread = t
        t.start()

    def _stream_reader_thread(self, camera_id: str) -> None:
        """Main camera reading loop — runs in a daemon thread."""
        with self._lock:
            state = self._cameras.get(camera_id)
        if state is None:
            return

        settings    = get_settings()
        frame_skip  = settings.frame_skip
        frame_count = 0

        logger.info("Camera '%s': starting stream from %s", camera_id, state.rtsp_url)

        while state.is_running and state.reconnect_count <= _MAX_RECONNECT_ATTEMPTS:
            # ----- open capture ----- #
            rtsp_url = state.rtsp_url
            # Support integer USB camera index
            cap_arg: int | str = rtsp_url
            if rtsp_url.isdigit():
                cap_arg = int(rtsp_url)

            cap = cv2.VideoCapture(cap_arg)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            if not cap.isOpened():
                state.status        = "error"
                state.reconnect_count += 1
                logger.warning(
                    "Camera '%s': could not open stream (attempt %d/%d). Retrying in %ds…",
                    camera_id,
                    state.reconnect_count,
                    _MAX_RECONNECT_ATTEMPTS,
                    _RECONNECT_DELAY_SECS,
                )
                cap.release()
                time.sleep(_RECONNECT_DELAY_SECS)
                continue

            state.status          = "active"
            state.reconnect_count = 0
            logger.info("Camera '%s': stream opened successfully.", camera_id)

            # ----- read loop ----- #
            while state.is_running:
                ret, frame = cap.read()
                if not ret:
                    logger.warning("Camera '%s': frame read failed — reconnecting…", camera_id)
                    break

                frame_count += 1
                if frame_count % (frame_skip + 1) != 0:
                    continue

                # Enqueue frame (drop oldest if full)
                try:
                    state.frame_queue.put_nowait(frame)
                except queue.Full:
                    try:
                        state.frame_queue.get_nowait()
                    except queue.Empty:
                        pass
                    state.frame_queue.put_nowait(frame)

                # Process the frame synchronously in this thread.
                # Heavy work (DNN inference) is acceptable here since this
                # thread is decoupled from FastAPI's async event loop.
                self._process_frame(camera_id, frame, state)
                state.frames_processed += 1

            cap.release()

            if state.is_running:
                # Unexpected disconnect — schedule reconnect
                state.status        = "error"
                state.reconnect_count += 1
                logger.warning(
                    "Camera '%s': disconnected (attempt %d/%d). Retrying in %ds…",
                    camera_id,
                    state.reconnect_count,
                    _MAX_RECONNECT_ATTEMPTS,
                    _RECONNECT_DELAY_SECS,
                )
                time.sleep(_RECONNECT_DELAY_SECS)

        if state.reconnect_count > _MAX_RECONNECT_ATTEMPTS:
            logger.error(
                "Camera '%s': exceeded max reconnect attempts — giving up.", camera_id
            )
            state.status = "failed"
        else:
            state.status = "stopped"

        logger.info("Camera '%s': stream thread exiting.", camera_id)

    # ------------------------------------------------------------------ #
    # Frame processing
    # ------------------------------------------------------------------ #

    def _process_frame(
        self,
        camera_id: str,
        frame: np.ndarray,
        state: CameraState,
    ) -> None:
        """
        Run face detection + recognition on one frame.

        Sends a recognition event to Node.js when a face accumulates
        MIN_FACE_CONFIRMATIONS consecutive confirmed matches.
        """
        try:
            engine   = get_face_engine()
            settings = get_settings()

            raw_detections = engine.detect_faces(frame)
            if not raw_detections:
                state.tracker.update([])
                return

            enriched_detections = []
            for det in raw_detections:
                bbox = det["bbox"]
                aligned = engine.align_face(frame, bbox)
                if aligned is None:
                    enriched_detections.append({**det, "student_id": None})
                    continue

                emb = engine.extract_embedding(aligned)
                if emb is None:
                    enriched_detections.append({**det, "student_id": None})
                    continue

                match = engine.match_embedding(emb, state.face_db)
                enriched_detections.append({
                    **det,
                    "student_id": match.get("studentId") if match["matched"] else None,
                    "match_confidence": match.get("similarity", 0.0),
                    "embedding": emb,
                })

            tracks = state.tracker.update(enriched_detections)

            # Check whether any track has just reached MIN_FACE_CONFIRMATIONS
            for track in tracks:
                if (
                    track.student_id is not None
                    and track.consecutive_matches == settings.min_face_confirmations
                    and not track.confirmed
                ):
                    track.confirmed = True
                    self._emit_recognition_event(
                        camera_id  = camera_id,
                        session_id = state.session_id,
                        student_id = track.student_id,
                        confidence = track.confidence,
                        centroid   = track.centroid,
                        frame      = frame,
                        # Find the original bbox from enriched detections
                        bbox       = self._centroid_to_bbox(track.centroid, enriched_detections),
                    )

        except Exception as exc:  # noqa: BLE001
            logger.error("Camera '%s' process_frame error: %s", camera_id, exc)

    def _centroid_to_bbox(
        self,
        centroid: Tuple[float, float],
        detections: List[Dict],
    ) -> Dict[str, int]:
        """Return the bbox closest to centroid as an {x,y,w,h} dict."""
        best_bbox = [0, 0, 0, 0]
        best_dist = float("inf")
        for det in detections:
            x, y, w, h = det["bbox"]
            cx, cy = x + w / 2, y + h / 2
            dist = ((cx - centroid[0]) ** 2 + (cy - centroid[1]) ** 2) ** 0.5
            if dist < best_dist:
                best_dist = dist
                best_bbox = det["bbox"]
        return {"x": best_bbox[0], "y": best_bbox[1], "w": best_bbox[2], "h": best_bbox[3]}

    def _emit_recognition_event(
        self,
        camera_id: str,
        session_id: str,
        student_id: str,
        confidence: float,
        centroid: Tuple[float, float],
        frame: np.ndarray,
        bbox: Dict[str, int],
    ) -> None:
        """
        Fire-and-forget POST to Node.js.

        Because this runs in a camera thread (not the asyncio event loop),
        we use httpx in synchronous mode to avoid cross-loop issues.
        """
        from app.services.face_engine import FaceEngine  # noqa: PLC0415

        snapshot = FaceEngine.frame_to_thumbnail(
            frame,
            [bbox["x"], bbox["y"], bbox["w"], bbox["h"]],
        )

        import httpx  # noqa: PLC0415
        settings = get_settings()
        try:
            with httpx.Client(timeout=5.0) as client:
                client.post(
                    f"{settings.node_backend_url}/internal/recognition-event",
                    json={
                        "cameraId":       camera_id,
                        "sessionId":      session_id,
                        "studentId":      student_id,
                        "confidence":     round(confidence, 4),
                        "bbox":           bbox,
                        "isUnknown":      False,
                        "frameThumbnail": snapshot,
                    },
                    headers={"X-Internal-Secret": settings.internal_secret},
                )
            logger.info(
                "Recognition event sent — camera=%s student=%s conf=%.2f",
                camera_id,
                student_id,
                confidence,
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to emit recognition event: %s", exc)

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _state_to_dict(state: CameraState) -> Dict:
        return {
            "cameraId":        state.camera_id,
            "rtspUrl":         state.rtsp_url,
            "sessionId":       state.session_id,
            "status":          state.status,
            "reconnectCount":  state.reconnect_count,
            "framesProcessed": state.frames_processed,
            "faceDbSize":      len(state.face_db),
        }


# Module-level singleton
camera_manager = CameraManager()
