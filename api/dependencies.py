"""Shared dependencies for API routers."""
from __future__ import annotations

from pathlib import Path
from typing import Optional
import json

from fastapi import HTTPException

# Repository root
ROOT_DIR = Path(__file__).parent.parent.resolve()
DATA_DIR = ROOT_DIR / "data"
POSITIONS_FILE = DATA_DIR / "positions.json"
ORDERS_FILE = DATA_DIR / "orders.json"


def get_positions_path() -> Path:
    """Get path to positions.json."""
    return POSITIONS_FILE


def get_orders_path() -> Path:
    """Get path to orders.json."""
    return ORDERS_FILE


def read_json_file(path: Path) -> dict:
    """Read and parse JSON file, converting NaN to None."""
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {path.name}")
    try:
        # Read raw text and replace NaN with null before parsing
        import re
        text = path.read_text(encoding="utf-8")
        # Replace NaN (not part of a word) with null
        text = re.sub(r'\bNaN\b', 'null', text)
        data = json.loads(text)
        return data
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Invalid JSON in {path.name}: {e}")


def write_json_file(path: Path, data: dict) -> None:
    """Write data to JSON file."""
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write {path.name}: {e}")


def get_today_str() -> str:
    """Get today's date as YYYY-MM-DD string."""
    from datetime import date
    return date.today().isoformat()
