"""Review queue JSON repository."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from api.utils.file_lock import (
    locked_read_json,
    locked_read_modify_write,
    locked_write_json,
)


@dataclass
class ReviewQueueRepository:
    path: Path

    def read(self) -> dict:
        if not self.path.exists():
            return {"entries": []}
        return locked_read_json(self.path)

    def write(self, data: dict) -> None:
        locked_write_json(self.path, data)

    def list_entries(self) -> list[dict]:
        return self.read().get("entries", [])

    def upsert(self, entries: list[dict]) -> None:
        incoming = {str(e["symbol"]).upper(): e for e in entries}

        def _modify(data: dict) -> dict:
            data.setdefault("entries", [])
            by_symbol = {str(e["symbol"]).upper(): e for e in data["entries"]}
            by_symbol.update(incoming)
            data["entries"] = list(by_symbol.values())
            return data

        self._ensure_file()
        locked_read_modify_write(self.path, _modify)

    def remove(self, symbol: str) -> bool:
        target = symbol.upper()
        removed = {"flag": False}

        def _modify(data: dict) -> dict:
            entries = data.get("entries", [])
            kept = [e for e in entries if str(e["symbol"]).upper() != target]
            removed["flag"] = len(kept) != len(entries)
            data["entries"] = kept
            return data

        self._ensure_file()
        locked_read_modify_write(self.path, _modify)
        return removed["flag"]

    def restore(self, symbol: str) -> dict | None:
        target = symbol.upper()
        popped: dict = {}

        def _modify(data: dict) -> dict:
            entries = data.get("entries", [])
            kept = []
            for e in entries:
                if str(e["symbol"]).upper() == target and not popped:
                    popped.update(e)
                else:
                    kept.append(e)
            data["entries"] = kept
            return data

        self._ensure_file()
        locked_read_modify_write(self.path, _modify)
        return popped or None

    def _ensure_file(self) -> None:
        if not self.path.exists():
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.write({"entries": []})
