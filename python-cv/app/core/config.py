"""
app/core/config.py

Pydantic-Settings based configuration.  All values can be overridden via
environment variables or a .env file in the project root.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application-wide settings loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ------------------------------------------------------------------ #
    # Service
    # ------------------------------------------------------------------ #
    port: int = 8001
    environment: str = "development"

    # ------------------------------------------------------------------ #
    # Backend integration
    # ------------------------------------------------------------------ #
    node_backend_url: str = "http://localhost:5000"
    internal_secret: str = "change_this_to_a_long_random_secret"

    # ------------------------------------------------------------------ #
    # Face recognition
    # ------------------------------------------------------------------ #
    face_recognition_backend: str = "deepface"  # insightface | deepface | face_recognition | opencv
    confidence_threshold: float = 0.6
    min_face_confirmations: int = 3

    # ------------------------------------------------------------------ #
    # Camera / stream settings
    # ------------------------------------------------------------------ #
    max_cameras: int = 10
    frame_skip: int = 2  # process 1 of every N frames

    # ------------------------------------------------------------------ #
    # Logging
    # ------------------------------------------------------------------ #
    log_level: str = "INFO"

    # ------------------------------------------------------------------ #
    # File system
    # ------------------------------------------------------------------ #
    models_dir: str = "./models"
    uploads_dir: str = "./uploads"

    # ------------------------------------------------------------------ #
    # CORS
    # ------------------------------------------------------------------ #
    cors_origins: str = "http://localhost:5000,http://localhost:3000"

    # ------------------------------------------------------------------ #
    # Computed / validated fields
    # ------------------------------------------------------------------ #
    @field_validator("confidence_threshold")
    @classmethod
    def _validate_threshold(cls, v: float) -> float:
        if not 0.0 <= v <= 1.0:
            raise ValueError("confidence_threshold must be between 0.0 and 1.0")
        return v

    @field_validator("log_level")
    @classmethod
    def _validate_log_level(cls, v: str) -> str:
        valid = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = v.upper()
        if upper not in valid:
            raise ValueError(f"log_level must be one of {valid}")
        return upper

    @field_validator("face_recognition_backend")
    @classmethod
    def _validate_backend(cls, v: str) -> str:
        valid = {"insightface", "deepface", "face_recognition", "opencv"}
        lower = v.lower()
        if lower not in valid:
            raise ValueError(f"face_recognition_backend must be one of {valid}")
        return lower

    @model_validator(mode="after")
    def _ensure_dirs(self) -> "Settings":
        """Create required directories if they don't exist."""
        for d in (self.models_dir, self.uploads_dir):
            Path(d).mkdir(parents=True, exist_ok=True)
        return self

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_development(self) -> bool:
        return self.environment.lower() == "development"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached Settings singleton."""
    return Settings()
