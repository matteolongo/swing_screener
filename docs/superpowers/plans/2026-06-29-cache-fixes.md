# Cache Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two backend cache TTL gaps, wire `forceRefresh` into the Screener UI, add a `/api/cache` REST API, and extend the DataSources page with a Cache section showing all disk caches with clear buttons.

**Architecture:** Four independent tasks in delivery order — backend TTL fixes first (no API changes), then the cache REST API, then the frontend Screener forceRefresh, then the cache UI. Each task is independently testable. Tasks 3 and 4 can be done in parallel once Task 2 is merged.

**Tech Stack:** Python 3.11 · FastAPI · Pydantic v2 · pytest · React 18 · TypeScript · React Query · Vitest

## Global Constraints

- Python: `from __future__ import annotations` at top of every new .py file
- Pydantic: use `BaseModel` from `pydantic`; v2 syntax (`model_config`, `Field`)
- All new API endpoints under `/api/cache/...` prefix
- Frontend: all user-facing strings in `web-ui/src/i18n/messages.en.ts`; no hardcoded UI strings
- Frontend types: camelCase in TS; snake_case only in API request/response literals
- No new pages — Cache section goes inside the existing DataSources page
- Tests requiring network calls must be marked `@pytest.mark.integration`
- Run `pytest -q -m "not integration"` (backend) and `npx vitest run` (frontend) between every task

---

## Task 1: Backend TTL Fixes (ticker_meta + Polygon OHLCV)

**Files:**
- Modify: `src/swing_screener/data/market_data.py` (lines ~158–219)
- Modify: `src/swing_screener/data/providers/polygon_provider.py` (lines ~96–110)
- Modify: `config/defaults.yaml` (after line 417 in `data_providers.yfinance` block)
- Test: `tests/data/test_market_metadata.py` (add to existing file)
- Test: `tests/data/test_polygon_provider.py` (add to existing file)

**Interfaces:**
- Produces: `fetch_ticker_metadata(tickers, ..., cache_ttl_days=None)` — same signature, adds optional `cache_ttl_days` kwarg defaulting to config value (30 days); stale entries (age > TTL) are re-fetched instead of returned from cache
- Produces: `PolygonProvider._fetch_ticker` — same signature; cache hits on non-historical ranges now expire after `_cache_ttl_days` (7 days by default)

- [ ] **Step 1: Add `cache:` block to `config/defaults.yaml`**

Open `config/defaults.yaml`. After the existing `same_day_cache_ttl_minutes: 480` line (around line 417), still inside the `data_providers.yfinance:` block, add a comment and two new keys at the top-level `data_providers:` sibling level. Add this block after the entire `data_providers:` section (around line 431, after `data_provider_roadmap:` but before it):

```yaml
# ---------------------------------------------------------------------------
# Cache TTL settings for disk caches.
# ---------------------------------------------------------------------------
cache:
  # Days before a ticker_meta.json entry is considered stale and re-fetched.
  ticker_meta_ttl_days: 30
  # Days before a Polygon OHLCV parquet cache file is considered stale.
  # Only applies to ranges whose end date is today (historical ranges never expire).
  polygon_cache_ttl_days: 7
```

- [ ] **Step 2: Write failing tests for ticker_meta TTL**

Add to `tests/data/test_market_metadata.py` (keeping existing tests):

```python
import json
import time
from pathlib import Path

import pytest

from swing_screener.data.market_data import fetch_ticker_metadata


def test_ticker_metadata_respects_ttl(tmp_path):
    """Stale cache entries (beyond TTL) are not returned from cache."""
    cache_file = tmp_path / "ticker_meta.json"
    # Write a stale entry: fetched 40 days ago
    stale_ts = time.time() - (40 * 86400)
    cache_file.write_text(
        json.dumps({"AAPL": {"name": "Stale Apple", "currency": "USD", "exchange": "NMS", "fetched_at": stale_ts}}),
        encoding="utf-8",
    )
    # Should NOT return stale entry; instead falls through to network (or raises)
    # We monkeypatch yf.Ticker to avoid a network call
    import yfinance as yf
    from unittest.mock import patch, MagicMock

    mock_ticker = MagicMock()
    mock_ticker.fast_info = None
    mock_ticker.get_info.return_value = {"shortName": "Fresh Apple", "currency": "USD", "exchange": "XNAS"}
    with patch.object(yf, "Ticker", return_value=mock_ticker):
        df = fetch_ticker_metadata(
            ["AAPL"],
            cache_path=str(cache_file),
            cache_ttl_days=30,
        )
    # Should have re-fetched (not used stale cache)
    assert df.loc["AAPL", "name"] == "Fresh Apple"


def test_ticker_metadata_uses_fresh_cache(tmp_path):
    """Fresh cache entries (within TTL) are returned without network calls."""
    cache_file = tmp_path / "ticker_meta.json"
    fresh_ts = time.time() - (1 * 86400)  # 1 day ago
    cache_file.write_text(
        json.dumps({"AAPL": {"name": "Cached Apple", "currency": "USD", "exchange": "NMS", "fetched_at": fresh_ts}}),
        encoding="utf-8",
    )
    import yfinance as yf
    from unittest.mock import patch

    with patch.object(yf, "Ticker", side_effect=AssertionError("should not call yfinance")):
        df = fetch_ticker_metadata(
            ["AAPL"],
            cache_path=str(cache_file),
            cache_ttl_days=30,
        )
    assert df.loc["AAPL", "name"] == "Cached Apple"
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pytest tests/data/test_market_metadata.py::test_ticker_metadata_respects_ttl tests/data/test_market_metadata.py::test_ticker_metadata_uses_fresh_cache -v
```

