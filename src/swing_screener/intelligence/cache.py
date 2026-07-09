from __future__ import annotations

import json
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, TextIO

from swing_screener.intelligence.models import SymbolIntelligence
from swing_screener.settings.paths import data_dir
from swing_screener.utils.file_lock import FileLockTimeoutError, open_locked_text, read_json_with_lock


def _cache_path(for_date: date) -> Path:
    return data_dir() / "intelligence" / f"sweep_{for_date.isoformat()}.json"


def _empty_cache_text_as_object(text: str) -> str:
    return text if text.strip() else "{}"


def _as_cache_mapping(payload: Any) -> dict[str, Any]:
    return payload if isinstance(payload, dict) else {}


def _read_cache_mapping(path: Path) -> dict[str, Any]:
    payload = read_json_with_lock(path, text_filter=_empty_cache_text_as_object)
    return _as_cache_mapping(payload)


def _read_cache_mapping_for_update(fh: TextIO) -> dict[str, Any]:
    text = fh.read()
    if not text.strip():
        return {}
    try:
        return _as_cache_mapping(json.loads(text, parse_constant=lambda _constant: None))
    except json.JSONDecodeError:
        return {}


def _write_cache_mapping(fh: TextIO, payload: dict[str, Any]) -> None:
    fh.seek(0)
    fh.truncate()
    json.dump(payload, fh, indent=2, ensure_ascii=False, allow_nan=False)
    fh.write("\n")
    fh.flush()


def write_to_cache(ticker: str, result: SymbolIntelligence, for_date: date | None = None) -> None:
    target_date = for_date or datetime.now(timezone.utc).date()
    path = _cache_path(target_date)
    path.parent.mkdir(parents=True, exist_ok=True)
    upper = ticker.upper()
    entry = json.loads(result.model_dump_json())
    with open_locked_text(
        path,
        mode="r+",
        lock_kind="exclusive",
        create_file=True,
    ) as fh:
        existing = _read_cache_mapping_for_update(fh)
        existing[upper] = entry
        _write_cache_mapping(fh, existing)


def read_from_cache(ticker: str, for_date: date | None = None) -> SymbolIntelligence | None:
    target_date = for_date or datetime.now(timezone.utc).date()
    path = _cache_path(target_date)
    if not path.exists():
        return None
    try:
        data = _read_cache_mapping(path)
        entry = data.get(ticker.upper())
        if entry is None:
            return None
        return SymbolIntelligence.model_validate(entry)
    except (FileLockTimeoutError, json.JSONDecodeError, OSError, ValueError):
        return None


def read_latest_from_cache(ticker: str) -> SymbolIntelligence | None:
    """Return the most recent cached analysis for a ticker across all sweep dates.

    ``read_from_cache`` is scoped to a single (default: today) sweep file, so it
    misses an analysis produced on a prior session. Callers that just want the
    latest available read (manual reviews, cross-day lookups) scan newest-first.
    """
    base = data_dir() / "intelligence"
    if not base.exists():
        return None
    upper = ticker.upper()
    # ISO date filenames sort lexicographically in chronological order.
    for path in sorted(base.glob("sweep_*.json"), reverse=True):
        try:
            data = _read_cache_mapping(path)
        except (FileLockTimeoutError, json.JSONDecodeError, OSError):
            continue
        entry = data.get(upper)
        if entry is None:
            continue
        try:
            return SymbolIntelligence.model_validate(entry)
        except ValueError:
            continue
    return None
