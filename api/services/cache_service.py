"""Cache introspection and clear operations for all known disk caches."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from api.models.cache import CacheStatusEntry
from swing_screener.settings import get_settings_manager


_CACHE_DEFS: list[dict] = [
    {
        "id": "ticker_meta",
        "label": "Ticker Metadata",
        "storage": "disk_json",
        "ttl_description": "30 days",
        "can_clear": True,
        "path": ".cache/ticker_meta.json",
        "kind": "json_file",
    },
    {
        "id": "ticker_info",
        "label": "Ticker Info",
        "storage": "disk_json",
        "ttl_description": "7 days",
        "can_clear": True,
        "path": ".cache/ticker_info.json",
        "kind": "json_file",
    },
    {
        "id": "ohlcv_yfinance",
        "label": "OHLCV yfinance",
        "storage": "disk_parquet",
        "ttl_description": "8h same-day · ∞ historical",
        "can_clear": True,
        "path": ".cache/market_data/by_ticker",
        "kind": "parquet_dir",
    },
    {
        "id": "ohlcv_polygon",
        "label": "OHLCV Polygon",
        "storage": "disk_parquet",
        "ttl_description": "7 days",
        "can_clear": True,
        "path": ".cache/polygon_data",
        "kind": "parquet_dir",
    },
    {
        "id": "screener_eval",
        "label": "Screener Eval",
        "storage": "disk_parquet",
        "ttl_description": "24h",
        "can_clear": True,
        "path": ".cache/eval",
        "kind": "parquet_dir",
    },
    {
        "id": "earnings_proximity",
        "label": "Earnings Proximity",
        "storage": "disk_json",
        "ttl_description": "7 days",
        "can_clear": True,
        "path": ".cache/earnings_days.json",
        "kind": "json_file",
    },
    {
        "id": "intelligence_evidence",
        "label": "Intelligence Evidence",
        "storage": "disk_json",
        "ttl_description": "1 day",
        "can_clear": True,
        "path": "data/intelligence/evidence",
        "kind": "json_dir",
    },
    {
        "id": "currency_lru",
        "label": "Currency Detect (LRU)",
        "storage": "memory",
        "ttl_description": "Process lifetime",
        "can_clear": False,
        "path": None,
        "kind": "memory",
    },
    {
        "id": "instrument_master",
        "label": "Instrument Master (LRU)",
        "storage": "memory",
        "ttl_description": "Process lifetime",
        "can_clear": False,
        "path": None,
        "kind": "memory",
    },
    {
        "id": "market_hours",
        "label": "Market Hours (LRU)",
        "storage": "memory",
        "ttl_description": "Process lifetime",
        "can_clear": False,
        "path": None,
        "kind": "memory",
    },
    {
        "id": "yaml_settings",
        "label": "YAML Settings",
        "storage": "memory",
        "ttl_description": "Auto on file change",
        "can_clear": False,
        "path": None,
        "kind": "memory",
    },
]

_ID_TO_DEF: dict[str, dict] = {d["id"]: d for d in _CACHE_DEFS}


def _load_cache_config() -> dict:
    """Return the 'cache' block from user config, or {} on failure."""
    try:
        _doc = get_settings_manager().load_user_document()
        return _doc.get("cache", {})
    except Exception:
        return {}


def _dynamic_ttl_description(cache_id: str, fallback: str, cache_cfg: dict) -> str:
    """Return config-derived ttl_description for configurable caches, fallback otherwise."""
    if cache_id == "ticker_meta":
        n = cache_cfg.get("ticker_meta_ttl_days", 30)
        return f"{int(round(n))} days"
    if cache_id == "ohlcv_polygon":
        n = cache_cfg.get("polygon_cache_ttl_days", 7)
        return f"{int(round(n))} days"
    return fallback


def _scan_dir(path: str, ext: str) -> tuple[Optional[str], int]:
    """Single rglob pass: returns (newest_mtime_iso, count_of_matching_files)."""
    p = Path(path)
    if not p.exists():
        return None, 0
    newest = None
    count = 0
    for f in p.rglob("*"):
        if not f.is_file():
            continue
        m = f.stat().st_mtime
        if newest is None or m > newest:
            newest = m
        if f.name.endswith(ext):
            count += 1
    iso = datetime.fromtimestamp(newest, tz=timezone.utc).isoformat() if newest is not None else None
    return iso, count


def _mtime_iso(path: str) -> Optional[str]:
    """Return ISO8601 of the newest mtime found under path, or None if absent."""
    p = Path(path)
    if not p.exists():
        return None
    if p.is_file():
        ts = p.stat().st_mtime
        return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
    else:
        file_mtimes = [f.stat().st_mtime for f in p.rglob("*") if f.is_file()]
        if not file_mtimes:
            return None
        ts = max(file_mtimes)
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def _entry_count(path: str, kind: str) -> Optional[int]:
    p = Path(path)
    if not p.exists():
        return 0
    if kind == "json_file":
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            return len(data) if isinstance(data, dict) else None
        except Exception:
            return None
    if kind in ("parquet_dir", "json_dir"):
        ext = ".parquet" if kind == "parquet_dir" else ".json"
        return sum(1 for _ in p.rglob(f"*{ext}"))
    return None


class CacheService:
    def status(self) -> list[CacheStatusEntry]:
        cache_cfg = _load_cache_config()
        entries = []
        for d in _CACHE_DEFS:
            path = d.get("path")
            kind = d["kind"]
            if path and kind in ("parquet_dir", "json_dir"):
                ext = ".parquet" if kind == "parquet_dir" else ".json"
                last_modified_at, entry_count = _scan_dir(path, ext)
            else:
                last_modified_at = _mtime_iso(path) if path else None
                entry_count = _entry_count(path, kind) if path else None
            entries.append(
                CacheStatusEntry(
                    id=d["id"],
                    label=d["label"],
                    storage=d["storage"],
                    ttl_description=_dynamic_ttl_description(d["id"], d["ttl_description"], cache_cfg),
                    can_clear=d["can_clear"],
                    last_modified_at=last_modified_at,
                    entry_count=entry_count,
                )
            )
        return entries

    def clear(self, cache_id: str) -> bool:
        """Clear a cache by id. Returns True on success, raises ValueError for unknown id."""
        if cache_id not in _ID_TO_DEF:
            raise ValueError(f"Unknown cache id: {cache_id!r}")
        d = _ID_TO_DEF[cache_id]
        if not d["can_clear"]:
            raise ValueError(f"Cache {cache_id!r} cannot be cleared")
        path = d.get("path")
        if path is None:
            return True
        p = Path(path)
        kind = d["kind"]
        if kind == "json_file":
            if p.exists():
                p.write_text("{}", encoding="utf-8")
        elif kind in ("parquet_dir", "json_dir"):
            if p.exists():
                ext = ".parquet" if kind == "parquet_dir" else ".json"
                for f in p.rglob(f"*{ext}"):
                    try:
                        f.unlink(missing_ok=True)
                    except OSError:
                        pass
        return True
