"""Repository for dedicated intelligence configuration."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from swing_screener.settings import intelligence_yaml_path
from swing_screener.settings.io import dump_yaml_file, load_yaml_file


class IntelligenceConfigRepository:
    def __init__(self, path: str | Path | None = None) -> None:
        self.path = Path(path) if path is not None else intelligence_yaml_path()
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def exists(self) -> bool:
        return self.path.exists()

    def load_raw(self) -> dict[str, Any] | None:
        if not self.path.exists():
            return None
        try:
            payload = load_yaml_file(self.path)
        except Exception:
            return None
        if not isinstance(payload, dict):
            return None
        return payload

    def save_raw(self, payload: dict[str, Any]) -> None:
        dump_yaml_file(self.path, payload)
