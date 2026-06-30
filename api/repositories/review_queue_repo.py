"""Review queue / fetch-health JSON repository.

This is the single runtime store for per-symbol OHLCV fetch health. The
committed ``symbol_pool.json`` is immutable; all mutable counters live here so
the pool file never drifts from its built state. Symbols whose consecutive
failure count reaches the threshold are the "review queue" shown in the UI.
"""

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
            return {"symbols": {}}
        data = locked_read_json(self.path)
        data.setdefault("symbols", {})
        return data

    def write(self, data: dict) -> None:
        locked_write_json(self.path, data)

    def apply_fetch_results(
        self,
        ok: list[str],
        failed: list[str],
        asof: str,
        threshold: int,
        meta: dict | None = None,
    ) -> None:
        """Reset counters for fetched symbols; increment for failed ones.

        ``meta`` optionally carries per-symbol pool metadata (exchange_mic,
        sector, cap_tier, provider) stamped onto entries so the review-queue UI
        can show them. Skips the write lock entirely when nothing changes (the
        common steady state: no failures and no tracked ok symbols).
        """
        ok_set = {s.upper() for s in ok}
        failed_set = {s.upper() for s in failed}
        meta = meta or {}

        # Fast path: when there were no failures, the only work is resetting
        # counters for ok symbols. If none of them is currently tracked, there
        # is nothing to write — avoid taking the exclusive lock.
        if not failed_set:
            current = self.read().get("symbols", {})
            if not any(name in current for name in ok_set):
                return

        def _modify(data: dict) -> dict:
            symbols = data.setdefault("symbols", {})
            for name in ok_set:
                entry = symbols.get(name)
                if entry is not None:
                    entry["fetch_failure_count"] = 0
                    entry["last_fetch_ok_at"] = asof
            for name in failed_set:
                entry = symbols.get(name)
                if entry is None:
                    entry = {
                        "symbol": name,
                        "fetch_failure_count": 0,
                        "first_failed_at": asof,
                        "last_fetch_ok_at": None,
                    }
                    symbols[name] = entry
                entry["fetch_failure_count"] = (
                    int(entry.get("fetch_failure_count") or 0) + 1
                )
                entry.setdefault("first_failed_at", asof)
                entry["last_failed_at"] = asof
                entry["reason"] = "OHLCV fetch returned no data"
                m = meta.get(name)
                if m:
                    for key in ("exchange_mic", "sector", "cap_tier", "provider"):
                        if m.get(key) is not None:
                            entry[key] = m[key]
            return data

        self._ensure_file()
        locked_read_modify_write(self.path, _modify)

    def queued_symbols(self, threshold: int) -> set[str]:
        return {
            name
            for name, e in self.read().get("symbols", {}).items()
            if int(e.get("fetch_failure_count") or 0) >= threshold
        }

    def list_entries(self, threshold: int) -> list[dict]:
        """Threshold-crossed entries shown in the review queue UI."""
        return [
            e
            for e in self.read().get("symbols", {}).values()
            if int(e.get("fetch_failure_count") or 0) >= threshold
        ]

    def remove(self, symbol: str) -> bool:
        target = symbol.upper()
        removed = {"flag": False}

        def _modify(data: dict) -> dict:
            symbols = data.setdefault("symbols", {})
            removed["flag"] = symbols.pop(target, None) is not None
            return data

        self._ensure_file()
        locked_read_modify_write(self.path, _modify)
        return removed["flag"]

    def restore(self, symbol: str) -> dict | None:
        target = symbol.upper()
        popped: dict = {}

        def _modify(data: dict) -> dict:
            symbols = data.setdefault("symbols", {})
            entry = symbols.pop(target, None)
            if entry is not None:
                popped.update(entry)
            return data

        self._ensure_file()
        locked_read_modify_write(self.path, _modify)
        return popped or None

    def _ensure_file(self) -> None:
        if not self.path.exists():
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.write({"symbols": {}})
