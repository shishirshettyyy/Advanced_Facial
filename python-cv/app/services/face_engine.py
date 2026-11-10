"""
app/services/face_engine.py

FaceEngine — pluggable face detection + recognition backend.

Backend priority:
  1. InsightFace  (ArcFace, 512-d) — best accuracy; may fail on Python 3.14
  2. DeepFace     (ArcFace/Facenet512) — good accuracy; needs TensorFlow
  3. face_recognition (dlib, 128-d) — moderate; needs CMake build
  4. OpenCV cascade + ORB (fallback) — very low accuracy, logs WARNING

The backend is selected by the FACE_RECOGNITION_BACKEND env var but will
automatically fall back to the next available option if the requested one
cannot be imported.
"""

from __future__ import annotations

import base64
import logging
from typing import Any, Dict, List, Optional

import cv2
import numpy as np

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# Backend sentinel values
# --------------------------------------------------------------------------- #
_BACKEND_INSIGHTFACE    = "insightface"
_BACKEND_DEEPFACE       = "deepface"
_BACKEND_FACE_RECOG     = "face_recognition"
_BACKEND_OPENCV         = "opencv"

_PRIORITY = [
    _BACKEND_INSIGHTFACE,
    _BACKEND_DEEPFACE,
    _BACKEND_FACE_RECOG,
    _BACKEND_OPENCV,
]


# --------------------------------------------------------------------------- #
# FaceEngine
# --------------------------------------------------------------------------- #

