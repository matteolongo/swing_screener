"""Repository for dedicated intelligence configuration."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from swing_screener.utils.file_lock import locked_read_json_cli, locked_write_json_cli


class IntelligenceConfigRepository:
    def __init__(self, path: str | Path = "data/intelligence/config.json") -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def exists(self) -> bool:
        return self.path.exists()

    def load_raw(self) -> dict[str, Any] | None:
        if not self.path.exists():
            return None
        try:
            payload = locked_read_json_cli(self.path)
        except Exception:
            return None
        if not isinstance(payload, dict):
            return None
        return payload

    def save_raw(self, payload: dict[str, Any]) -> None:
        locked_write_json_cli(self.path, payload)
