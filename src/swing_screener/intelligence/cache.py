from __future__ import annotations

import json
from datetime import date, datetime, timezone
from pathlib import Path

from swing_screener.intelligence.models import SymbolIntelligence
from swing_screener.settings.paths import data_dir


def _cache_path(for_date: date) -> Path:
    return data_dir() / "intelligence" / f"sweep_{for_date.isoformat()}.json"


def write_to_cache(ticker: str, result: SymbolIntelligence, for_date: date | None = None) -> None:
    target_date = for_date or datetime.now(timezone.utc).date()
    path = _cache_path(target_date)
    path.parent.mkdir(parents=True, exist_ok=True)
    existing: dict = {}
    if path.exists():
        try:
            existing = json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            existing = {}
    existing[ticker.upper()] = json.loads(result.model_dump_json())
    path.write_text(json.dumps(existing, indent=2))


def read_from_cache(ticker: str, for_date: date | None = None) -> SymbolIntelligence | None:
    target_date = for_date or datetime.now(timezone.utc).date()
    path = _cache_path(target_date)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
        entry = data.get(ticker.upper())
        if entry is None:
            return None
        return SymbolIntelligence.model_validate(entry)
    except (json.JSONDecodeError, OSError, ValueError):
        return None
