"""
app/core/logging.py

Configures structured logging:
  - JSON format in production  (parseable by log aggregators)
  - Colored, human-readable format in development
"""

from __future__ import annotations

import logging
import sys
from typing import Any, Dict

# Optional colorama for Windows ANSI support
try:
    from colorama import Fore, Style, init as colorama_init
    colorama_init(autoreset=True)
    _HAS_COLORAMA = True
except ImportError:
    _HAS_COLORAMA = False


# --------------------------------------------------------------------------- #
# Formatters
# --------------------------------------------------------------------------- #

class _ColoredFormatter(logging.Formatter):
    """Human-readable, color-coded formatter for development."""

    _LEVEL_COLORS: Dict[int, str] = {}

    def __init__(self) -> None:
        super().__init__()
        if _HAS_COLORAMA:
            self._LEVEL_COLORS = {
                logging.DEBUG:    Fore.CYAN,
                logging.INFO:     Fore.GREEN,
                logging.WARNING:  Fore.YELLOW,
                logging.ERROR:    Fore.RED,
                logging.CRITICAL: Fore.MAGENTA,
            }

    def format(self, record: logging.LogRecord) -> str:
        color = self._LEVEL_COLORS.get(record.levelno, "")
        reset = Style.RESET_ALL if _HAS_COLORAMA else ""
        ts = self.formatTime(record, "%Y-%m-%d %H:%M:%S")
        return (
            f"{color}[{ts}] {record.levelname:<8}{reset} "
            f"{record.name}: {record.getMessage()}"
        )


class _JsonFormatter(logging.Formatter):
    """JSON-line formatter for production."""

    def format(self, record: logging.LogRecord) -> str:
        import json
        import traceback

        payload: Dict[str, Any] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = traceback.format_exception(*record.exc_info)
        return json.dumps(payload)


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #

def setup_logging(level: str = "INFO", environment: str = "development") -> None:
    """
    Configure root logger.  Call once at application startup.

    Args:
        level:       Log level string (DEBUG / INFO / WARNING / ERROR).
        environment: 'development' → colored console; anything else → JSON.
    """
    numeric_level = getattr(logging, level.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(numeric_level)

    if environment.lower() == "development":
        handler.setFormatter(_ColoredFormatter())
    else:
        handler.setFormatter(_JsonFormatter())

    root = logging.getLogger()
    root.setLevel(numeric_level)

    # Remove any handlers added by third-party libraries before ours.
    root.handlers.clear()
    root.addHandler(handler)

    # Silence overly chatty third-party loggers.
    for noisy in ("urllib3", "httpx", "httpcore", "PIL", "h11"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    logging.getLogger(__name__).info(
        "Logging initialised — level=%s, format=%s",
        level,
        "colored" if environment.lower() == "development" else "json",
    )
