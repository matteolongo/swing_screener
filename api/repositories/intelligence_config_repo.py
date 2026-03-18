"""Repository for dedicated intelligence configuration."""
from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any

import portalocker

from swing_screener.settings import intelligence_yaml_path
from swing_screener.settings.io import dump_yaml_file, load_yaml_file

_LOCK_TIMEOUT = 5.0  # seconds
logger = logging.getLogger(__name__)


class IntelligenceConfigRepository:
    def __init__(self, path: str | Path | None = None) -> None:
        self.path = Path(path) if path is not None else intelligence_yaml_path()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._thread_lock = threading.Lock()
        self._lock_path = self.path.with_suffix(".lock")

    def exists(self) -> bool:
        return self.path.exists()

    def load_raw(self) -> dict[str, Any] | None:
        if not self.path.exists():
            return None
        try:
            with self._thread_lock:
                with portalocker.Lock(self._lock_path, mode="a", timeout=_LOCK_TIMEOUT):
                    payload = load_yaml_file(self.path)
        except portalocker.exceptions.LockException:
            logger.warning("Timed out acquiring lock for %s after %.1fs", self._lock_path, _LOCK_TIMEOUT)
            return None
        except Exception:
            return None
        if not isinstance(payload, dict):
            return None
        return payload

    def save_raw(self, payload: dict[str, Any]) -> None:
        with self._thread_lock:
            with portalocker.Lock(self._lock_path, mode="a", timeout=_LOCK_TIMEOUT):
                dump_yaml_file(self.path, payload)