Expected: FAIL — `fetch_ticker_metadata` does not accept `cache_ttl_days` yet and does not check `fetched_at`.

- [ ] **Step 4: Implement TTL in `fetch_ticker_metadata`**

Edit `src/swing_screener/data/market_data.py`. Add `import time` to the imports (already present via stdlib — confirm). Then update the function signature and the cache-read loop:

```python
import time  # confirm already present — add if missing

def fetch_ticker_metadata(
    tickers: Iterable[str],
    cache_path: str = ".cache/ticker_meta.json",
    use_cache: bool = True,
    force_refresh: bool = False,
    cache_ttl_days: float | None = None,
) -> pd.DataFrame:
    """
    Fetch lightweight metadata for tickers (name, currency, exchange) via yfinance.
    Uses a small JSON cache to avoid repeated network calls.
    cache_ttl_days: override for how many days cache entries are valid (default: from config or 30).
    """
    if cache_ttl_days is None:
        try:
            from swing_screener.settings import get_settings_manager
            _doc = get_settings_manager().load_user_document()
            cache_ttl_days = float(_doc.get("cache", {}).get("ticker_meta_ttl_days", 30))
        except Exception:
            cache_ttl_days = 30.0

    _ttl_seconds = cache_ttl_days * 86400.0
    _now = time.time()

    tks = normalize_tickers(tickers)
    cache_file = Path(cache_path)
    cache: dict[str, dict] = {}
    if use_cache and cache_file.exists():
        try:
            cache = json.loads(cache_file.read_text(encoding="utf-8"))
        except Exception:
            cache = {}

    results: dict[str, dict] = {}
    for t in tks:
        if not force_refresh and t in cache:
            entry = cache[t]
            fetched_at = entry.get("fetched_at", 0)
            if (_now - float(fetched_at)) <= _ttl_seconds:
                results[t] = {k: v for k, v in entry.items() if k != "fetched_at"}
                continue

        # ... rest of existing fetch logic (unchanged) ...
```

And on write (where results are saved back to cache), add `fetched_at`:

```python
        results[t] = {
            "name": name,
            "currency": currency,
            "exchange": exchange,
        }

    if use_cache:
        _now_write = time.time()
        for t in results:
            cache[t] = {**results[t], "fetched_at": _now_write}
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(json.dumps(cache, indent=2), encoding="utf-8")
```

Replace the existing write block:
```python
    if use_cache:
        cache.update(results)
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(json.dumps(cache, indent=2), encoding="utf-8")
```
with:
```python
    if use_cache:
        _now_write = time.time()
        for t, v in results.items():
            cache[t] = {**v, "fetched_at": _now_write}
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(json.dumps(cache, indent=2), encoding="utf-8")
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/data/test_market_metadata.py::test_ticker_metadata_respects_ttl tests/data/test_market_metadata.py::test_ticker_metadata_uses_fresh_cache -v
```

Expected: PASS

- [ ] **Step 6: Write failing tests for Polygon OHLCV TTL**

Add to `tests/data/test_polygon_provider.py`:

```python
import time
from pathlib import Path
from unittest.mock import patch, MagicMock

import pandas as pd
import pytest

from swing_screener.data.providers.polygon_provider import PolygonProvider


def _make_provider(tmp_path: Path, cache_ttl_days: float = 7.0) -> PolygonProvider:
    return PolygonProvider(
        api_key="TEST_KEY",
        cache_dir=str(tmp_path),
        rate_limit_sleep=0,
        cache_ttl_days=cache_ttl_days,
    )


def _write_parquet_cache(path: Path, age_seconds: float) -> None:
    """Write an empty parquet at `path` with mtime set to `age_seconds` ago."""
    df = pd.DataFrame()
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path)
    old_mtime = time.time() - age_seconds
    import os
    os.utime(path, (old_mtime, old_mtime))


def test_polygon_recent_range_cache_expires(tmp_path):
    """A recent-range cache file older than TTL is re-fetched."""
    from datetime import date, timedelta
    today = date.today().isoformat()
    start = (date.today() - timedelta(days=30)).isoformat()

    provider = _make_provider(tmp_path, cache_ttl_days=7)
    cache_path = provider._cache_path("AAPL", start, today)

    # Write a stale cache file (10 days old, TTL is 7)
    _write_parquet_cache(cache_path, age_seconds=10 * 86400)

    fetched = []

    def mock_fetch(ticker, s, e):
        fetched.append(ticker)
        return []

    with patch.object(provider, "_fetch_bars_from_api", side_effect=mock_fetch):
        provider._fetch_ticker("AAPL", start, today)

    assert fetched == ["AAPL"], "Expected re-fetch when recent-range cache is expired"


def test_polygon_historical_range_never_expires(tmp_path):
    """A historical-range cache file is used regardless of age."""
    from datetime import date, timedelta
    start = "2023-01-01"
    end = "2023-06-30"  # strictly in the past

    provider = _make_provider(tmp_path, cache_ttl_days=7)
    cache_path = provider._cache_path("AAPL", start, end)

    # Write a very stale cache file (365 days old)
    import pandas as pd
    frames = [{"o": 150.0, "h": 155.0, "l": 149.0, "c": 152.0, "v": 1000000, "t": 1672531200000}]
    _write_parquet_cache(cache_path, age_seconds=365 * 86400)
    # Re-write with actual content so read_parquet succeeds
    df = pd.DataFrame(frames)
    # Write minimal valid parquet
    cache_path.write_bytes(b"")  # will fail read_parquet — use a real parquet
    # Use the provider's bars_to_series to make valid parquet
    df_real = provider._bars_to_series(frames, "AAPL")
    df_real.to_parquet(cache_path)
    old_mtime = time.time() - (365 * 86400)
    import os
    os.utime(cache_path, (old_mtime, old_mtime))

    fetched = []
    with patch.object(provider, "_fetch_bars_from_api", side_effect=lambda t, s, e: fetched.append(t) or []):
        provider._fetch_ticker("AAPL", start, end)

    assert fetched == [], "Historical range should use cache regardless of age"


def test_polygon_recent_range_fresh_cache_used(tmp_path):
    """A recent-range cache file within TTL is returned without re-fetching."""
    from datetime import date, timedelta
    today = date.today().isoformat()
    start = (date.today() - timedelta(days=30)).isoformat()

    provider = _make_provider(tmp_path, cache_ttl_days=7)
    cache_path = provider._cache_path("AAPL", start, today)

    # Write a fresh cache (1 day old, TTL is 7)
    frames = [{"o": 150.0, "h": 155.0, "l": 149.0, "c": 152.0, "v": 1000000, "t": 1672531200000}]
    df_real = provider._bars_to_series(frames, "AAPL")
    df_real.to_parquet(cache_path)
    old_mtime = time.time() - (1 * 86400)
    import os
    os.utime(cache_path, (old_mtime, old_mtime))

    fetched = []
    with patch.object(provider, "_fetch_bars_from_api", side_effect=lambda t, s, e: fetched.append(t) or []):
        provider._fetch_ticker("AAPL", start, today)

    assert fetched == [], "Fresh cache should be used without re-fetching"
```

- [ ] **Step 7: Run tests to verify they fail**

```bash
pytest tests/data/test_polygon_provider.py::test_polygon_recent_range_cache_expires tests/data/test_polygon_provider.py::test_polygon_historical_range_never_expires tests/data/test_polygon_provider.py::test_polygon_recent_range_fresh_cache_used -v
```

Expected: FAIL — `PolygonProvider.__init__` does not accept `cache_ttl_days` and `_fetch_ticker` does not check mtime.

- [ ] **Step 8: Implement Polygon OHLCV mtime TTL**

Edit `src/swing_screener/data/providers/polygon_provider.py`.

Add `from datetime import date` to the top-level imports.

Update `__init__`:

```python
def __init__(
    self,
    api_key: str,
    cache_dir: str = ".cache/polygon_data",
    rate_limit_sleep: float = 12.0,
    cache_ttl_days: float | None = None,
) -> None:
    self.api_key = api_key
    self.cache_dir = Path(cache_dir)
    self.rate_limit_sleep = rate_limit_sleep
    self.cache_dir.mkdir(parents=True, exist_ok=True)
    if cache_ttl_days is not None:
        self._cache_ttl_days = float(cache_ttl_days)
    else:
        try:
            from swing_screener.settings import get_settings_manager
            _doc = get_settings_manager().load_user_document()
            self._cache_ttl_days = float(_doc.get("cache", {}).get("polygon_cache_ttl_days", 7))
        except Exception:
            self._cache_ttl_days = 7.0
```

Update `_fetch_ticker`:

```python
def _fetch_ticker(
    self, ticker: str, start_date: str, end_date: str
) -> pd.DataFrame:
    cache = self._cache_path(ticker, start_date, end_date)
    if cache.exists():
        is_historical = end_date < date.today().isoformat()
        cache_age_s = time.time() - cache.stat().st_mtime
        if is_historical or cache_age_s <= self._cache_ttl_days * 86400:
            try:
                return pd.read_parquet(cache)
            except Exception:
                cache.unlink(missing_ok=True)
        else:
            cache.unlink(missing_ok=True)

    bars = self._fetch_bars_from_api(ticker, start_date, end_date)
    df = self._bars_to_series(bars, ticker)
    if not df.empty:
        df.to_parquet(cache)
    return df
```

- [ ] **Step 9: Run Polygon TTL tests**

```bash
pytest tests/data/test_polygon_provider.py::test_polygon_recent_range_cache_expires tests/data/test_polygon_provider.py::test_polygon_historical_range_never_expires tests/data/test_polygon_provider.py::test_polygon_recent_range_fresh_cache_used -v
```

