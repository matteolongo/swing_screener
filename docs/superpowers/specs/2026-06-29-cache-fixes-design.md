# Cache Fixes — Design Spec

**Date:** 2026-06-29  
**Branch base:** `fix/position-analysis-stale-close`  
**Scope:** Fix TTL gaps in two disk caches, expose `forceRefresh` on Screener UI, add `/cache` API router, extend DataSources page with a Cache section.

---

## Problem Summary

Cache audit identified three classes of gap:

| Gap | Impact |
|---|---|
| `ticker_meta.json` has no TTL | Stale exchange/currency/sector metadata persists indefinitely |
| Polygon OHLCV cache uses exact key match with no mtime check | Historical Polygon candles never expire |
| `ScreenerRequest.force_refresh` exists in Python model but absent from TS type and UI | No user path to bypass screener eval + OHLCV caches without restarting the server |

In addition: no UI visibility into cache state for any disk cache except fundamentals and intelligence sweep.

---

## Approach: Systematic (B)

Fix the TTL gaps, wire the Screener UI, add a thin `/cache` API, extend the DataSources page.

---

## Backend: TTL Fixes

### Ticker Metadata (`src/swing_screener/data/market_data.py`)

- Add `fetched_at` (unix timestamp) to every entry written to `.cache/ticker_meta.json`.
- On read, check `time.time() - entry["fetched_at"]` against `ticker_meta_ttl_days * 86400`. If stale, treat as cache miss and re-fetch.
- New config key: `cache.ticker_meta_ttl_days` (default: `30`), added to `config/defaults.yaml` under a new `cache:` block.

### Polygon OHLCV (`src/swing_screener/data/providers/polygon_provider.py`)

- On cache hit (file exists for key), also check `os.path.getmtime(path)` against `polygon_cache_ttl_days * 86400`.
- **Exception:** if `end` date is strictly before today (historical range), skip the mtime check — historical OHLCV is final.
- New config key: `cache.polygon_cache_ttl_days` (default: `7`).

### `config/defaults.yaml`

Add new top-level section:

```yaml
cache:
  ticker_meta_ttl_days: 30
  polygon_cache_ttl_days: 7
  # same_day_cache_ttl_minutes already exists under data_provider
```

---

## Backend: `/cache` API Router

### New files

- `api/routers/cache.py` — route definitions
- `api/services/cache_service.py` — status introspection + clear logic
- `api/models/cache.py` — Pydantic models

### Endpoints

**`GET /cache/status`**

Returns `list[CacheStatusEntry]`. No heavy I/O: reads file mtimes and JSON key counts only.

```python
class CacheStatusEntry(BaseModel):
    id: str
    label: str
    storage: Literal["disk_json", "disk_parquet", "memory"]
    ttl_description: str          # human string, e.g. "30 days"
    can_clear: bool
    last_modified_at: str | None  # ISO8601 of newest mtime in cache path
    entry_count: int | None       # JSON: top-level key count; parquet: file count
```

**`POST /cache/clear/{cache_id}`**

Deletes or empties the named cache. Returns `{ "cleared": true, "cache_id": str }`.

- `disk_json` caches: overwrite file with `{}`.
- `disk_parquet` caches: delete all `.parquet` files in the cache directory (but not subdirectories that also store non-cache data).
- In-memory caches: not exposed — no `can_clear` on those entries.

### Cache IDs exposed

| id | label | can_clear |
|---|---|---|
| `ticker_meta` | Ticker Metadata | true |
| `ticker_info` | Ticker Info | true |
| `ohlcv_yfinance` | OHLCV yfinance | true |
| `ohlcv_polygon` | OHLCV Polygon | true |
| `screener_eval` | Screener Eval | true |
| `earnings_proximity` | Earnings Proximity | true |
| `intelligence_evidence` | Intelligence Evidence | true |
| `currency_lru` | Currency Detect (LRU) | false |
| `instrument_master` | Instrument Master (LRU) | false |
| `market_hours` | Market Hours (LRU) | false |
| `yaml_settings` | YAML Settings | false |

### Router registration

Mount in `api/main.py`:

```python
from api.routers import cache as cache_router
app.include_router(cache_router.router, prefix="/cache", tags=["cache"])
```

---

## Frontend: Screener `forceRefresh`

### Type change (`web-ui/src/features/screener/types.ts`)

```typescript
export interface ScreenerRequest {
  // ... existing fields ...
  forceRefresh?: boolean;   // add this
}
```

### API transform (`web-ui/src/features/screener/api.ts`)

The `runScreener` function already POSTs the request body. The camelCase→snake_case transform must include `forceRefresh → force_refresh`. If `runScreener` uses a generic serialiser, verify `force_refresh` reaches the backend. If not, add an explicit mapping.

### UI

In the Screener run trigger (wherever the run button lives), add:

- A checkbox: **"Force cache refresh"**, unchecked by default.
- When checked: sets `forceRefresh: true` on the request.
- A warning chip next to the checkbox: *"Slower — re-fetches all market data."*

Effect when `true`: bypasses both the screener eval cache and the OHLCV same-day cache. Historical parquet is still used.

---

## Frontend: DataSources Cache Section

### New files

- `web-ui/src/features/datasources/api/cache.ts` — `fetchCacheStatus()` and `clearCache(id)` API calls
- `web-ui/src/features/datasources/hooks/useCache.ts` — `useCacheStatus()` and `useClearCacheMutation()`
- `web-ui/src/features/datasources/components/CacheSection.tsx` — renders the section
- `web-ui/src/features/datasources/components/CacheCard.tsx` — individual card

### Query config

- `useCacheStatus` stale time: **30s** (same as datasource probe queries)
- `useClearCacheMutation` on success: invalidate `cacheStatus` query key

### Cache card layout

Each card shows:
- Cache name (label)
- Storage type chip — colors matching existing system (`disk_json`: green, `disk_parquet`: blue, `memory`: purple)
- Configured TTL (static string from `ttl_description`)
- Last modified: relative time from `last_modified_at` (e.g. "3h ago"), or "—"
- Entry count (if not null)
- **Clear** button — only when `can_clear: true`. Triggers `POST /cache/clear/{id}`, shows spinner, invalidates status on settle.

In-memory cards render without a Clear button; show a muted label "Clears on restart".

### Integration

`CacheSection` is added to the existing DataSources page below the provider health section, under a "Cache" subheading.

---

## Files Changed

**Backend**
- `src/swing_screener/data/market_data.py` — add TTL to `fetch_ticker_metadata`
- `src/swing_screener/data/providers/polygon_provider.py` — add mtime check on cache hit
- `config/defaults.yaml` — new `cache:` block
- `api/routers/cache.py` — new
- `api/services/cache_service.py` — new
- `api/models/cache.py` — new
- `api/main.py` — register cache router
- `api/README.md` — document new `/cache` endpoints

**Frontend**
- `web-ui/src/features/screener/types.ts` — add `forceRefresh?`
- `web-ui/src/features/screener/api.ts` — ensure camelCase→snake_case for `forceRefresh`
- Screener run UI component — add checkbox + warning chip
- `web-ui/src/features/datasources/api/cache.ts` — new
- `web-ui/src/features/datasources/hooks/useCache.ts` — new
- `web-ui/src/features/datasources/components/CacheSection.tsx` — new
- `web-ui/src/features/datasources/components/CacheCard.tsx` — new
- DataSources page component — render `<CacheSection />`

---

## Testing

**Backend**
- Unit test for `fetch_ticker_metadata`: assert stale entry (> TTL) is re-fetched; fresh entry is not.
- Unit test for Polygon OHLCV: assert mtime-expired recent range is re-fetched; historical range is not.
- Unit test for `GET /cache/status`: assert response schema, `last_modified_at` is valid ISO8601 or null.
- Unit test for `POST /cache/clear/ticker_meta`: assert file is overwritten to `{}`.

**Frontend**
- `CacheCard` renders Clear button when `can_clear: true`, not when `false`.
- `CacheCard` shows "Clears on restart" label for in-memory entries.
- Screener run sends `force_refresh: true` when checkbox checked.

---

## Open Questions

None — all resolved in design review.