class FaceEngine:
    """
    Unified face detection + recognition engine with graceful backend fallback.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._confidence_threshold: float = settings.confidence_threshold
        self._backend_name: str = _BACKEND_OPENCV  # will be updated below

        # -- backend objects (typed loosely to avoid hard imports) --
        self._insight_app: Any = None          # insightface.app.FaceAnalysis
        self._df_model_name: str = "ArcFace"   # deepface model
        self._fr_available: bool = False        # face_recognition flag
        self._haar_cascade: Any = None          # cv2.CascadeClassifier

        # OpenCV DNN detector (SSD / Caffe model)
        self._dnn_net: Any = None

        self._initialize(settings.face_recognition_backend)

    # ------------------------------------------------------------------ #
    # Initialisation helpers
    # ------------------------------------------------------------------ #

    def _initialize(self, requested: str) -> None:
        """
        Try to load the requested backend, then fall back through _PRIORITY.
        """
        # Build the ordered list starting from the requested backend
        start = _PRIORITY.index(requested) if requested in _PRIORITY else 0
        ordered = _PRIORITY[start:] + _PRIORITY[:start]

        for backend in ordered:
            try:
                init_fn = getattr(self, f"_init_{backend.replace('-', '_')}")
                init_fn()
                self._backend_name = backend
                logger.info("FaceEngine: using backend '%s'", backend)
                return
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "FaceEngine: backend '%s' unavailable — %s. Trying next…",
                    backend,
                    exc,
                )

        # This should never happen because _opencv always succeeds.
        raise RuntimeError("FaceEngine: ALL backends failed — cannot start.")

    def _init_insightface(self) -> None:
        import insightface  # noqa: PLC0415
        from insightface.app import FaceAnalysis  # noqa: PLC0415

        settings = get_settings()
        app = FaceAnalysis(
            name="buffalo_l",
            root=settings.models_dir,
            providers=["CPUExecutionProvider"],
        )
        app.prepare(ctx_id=0, det_size=(640, 640))
        self._insight_app = app

    def _init_deepface(self) -> None:
        # Probe import — will raise if TF/deepface not available
        import deepface  # noqa: PLC0415,F401

        # Warm up the model so the first real call is fast.
        # We use a tiny dummy image; ignore any error from it.
        try:
            from deepface import DeepFace  # noqa: PLC0415

            dummy = np.zeros((160, 160, 3), dtype=np.uint8)
            DeepFace.represent(
                dummy,
                model_name=self._df_model_name,
                enforce_detection=False,
            )
        except Exception:  # noqa: BLE001
            pass  # warm-up failure is not fatal

        # Also set up Haar cascade for detection (DeepFace detection can be
        # slow; we use OpenCV for a first-pass bounding box)
        self._load_haar()

    def _init_face_recognition(self) -> None:
        import face_recognition  # noqa: PLC0415,F401

        self._fr_available = True
        self._load_haar()

    def _init_opencv(self) -> None:
        """Pure OpenCV fallback — always succeeds."""
        logger.warning(
            "FaceEngine: using OpenCV (Haar + ORB) fallback. "
            "Face recognition accuracy will be VERY LOW. "
            "Install deepface or insightface for production use."
        )
        self._load_haar()

    def _load_haar(self) -> None:
        """Load OpenCV Haar cascade for frontal face detection."""
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        self._haar_cascade = cv2.CascadeClassifier(cascade_path)
        if self._haar_cascade.empty():
            raise RuntimeError(f"Could not load Haar cascade from {cascade_path}")

    # ------------------------------------------------------------------ #
    # Public interface
    # ------------------------------------------------------------------ #

    @property
    def backend_name(self) -> str:
        return self._backend_name

    # ------------------------------------------------------------------ #
    # detect_faces
    # ------------------------------------------------------------------ #

    def detect_faces(self, frame: np.ndarray) -> List[Dict]:
        """
        Detect faces in a BGR OpenCV frame.

        Returns:
            List of dicts: {bbox: [x, y, w, h], confidence: float}
        """
        try:
            if self._backend_name == _BACKEND_INSIGHTFACE:
                return self._detect_insightface(frame)
            if self._backend_name == _BACKEND_DEEPFACE:
                return self._detect_haar(frame)
            if self._backend_name == _BACKEND_FACE_RECOG:
                return self._detect_face_recognition(frame)
            return self._detect_haar(frame)
        except Exception as exc:  # noqa: BLE001
            logger.error("detect_faces error: %s", exc)
            return []

    def _detect_insightface(self, frame: np.ndarray) -> List[Dict]:
        faces = self._insight_app.get(frame)
        results = []
        for face in faces:
            conf = float(face.det_score)
            if conf < 0.5:
                continue
            x1, y1, x2, y2 = face.bbox.astype(int)
            results.append({"bbox": [x1, y1, x2 - x1, y2 - y1], "confidence": conf})
        return results

    def _detect_haar(self, frame: np.ndarray) -> List[Dict]:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        faces = self._haar_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30),
            flags=cv2.CASCADE_SCALE_IMAGE,
        )
        if len(faces) == 0:
            return []
        results = []
        for (x, y, w, h) in faces:
            # Haar cascade has no confidence; we approximate 0.75 as a neutral value
            results.append({"bbox": [int(x), int(y), int(w), int(h)], "confidence": 0.75})
        return results

    def _detect_face_recognition(self, frame: np.ndarray) -> List[Dict]:
        import face_recognition  # noqa: PLC0415

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        locations = face_recognition.face_locations(rgb, model="hog")
        results = []
        for (top, right, bottom, left) in locations:
            w, h = right - left, bottom - top
            results.append({"bbox": [left, top, w, h], "confidence": 0.80})
        return results

    # ------------------------------------------------------------------ #
    # align_face
    # ------------------------------------------------------------------ #

    def align_face(self, frame: np.ndarray, bbox: List[int]) -> Optional[np.ndarray]:
        """
        Crop and resize the face region.

        Args:
            frame: BGR OpenCV frame.
            bbox:  [x, y, w, h]

        Returns:
            Resized face image (112×112 for InsightFace, 160×160 otherwise).
        """
        try:
            x, y, w, h = bbox
            # Add 20 % padding to capture a bit more context
            pad_x = int(w * 0.1)
            pad_y = int(h * 0.1)
            x1 = max(0, x - pad_x)
            y1 = max(0, y - pad_y)
            x2 = min(frame.shape[1], x + w + pad_x)
            y2 = min(frame.shape[0], y + h + pad_y)
            if x2 <= x1 or y2 <= y1:
                return None
            crop = frame[y1:y2, x1:x2]
            if crop.size == 0:
                return None
            target = (112, 112) if self._backend_name == _BACKEND_INSIGHTFACE else (160, 160)
            return cv2.resize(crop, target, interpolation=cv2.INTER_LINEAR)
        except Exception as exc:  # noqa: BLE001
            logger.debug("align_face error: %s", exc)
            return None

    # ------------------------------------------------------------------ #
    # extract_embedding
    # ------------------------------------------------------------------ #

    def extract_embedding(self, face_image: np.ndarray) -> Optional[np.ndarray]:
        """
        Extract a normalised embedding vector from an aligned face crop.

        Returns:
            np.ndarray of shape (D,) normalised to unit length, or None.
        """
        try:
            if self._backend_name == _BACKEND_INSIGHTFACE:
                return self._embed_insightface(face_image)
            if self._backend_name == _BACKEND_DEEPFACE:
                return self._embed_deepface(face_image)
            if self._backend_name == _BACKEND_FACE_RECOG:
                return self._embed_face_recognition(face_image)
            return self._embed_orb(face_image)
        except Exception as exc:  # noqa: BLE001
            logger.error("extract_embedding error: %s", exc)
            return None

    def _embed_insightface(self, face_image: np.ndarray) -> Optional[np.ndarray]:
        faces = self._insight_app.get(face_image)
        if not faces:
            return None
        emb = faces[0].normed_embedding
        return emb.astype(np.float32)

    def _embed_deepface(self, face_image: np.ndarray) -> Optional[np.ndarray]:
        from deepface import DeepFace  # noqa: PLC0415

        result = DeepFace.represent(
            face_image,
            model_name=self._df_model_name,
            enforce_detection=False,
            detector_backend="skip",  # face already cropped
        )
        if not result:
            return None
        emb = np.array(result[0]["embedding"], dtype=np.float32)
        return self._normalize(emb)

    def _embed_face_recognition(self, face_image: np.ndarray) -> Optional[np.ndarray]:
        import face_recognition  # noqa: PLC0415

        rgb = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
        encodings = face_recognition.face_encodings(rgb)
        if not encodings:
            return None
        return self._normalize(np.array(encodings[0], dtype=np.float32))

    def _embed_orb(self, face_image: np.ndarray) -> Optional[np.ndarray]:
        """
        ORB-based placeholder embedding — accuracy is VERY LOW.
        Returns a fixed-size 128-d descriptor for interface compatibility.
        """
        orb = cv2.ORB_create(nfeatures=128)
        gray = cv2.cvtColor(face_image, cv2.COLOR_BGR2GRAY)
        kps, descs = orb.detectAndCompute(gray, None)
        if descs is None or len(descs) == 0:
            # Return a zero vector rather than None so the pipeline keeps running
            return np.zeros(128, dtype=np.float32)
        # Flatten and pad/trim to 128 floats
        flat = descs.flatten().astype(np.float32)
        if len(flat) >= 128:
            flat = flat[:128]
        else:
            flat = np.pad(flat, (0, 128 - len(flat)))
        return self._normalize(flat)

    # ------------------------------------------------------------------ #
    # Similarity + matching
    # ------------------------------------------------------------------ #

    @staticmethod
    def _normalize(v: np.ndarray) -> np.ndarray:
        norm = np.linalg.norm(v)
        if norm < 1e-10:
            return v
        return v / norm

    def compute_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """
        Cosine similarity ∈ [0, 1] where 1 = identical.
        Both embeddings are assumed to be normalised.
        """
        sim = float(np.dot(emb1, emb2))
        # Clamp to [0, 1] — raw dot product can exceed 1 due to fp rounding
        return max(0.0, min(1.0, (sim + 1.0) / 2.0))

    def compute_raw_cosine(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Raw cosine similarity ∈ [-1, 1]."""
        return float(np.dot(emb1, emb2))

    def match_embedding(
        self,
        embedding: np.ndarray,
        face_db: List[Dict],
    ) -> Dict:
        """
        Match an embedding against a face database.

        Args:
            embedding: normalised embedding vector
            face_db:   list of {studentId: str, avgEmbedding: List[float]}

        Returns:
            {studentId, similarity, matched: True}  — or  {matched: False}
        """
        if not face_db:
            return {"matched": False}

        best_id: Optional[str] = None
        best_sim: float = -1.0

        for entry in face_db:
            try:
                db_emb = np.array(entry["avgEmbedding"], dtype=np.float32)
                db_emb = self._normalize(db_emb)
                sim = self.compute_raw_cosine(embedding, db_emb)
                if sim > best_sim:
                    best_sim = sim
                    best_id = entry["studentId"]
            except (KeyError, TypeError, ValueError) as exc:
                logger.debug("Skipping malformed face_db entry: %s", exc)
                continue

        # Map raw cosine [-1, 1] to [0, 1] for readability
        similarity_01 = max(0.0, min(1.0, (best_sim + 1.0) / 2.0))

        if similarity_01 >= self._confidence_threshold and best_id is not None:
            return {
                "studentId": best_id,
                "similarity": round(similarity_01, 4),
                "matched": True,
            }

        return {"matched": False}

    # ------------------------------------------------------------------ #
    # Thumbnail helper (used by camera_manager)
    # ------------------------------------------------------------------ #

    @staticmethod
    def frame_to_thumbnail(frame: np.ndarray, bbox: List[int], size: int = 80) -> str:
        """
        Crop, resize, and encode a face region as a base64 JPEG thumbnail.
        Returns an empty string on failure.
        """
        try:
            x, y, w, h = bbox
            x1 = max(0, x)
            y1 = max(0, y)
            x2 = min(frame.shape[1], x + w)
            y2 = min(frame.shape[0], y + h)
            crop = frame[y1:y2, x1:x2]
            if crop.size == 0:
                return ""
            thumb = cv2.resize(crop, (size, size), interpolation=cv2.INTER_AREA)
            ok, buf = cv2.imencode(".jpg", thumb, [cv2.IMWRITE_JPEG_QUALITY, 60])
            if not ok:
                return ""
            return base64.b64encode(buf.tobytes()).decode("ascii")
        except Exception:  # noqa: BLE001
            return ""


# --------------------------------------------------------------------------- #
# Singleton
# --------------------------------------------------------------------------- #

_face_engine_instance: Optional[FaceEngine] = None


def get_face_engine() -> FaceEngine:
    """Return (or lazily create) the global FaceEngine singleton."""
    global _face_engine_instance  # noqa: PLW0603
    if _face_engine_instance is None:
        logger.info("Initialising FaceEngine…")
        _face_engine_instance = FaceEngine()
    return _face_engine_instance