Expected: PASS

- [ ] **Step 10: Run full test suite**

```bash
pytest -q -m "not integration"
```

Expected: all pass

- [ ] **Step 11: Commit**

```bash
git add src/swing_screener/data/market_data.py \
        src/swing_screener/data/providers/polygon_provider.py \
        config/defaults.yaml \
        tests/data/test_market_metadata.py \
        tests/data/test_polygon_provider.py
git commit -m "fix: add TTL to ticker_meta cache and Polygon OHLCV cache"
```

---

## Task 2: Backend Cache API (`/api/cache/status` and `/api/cache/clear/{id}`)

**Files:**
- Create: `api/models/cache.py`
- Create: `api/services/cache_service.py`
- Create: `api/routers/cache.py`
- Modify: `api/dependencies.py` (add `get_cache_service`)
- Modify: `api/main.py` (register router)
- Create: `tests/api/test_cache_router.py`

**Interfaces:**
- Consumes: nothing from Task 1
- Produces: `GET /api/cache/status → list[CacheStatusEntry]`
- Produces: `POST /api/cache/clear/{cache_id} → {"cleared": true, "cache_id": str}`

- [ ] **Step 1: Create `api/models/cache.py`**

```python
"""Pydantic response models for the Cache management API."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel


class CacheStatusEntry(BaseModel):
    id: str
    label: str
    storage: Literal["disk_json", "disk_parquet", "memory"]
    ttl_description: str
    can_clear: bool
    last_modified_at: Optional[str] = None  # ISO8601
    entry_count: Optional[int] = None


class CacheClearResponse(BaseModel):
    cleared: bool
    cache_id: str
```

- [ ] **Step 2: Create `api/services/cache_service.py`**

```python
"""Cache introspection and clear operations for all known disk caches."""
from __future__ import annotations

import glob
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from api.models.cache import CacheStatusEntry


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


def _mtime_iso(path: str) -> Optional[str]:
    """Return ISO8601 of the newest mtime found under path, or None if absent."""
    p = Path(path)
    if not p.exists():
        return None
    if p.is_file():
        ts = p.stat().st_mtime
    else:
        files = list(p.rglob("*"))
        if not files:
            return None
        ts = max(f.stat().st_mtime for f in files if f.is_file())
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
        entries = []
        for d in _CACHE_DEFS:
            path = d.get("path")
            kind = d["kind"]
            entries.append(
                CacheStatusEntry(
                    id=d["id"],
                    label=d["label"],
                    storage=d["storage"],
                    ttl_description=d["ttl_description"],
                    can_clear=d["can_clear"],
                    last_modified_at=_mtime_iso(path) if path else None,
                    entry_count=_entry_count(path, kind) if path else None,
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
```

- [ ] **Step 3: Create `api/routers/cache.py`**

```python
"""Cache management endpoints: status introspection and clear operations."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_cache_service
from api.models.cache import CacheStatusEntry, CacheClearResponse
from api.services.cache_service import CacheService

router = APIRouter(tags=["cache"])


@router.get("/status", response_model=list[CacheStatusEntry])
def get_cache_status(service: CacheService = Depends(get_cache_service)) -> list[CacheStatusEntry]:
    return service.status()


@router.post("/clear/{cache_id}", response_model=CacheClearResponse)
def clear_cache(cache_id: str, service: CacheService = Depends(get_cache_service)) -> CacheClearResponse:
    try:
        service.clear(cache_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return CacheClearResponse(cleared=True, cache_id=cache_id)
```

- [ ] **Step 4: Add `get_cache_service` to `api/dependencies.py`**

Add after the `get_datasources_service` block (around line 201):

```python
from api.services.cache_service import CacheService

_cache_service: CacheService | None = None

def get_cache_service() -> CacheService:
    global _cache_service
    if _cache_service is None:
        _cache_service = CacheService()
    return _cache_service
```

- [ ] **Step 5: Register router in `api/main.py`**

Add import after the other router imports:

```python
from api.routers import cache as cache_router
```

Add include after the last `app.include_router` line (before the `@app.api_route` catch-all):

```python
app.include_router(cache_router.router, prefix="/api/cache", tags=["cache"])
```

- [ ] **Step 6: Write tests**

Create `tests/api/test_cache_router.py`:

```python
"""Tests for the /api/cache endpoints."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_get_cache_status_returns_list():
    resp = client.get("/api/cache/status")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_get_cache_status_schema():
    resp = client.get("/api/cache/status")
    assert resp.status_code == 200
    entry = resp.json()[0]
    assert "id" in entry
    assert "label" in entry
    assert "storage" in entry
    assert "ttl_description" in entry
    assert "can_clear" in entry
    assert "last_modified_at" in entry
    assert "entry_count" in entry


def test_get_cache_status_known_ids():
    resp = client.get("/api/cache/status")
    ids = {e["id"] for e in resp.json()}
    assert "ticker_meta" in ids
    assert "ohlcv_yfinance" in ids
    assert "screener_eval" in ids


def test_clear_unknown_cache_returns_400():
    resp = client.post("/api/cache/clear/does_not_exist")
    assert resp.status_code == 400


def test_clear_memory_cache_returns_400():
    resp = client.post("/api/cache/clear/currency_lru")
    assert resp.status_code == 400


def test_clear_json_cache_writes_empty_dict(tmp_path):
    cache_file = tmp_path / "ticker_meta.json"
    cache_file.write_text(json.dumps({"AAPL": {"name": "Apple"}}))

    from api.services.cache_service import CacheService, _ID_TO_DEF
    original_path = _ID_TO_DEF["ticker_meta"]["path"]
    _ID_TO_DEF["ticker_meta"]["path"] = str(cache_file)
    try:
        service = CacheService()
        service.clear("ticker_meta")
        assert json.loads(cache_file.read_text()) == {}
    finally:
        _ID_TO_DEF["ticker_meta"]["path"] = original_path
```

- [ ] **Step 7: Run tests**

```bash
pytest tests/api/test_cache_router.py -v
```

Expected: all pass

- [ ] **Step 8: Run full test suite**

```bash
pytest -q -m "not integration"
```

Expected: all pass

- [ ] **Step 9: Commit**

```bash
git add api/models/cache.py \
        api/services/cache_service.py \
        api/routers/cache.py \
        api/dependencies.py \
        api/main.py \
        tests/api/test_cache_router.py
git commit -m "feat: add /api/cache/status and /api/cache/clear endpoints"
```

---

## Task 3: Frontend — Screener `forceRefresh`

**Files:**
- Modify: `web-ui/src/features/screener/types.ts` (add `forceRefresh?` to `ScreenerRequest`)
- Modify: `web-ui/src/features/screener/api.ts` (add `force_refresh` to `apiRequest`)
- Modify: `web-ui/src/components/domain/screener/ScreenerForm.tsx` (add forceRefresh prop + checkbox)
- Modify: `web-ui/src/components/domain/workspace/ScreenerInboxPanel.tsx` (add state + pass to form)
- Modify: `web-ui/src/i18n/messages.en.ts` (add forceRefresh strings)

**Interfaces:**
- Consumes: nothing from Task 1 or 2
- Produces: `ScreenerRequest.forceRefresh?: boolean` — when `true`, API receives `force_refresh: true` in POST body

- [ ] **Step 1: Add forceRefresh i18n strings**

In `web-ui/src/i18n/messages.en.ts`, inside `screener.controls`, add two keys after `hideFilters`:

```typescript
forceRefresh: 'Force cache refresh',
forceRefreshWarning: 'Slower — re-fetches all market data',
```

- [ ] **Step 2: Add `forceRefresh` to `ScreenerRequest` type**

In `web-ui/src/features/screener/types.ts`, add to `ScreenerRequest`:

```typescript
export interface ScreenerRequest {
  universe?: string;
  tickers?: string[];
  top?: number;
  asofDate?: string;
  minPrice?: number;
  maxPrice?: number;
  currencies?: string[];
  exchangeMics?: string[];
  includeOtc?: boolean;
  includeHeld?: boolean;
  instrumentTypes?: Array<'equity' | 'etf'>;
  breakoutLookback?: number;
  pullbackMa?: number;
  minHistory?: number;
  requireWeeklyUptrend?: boolean;
  forceRefresh?: boolean;  // <-- add this line
}
```

- [ ] **Step 3: Wire `forceRefresh` in `runScreener` API function**

In `web-ui/src/features/screener/api.ts`, add `force_refresh` to `apiRequest` inside `runScreener`:

```typescript
const apiRequest = {
  universe: request.universe,
  tickers: request.tickers,
  top: request.top,
  asof_date: request.asofDate,
  min_price: request.minPrice,
  max_price: request.maxPrice,
  currencies: request.currencies,
  exchange_mics: request.exchangeMics,
  include_otc: request.includeOtc,
  include_held: request.includeHeld,
  instrument_types: request.instrumentTypes,
  breakout_lookback: request.breakoutLookback,
  pullback_ma: request.pullbackMa,
  min_history: request.minHistory,
  require_weekly_uptrend: request.requireWeeklyUptrend,
  force_refresh: request.forceRefresh,  // <-- add this line
};
```

- [ ] **Step 4: Add `forceRefresh` prop to `ScreenerFormProps` and render checkbox**

In `web-ui/src/components/domain/screener/ScreenerForm.tsx`:

Add to `ScreenerFormProps` interface:
```typescript
forceRefresh: boolean;
setForceRefresh: (value: boolean) => void;
```

In the expanded form (the non-collapsed `return`), add a new `<label>` in the checkbox row after the `requireWeeklyUptrend` checkbox:

```tsx
<label className="flex min-h-11 items-center gap-2 cursor-pointer">
  <input
    type="checkbox"
    checked={forceRefresh}
    onChange={(e) => setForceRefresh(e.target.checked)}
    aria-label={t('screener.controls.forceRefresh')}
    className="w-5 h-5 text-primary border-border rounded focus:ring-primary"
    disabled={isLoading}
  />
  <span className="text-sm font-medium text-muted">{t('screener.controls.forceRefresh')}</span>
  {forceRefresh && (
    <span className="text-xs text-warning">{t('screener.controls.forceRefreshWarning')}</span>
  )}
</label>
```

