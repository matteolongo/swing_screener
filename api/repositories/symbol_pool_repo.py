"""Symbol pool JSON repository (read-only at runtime).

The committed ``symbol_pool.json`` is an immutable build artifact. Runtime
fetch-health counters live in the review-queue store, never here, so the pool
file never drifts from its built state.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from api.utils.file_lock import locked_read_json, locked_write_json


@dataclass
class SymbolPoolRepository:
    path: Path

    def read(self) -> dict:
        return locked_read_json(self.path)

    def write(self, data: dict) -> None:
        locked_write_json(self.path, data)

    def list_symbols(self) -> list[dict]:
        return self.read().get("symbols", [])
