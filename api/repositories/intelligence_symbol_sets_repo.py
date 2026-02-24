"""Repository for intelligence symbol sets."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from swing_screener.utils.file_lock import locked_read_json_cli, locked_write_json_cli


class IntelligenceSymbolSetsRepository:
    def __init__(self, path: str | Path = "data/intelligence/symbol_sets.json") -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def _load_raw(self) -> list[dict[str, Any]]:
        if not self.path.exists():
            return []
        try:
            payload = locked_read_json_cli(self.path)
        except Exception:
            return []
        if isinstance(payload, dict):
            payload = payload.get("items", [])
        if not isinstance(payload, list):
            return []
        return [item for item in payload if isinstance(item, dict)]

    def _save_raw(self, items: list[dict[str, Any]]) -> None:
        locked_write_json_cli(self.path, items)

    def list_sets(self) -> list[dict[str, Any]]:
        return self._load_raw()

    def get_set(self, symbol_set_id: str) -> dict[str, Any] | None:
        for item in self._load_raw():
            if str(item.get("id", "")).strip() == symbol_set_id:
                return item
        return None

    def upsert_set(self, payload: dict[str, Any]) -> dict[str, Any]:
        items = self._load_raw()
        symbol_set_id = str(payload.get("id", "")).strip()
        replaced = False
        out: list[dict[str, Any]] = []
        for item in items:
            if str(item.get("id", "")).strip() == symbol_set_id:
                out.append(payload)
                replaced = True
            else:
                out.append(item)
        if not replaced:
            out.append(payload)
        self._save_raw(out)
        return payload

    def delete_set(self, symbol_set_id: str) -> bool:
        items = self._load_raw()
        out = [item for item in items if str(item.get("id", "")).strip() != symbol_set_id]
        if len(out) == len(items):
            return False
        self._save_raw(out)
        return True