Also add `forceRefresh` and `setForceRefresh` to the destructured props in the function signature.

- [ ] **Step 5: Add `forceRefresh` state to `ScreenerInboxPanel` and pass to form**

In `web-ui/src/components/domain/workspace/ScreenerInboxPanel.tsx`:

Add state (not persisted to localStorage — resets to false each session):
```typescript
const [forceRefresh, setForceRefresh] = useState(false);
```

Add to `handleRunScreener`:
```typescript
screenerMutation.mutate({
  // ... existing fields ...
  forceRefresh: forceRefresh || undefined,
});
```

Reset `forceRefresh` after a successful run (inside `useRunScreenerMutation` callback):
```typescript
const screenerMutation = useRunScreenerMutation((data) => {
  setLastResult(data);
  if (data.candidates.length > 0) {
    setSelectedTicker(data.candidates[0].ticker, 'screener');
  }
  setIsFormCollapsed(true);
  setForceRefresh(false);  // reset after run
});
```

Pass to `ScreenerForm`:
```tsx
<ScreenerForm
  // ... existing props ...
  forceRefresh={forceRefresh}
  setForceRefresh={setForceRefresh}
/>
```

Also add `forceRefresh` to the `handleRunScreener` `useCallback` dependency array.

- [ ] **Step 6: Write a Vitest test**

In `web-ui/src/components/domain/screener/ScreenerForm.test.tsx`, add:

```typescript
it('renders forceRefresh checkbox unchecked by default', () => {
  const { getByLabelText } = renderWithProviders(
    <ScreenerForm
      selectedUniverse="broad_market_stocks"
      setSelectedUniverse={vi.fn()}
      topN={20}
      setTopN={vi.fn()}
      minPrice={5}
      setMinPrice={vi.fn()}
      maxPrice={500}
      setMaxPrice={vi.fn()}
      currencyFilter="all"
      setCurrencyFilter={vi.fn()}
      exchangeFilter="all"
      setExchangeFilter={vi.fn()}
      instrumentFilter="all"
      setInstrumentFilter={vi.fn()}
      includeOtc={false}
      setIncludeOtc={vi.fn()}
      recommendedOnly={false}
      setRecommendedOnly={vi.fn()}
      requireWeeklyUptrend={false}
      setRequireWeeklyUptrend={vi.fn()}
      actionFilter="all"
      setActionFilter={vi.fn()}
      universes={[]}
      isLoading={false}
      onRun={vi.fn()}
      forceRefresh={false}
      setForceRefresh={vi.fn()}
    />
  );
  const cb = getByLabelText('Force cache refresh') as HTMLInputElement;
  expect(cb.checked).toBe(false);
});

it('shows warning when forceRefresh is true', () => {
  const { getByText } = renderWithProviders(
    <ScreenerForm
      selectedUniverse="broad_market_stocks"
      setSelectedUniverse={vi.fn()}
      topN={20}
      setTopN={vi.fn()}
      minPrice={5}
      setMinPrice={vi.fn()}
      maxPrice={500}
      setMaxPrice={vi.fn()}
      currencyFilter="all"
      setCurrencyFilter={vi.fn()}
      exchangeFilter="all"
      setExchangeFilter={vi.fn()}
      instrumentFilter="all"
      setInstrumentFilter={vi.fn()}
      includeOtc={false}
      setIncludeOtc={vi.fn()}
      recommendedOnly={false}
      setRecommendedOnly={vi.fn()}
      requireWeeklyUptrend={false}
      setRequireWeeklyUptrend={vi.fn()}
      actionFilter="all"
      setActionFilter={vi.fn()}
      universes={[]}
      isLoading={false}
      onRun={vi.fn()}
      forceRefresh={true}
      setForceRefresh={vi.fn()}
    />
  );
  expect(getByText('Slower — re-fetches all market data')).toBeInTheDocument();
});
```

- [ ] **Step 7: Run frontend tests**

```bash
cd web-ui && npx vitest run src/components/domain/screener/ScreenerForm.test.tsx
```

Expected: pass

- [ ] **Step 8: Run typecheck**

```bash
cd web-ui && npm run typecheck
```

Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add web-ui/src/features/screener/types.ts \
        web-ui/src/features/screener/api.ts \
        web-ui/src/components/domain/screener/ScreenerForm.tsx \
        web-ui/src/components/domain/screener/ScreenerForm.test.tsx \
        web-ui/src/components/domain/workspace/ScreenerInboxPanel.tsx \
        web-ui/src/i18n/messages.en.ts
