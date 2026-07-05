"""Positions JSON repository."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from typing import Callable

from api.utils.file_lock import locked_read_json, locked_read_modify_write, locked_write_json
from api.utils.files import get_today_str


@dataclass
class PositionsRepository:
    path: Path

    def read(self) -> dict:
        return locked_read_json(self.path)

    def write(self, data: dict) -> None:
        locked_write_json(self.path, data)

    def update(self, modify_fn: Callable[[dict], dict]) -> dict:
        """Atomic read-modify-write under a single exclusive lock.

        Prevents the lost-update race of a separate read() + write(): the whole
        cycle holds one lock. modify_fn may raise a DomainError to abort without
        persisting (no write happens when it raises).
        """
        return locked_read_modify_write(self.path, modify_fn)

    def list_positions(self, status: Optional[str] = None) -> tuple[list[dict], str]:
        data = self.read()
        positions = data.get("positions", [])
        if status:
            positions = [p for p in positions if p.get("status") == status]
        return positions, data.get("asof", get_today_str())

    def get_position(self, position_id: str) -> dict | None:
        data = self.read()
        for pos in data.get("positions", []):
            if pos.get("position_id") == position_id:
                return pos
        return None
