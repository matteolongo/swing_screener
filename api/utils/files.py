"""File helpers for API JSON storage."""
from __future__ import annotations

from datetime import date
from pathlib import Path
import json
import re

from swing_screener.errors import NotFoundError, ServiceError


def read_json_file(path: Path) -> dict:
    """Read and parse JSON file, converting NaN to None."""
    if not path.exists():
        raise NotFoundError(f"File not found: {path.name}")
    try:
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"\bNaN\b", "null", text)
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise ServiceError(f"Invalid JSON in {path.name}: {exc}")


def write_json_file(path: Path, data: dict) -> None:
    """Write data to JSON file."""
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception as exc:
        raise ServiceError(f"Failed to write {path.name}: {exc}")


def get_today_str() -> str:
    """Get today's date as YYYY-MM-DD string."""
    return date.today().isoformat()