git commit -m "feat: wire forceRefresh option into screener UI"
```

---

## Task 4: Frontend — Cache UI (DataSources page Cache section)

**Files:**
- Modify: `web-ui/src/lib/api.ts` (add cache endpoints)
- Modify: `web-ui/src/lib/queryKeys.ts` (add `cacheStatus`)
- Modify: `web-ui/src/utils/formatters.ts` (add `formatRelativeTime`)
- Create: `web-ui/src/features/datasources/cacheApi.ts`
- Create: `web-ui/src/features/datasources/cacheHooks.ts`
- Create: `web-ui/src/components/domain/datasources/CacheCard.tsx`
- Create: `web-ui/src/components/domain/datasources/CacheSection.tsx`
- Modify: `web-ui/src/pages/DataSources.tsx`
- Modify: `web-ui/src/i18n/messages.en.ts`

**Interfaces:**
- Consumes: Task 2's `GET /api/cache/status` and `POST /api/cache/clear/{id}`
- Produces: `CacheSection` React component rendered at bottom of `DataSources.tsx`

- [ ] **Step 1: Add cache i18n strings**

In `web-ui/src/i18n/messages.en.ts`, inside the `datasources:` object, add a `cache:` key:

```typescript
cache: {
  title: 'Cache',
  clear: 'Clear',
  clearing: 'Clearing…',
  clearsOnRestart: 'Clears on restart',
  neverModified: '—',
  entries: '{{count}} entries',
  storage: {
    disk_json: 'Disk JSON',
    disk_parquet: 'Disk Parquet',
    memory: 'In-Memory',
  },
},
```

- [ ] **Step 2: Add cache API endpoints to `web-ui/src/lib/api.ts`**

Inside `API_ENDPOINTS`, add:

```typescript
cacheStatus: '/api/cache/status',
cacheClear: (id: string) => `/api/cache/clear/${encodeURIComponent(id)}`,
```

- [ ] **Step 3: Add `cacheStatus` query key to `web-ui/src/lib/queryKeys.ts`**

Add inside `queryKeys`:

```typescript
cacheStatus: () => ['cache-status'] as const,
```

- [ ] **Step 4: Add `formatRelativeTime` to `web-ui/src/utils/formatters.ts`**

```typescript
/**
 * Return a human-readable relative time string from an ISO8601 timestamp.
 * e.g. "3h ago", "2 days ago", "just now"
 */
export function formatRelativeTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}
```

- [ ] **Step 5: Create `web-ui/src/features/datasources/cacheApi.ts`**

```typescript
import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';

export interface CacheStatusEntry {
  id: string;
  label: string;
  storage: 'disk_json' | 'disk_parquet' | 'memory';
  ttlDescription: string;
  canClear: boolean;
  lastModifiedAt: string | null;
  entryCount: number | null;
}

interface CacheStatusEntryAPI {
  id: string;
  label: string;
  storage: 'disk_json' | 'disk_parquet' | 'memory';
  ttl_description: string;
  can_clear: boolean;
  last_modified_at: string | null;
  entry_count: number | null;
}

function transformEntry(raw: CacheStatusEntryAPI): CacheStatusEntry {
  return {
    id: raw.id,
    label: raw.label,
    storage: raw.storage,
    ttlDescription: raw.ttl_description,
    canClear: raw.can_clear,
    lastModifiedAt: raw.last_modified_at,
    entryCount: raw.entry_count,
  };
}

export async function fetchCacheStatus(): Promise<CacheStatusEntry[]> {
  const data = await fetchJson<CacheStatusEntryAPI[]>(API_ENDPOINTS.cacheStatus, {
    errorMessage: 'Failed to fetch cache status',
  });
  return (data ?? []).map(transformEntry);
}

export async function clearCache(id: string): Promise<void> {
  await fetchJson<{ cleared: boolean; cache_id: string }>(API_ENDPOINTS.cacheClear(id), {
    method: 'POST',
    errorMessage: `Failed to clear cache ${id}`,
  });
}
```

- [ ] **Step 6: Create `web-ui/src/features/datasources/cacheHooks.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { fetchCacheStatus, clearCache } from './cacheApi';

export function useCacheStatus() {
  return useQuery({
    queryKey: queryKeys.cacheStatus(),
    queryFn: fetchCacheStatus,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useClearCacheMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clearCache(id),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.cacheStatus() });
    },
  });
}
```

- [ ] **Step 7: Create `web-ui/src/components/domain/datasources/CacheCard.tsx`**

```tsx
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatRelativeTime } from '@/utils/formatters';
import type { CacheStatusEntry } from '@/features/datasources/cacheApi';

const STORAGE_CLASS: Record<string, string> = {
  disk_json: 'text-success',
  disk_parquet: 'text-primary',
  memory: 'text-[#A855F7]',
};

interface Props {
  entry: CacheStatusEntry;
  onClear: (id: string) => void;
  clearing: boolean;
}

