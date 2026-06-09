"""Fetch ticker metadata (company name, sector, currency) using yfinance."""
from __future__ import annotations

import json
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

import yfinance as yf
import logging

from swing_screener.data.currency import detect_currency

logger = logging.getLogger(__name__)

_DEFAULT_CACHE_PATH = Path(".cache/ticker_info.json")
_DEFAULT_TTL_DAYS = 7.0
_DEFAULT_MAX_WORKERS = 8


def get_ticker_info(ticker: str) -> dict[str, Optional[str]]:
    """
    Fetch company name, sector, and currency for a ticker.

    Returns:
        dict with keys: 'name', 'sector', 'currency'
        Returns None values if data unavailable.
    """
    try:
        t = yf.Ticker(ticker)
        info = t.info
        currency = info.get("currency")
        normalized_currency = str(currency).upper() if currency else None
        if normalized_currency not in {"USD", "EUR"}:
            normalized_currency = detect_currency(ticker)

        return {
            'name': info.get('longName') or info.get('shortName'),
            'sector': info.get('sector'),
            'currency': normalized_currency,
        }
    except Exception as e:
        logger.warning(f"Failed to fetch info for {ticker}: {e}")
        return {'name': None, 'sector': None, 'currency': detect_currency(ticker)}


def _load_info_cache(path: Path) -> dict[str, dict]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {}
    except (OSError, ValueError):
        return {}


def _save_info_cache(path: Path, cache: dict[str, dict]) -> None:
    tmp = path.with_name(f".{path.name}.tmp-{uuid.uuid4().hex}")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
        tmp.replace(path)
    except OSError as exc:
        logger.warning("Failed to persist ticker info cache %s: %s", path, exc)
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass


def get_multiple_ticker_info(
    tickers: list[str],
    cache_path: str | Path | None = None,
    ttl_days: float = _DEFAULT_TTL_DAYS,
    max_workers: int = _DEFAULT_MAX_WORKERS,
) -> dict[str, dict[str, Optional[str]]]:
    """
    Fetch company info for multiple tickers.

    Successful lookups are cached on disk for ``ttl_days`` (name/sector/currency
    change rarely); cache misses are fetched in parallel. Failed lookups are
    returned but never cached, so they are retried on the next call.

    Returns:
        dict mapping ticker -> {'name': str, 'sector': str, 'currency': str}
    """
    path = Path(cache_path) if cache_path is not None else _DEFAULT_CACHE_PATH
    cache = _load_info_cache(path)
    now = time.time()
    ttl_sec = ttl_days * 86400.0

    result: dict[str, dict[str, Optional[str]]] = {}
    misses: list[str] = []
    for ticker in dict.fromkeys(tickers):
        entry = cache.get(ticker)
        if (
            isinstance(entry, dict)
            and (now - float(entry.get("fetched_at", 0))) <= ttl_sec
        ):
            result[ticker] = {
                "name": entry.get("name"),
                "sector": entry.get("sector"),
                "currency": entry.get("currency"),
            }
        else:
            misses.append(ticker)

    if misses:
        workers = max(1, min(max_workers, len(misses)))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            fetched = list(pool.map(get_ticker_info, misses))
        cache_dirty = False
        for ticker, info in zip(misses, fetched):
            result[ticker] = info
            if info.get("name") is not None or info.get("sector") is not None:
                cache[ticker] = {**info, "fetched_at": now}
                cache_dirty = True
        if cache_dirty:
            _save_info_cache(path, cache)

    return result
