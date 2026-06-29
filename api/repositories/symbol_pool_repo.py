"""Symbol pool JSON repository."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from api.utils.file_lock import (
    locked_read_json,
    locked_read_modify_write,
    locked_write_json,
)


@dataclass
class SymbolPoolRepository:
    path: Path

    def read(self) -> dict:
        return locked_read_json(self.path)

    def write(self, data: dict) -> None:
        locked_write_json(self.path, data)

    def list_symbols(self) -> list[dict]:
        return self.read().get("symbols", [])

    def apply_fetch_results(
        self, ok: list[str], failed: list[str], asof: str, threshold: int
    ) -> list[dict]:
        """Reset/increment per-symbol fetch counters; return symbols that crossed threshold."""
        ok_set = {s.upper() for s in ok}
        failed_set = {s.upper() for s in failed}
        crossed: list[dict] = []

        def _modify(data: dict) -> dict:
            crossed.clear()
            for sym in data.get("symbols", []):
                name = str(sym.get("symbol", "")).upper()
                if name in ok_set:
                    sym["fetch_failure_count"] = 0
                    sym["last_fetch_ok_at"] = asof
                elif name in failed_set:
                    prev = int(sym.get("fetch_failure_count") or 0)
                    sym["fetch_failure_count"] = prev + 1
                    if prev < threshold <= sym["fetch_failure_count"]:
                        crossed.append(dict(sym))
            return data

        locked_read_modify_write(self.path, _modify)
        return crossed