export default function CacheCard({ entry, onClear, clearing }: Props) {
  const storageLabel = t(
    `datasources.cache.storage.${entry.storage}` as Parameters<typeof t>[0],
  );

  return (
    <div className="rounded-lg border border-border bg-surface p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{entry.label}</span>
        <span className={cn('text-[11px] font-medium', STORAGE_CLASS[entry.storage] ?? 'text-muted')}>
          {storageLabel}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 text-xs text-muted">
        <span>TTL: {entry.ttlDescription}</span>
        <span>
          Last modified:{' '}
          {entry.lastModifiedAt ? formatRelativeTime(entry.lastModifiedAt) : t('datasources.cache.neverModified')}
        </span>
        {entry.entryCount != null && (
          <span>{t('datasources.cache.entries', { count: String(entry.entryCount) })}</span>
        )}
      </div>
      <div>
        {entry.canClear ? (
          <button
            type="button"
            disabled={clearing}
            onClick={() => onClear(entry.id)}
            className="text-xs font-medium text-primary disabled:text-muted disabled:cursor-not-allowed hover:underline"
          >
            {clearing ? t('datasources.cache.clearing') : t('datasources.cache.clear')}
          </button>
        ) : (
          <span className="text-xs text-muted italic">{t('datasources.cache.clearsOnRestart')}</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create `web-ui/src/components/domain/datasources/CacheSection.tsx`**

```tsx
import { useCallback, useState } from 'react';
import { t } from '@/i18n/t';
import CacheCard from './CacheCard';
import { useCacheStatus, useClearCacheMutation } from '@/features/datasources/cacheHooks';

export default function CacheSection() {
  const { data: entries = [] } = useCacheStatus();
  const clearMutation = useClearCacheMutation();
  const [clearingId, setClearingId] = useState<string | null>(null);

  const onClear = useCallback((id: string) => {
    setClearingId(id);
    clearMutation.mutate(id, { onSettled: () => setClearingId(null) });
  }, [clearMutation]);

  return (
    <section>
      <h2 className="text-xs uppercase tracking-wide text-muted mb-2">
        {t('datasources.cache.title')}
      </h2>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-4">
        {entries.map((entry) => (
          <CacheCard
            key={entry.id}
            entry={entry}
            onClear={onClear}
            clearing={clearingId === entry.id}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 9: Add `CacheSection` to `DataSources.tsx`**

In `web-ui/src/pages/DataSources.tsx`, add import:

```tsx
import CacheSection from '@/components/domain/datasources/CacheSection';
```

Add `<CacheSection />` at the bottom of the returned JSX, after `<FallbackFeed .../>`:

```tsx
return (
  <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
    {/* ... existing content ... */}
    <FallbackFeed events={eventsQuery.data ?? []} />
    <CacheSection />
  </div>
);
```

- [ ] **Step 10: Write Vitest tests for CacheCard**

Create `web-ui/src/components/domain/datasources/CacheCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import CacheCard from './CacheCard';
import type { CacheStatusEntry } from '@/features/datasources/cacheApi';

const clearableEntry: CacheStatusEntry = {
  id: 'ticker_meta',
  label: 'Ticker Metadata',
  storage: 'disk_json',
  ttlDescription: '30 days',
  canClear: true,
  lastModifiedAt: null,
  entryCount: 42,
};

const memoryEntry: CacheStatusEntry = {
  id: 'currency_lru',
  label: 'Currency Detect (LRU)',
  storage: 'memory',
  ttlDescription: 'Process lifetime',
  canClear: false,
  lastModifiedAt: null,
  entryCount: null,
};

describe('CacheCard', () => {
  it('renders clear button when canClear is true', () => {
    const { getByText } = renderWithProviders(
      <CacheCard entry={clearableEntry} onClear={vi.fn()} clearing={false} />
    );
    expect(getByText('Clear')).toBeInTheDocument();
  });

  it('renders clearsOnRestart label when canClear is false', () => {
    const { getByText } = renderWithProviders(
      <CacheCard entry={memoryEntry} onClear={vi.fn()} clearing={false} />
    );
    expect(getByText('Clears on restart')).toBeInTheDocument();
  });

  it('disables clear button while clearing', () => {
    const { getByText } = renderWithProviders(
      <CacheCard entry={clearableEntry} onClear={vi.fn()} clearing={true} />
    );
    const btn = getByText('Clearing…') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('calls onClear with entry id when clicked', () => {
    const onClear = vi.fn();
    const { getByText } = renderWithProviders(
      <CacheCard entry={clearableEntry} onClear={onClear} clearing={false} />
    );
    getByText('Clear').click();
    expect(onClear).toHaveBeenCalledWith('ticker_meta');
  });
});
```

- [ ] **Step 11: Run frontend tests**

```bash
cd web-ui && npx vitest run src/components/domain/datasources/CacheCard.test.tsx
```

Expected: pass

- [ ] **Step 12: Run typecheck and full frontend test suite**

```bash
cd web-ui && npm run typecheck && npx vitest run
```

Expected: no type errors, all tests pass

- [ ] **Step 13: Run full backend test suite**

```bash
pytest -q -m "not integration"
```

Expected: all pass

- [ ] **Step 14: Commit**

```bash
git add web-ui/src/lib/api.ts \
        web-ui/src/lib/queryKeys.ts \
        web-ui/src/utils/formatters.ts \
        web-ui/src/features/datasources/cacheApi.ts \
        web-ui/src/features/datasources/cacheHooks.ts \
        web-ui/src/components/domain/datasources/CacheCard.tsx \
        web-ui/src/components/domain/datasources/CacheCard.test.tsx \
        web-ui/src/components/domain/datasources/CacheSection.tsx \
        web-ui/src/pages/DataSources.tsx \
        web-ui/src/i18n/messages.en.ts
git commit -m "feat: add cache management section to DataSources page"
```
