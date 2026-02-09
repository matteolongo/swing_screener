"""Positions JSON repository."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from api.utils.files import read_json_file, write_json_file, get_today_str


@dataclass
class PositionsRepository:
    path: Path

    def read(self) -> dict:
        return read_json_file(self.path)

    def write(self, data: dict) -> None:
        write_json_file(self.path, data)

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
