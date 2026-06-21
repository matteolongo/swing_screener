# Swing Screener API

FastAPI service that exposes the Swing Screener backend as a REST API.

## Run
```bash
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

Docs:
- `http://localhost:8000/docs`
- `http://localhost:8000/openapi.json`

## Data + Concurrency
- Primary persistence: JSON files in `data/` (orders, positions, strategies, config).
- File access is guarded by `api/utils/file_lock.py` to avoid concurrent write races.
- Database module exists but is not wired by default (see `docs/engineering/DATABASE_MIGRATION.md`).

## API Surface (by router)
Health:
- `GET /`
- `GET /health`
- `GET /metrics`

Config (`/api/config`):
- `GET /api/config`
- `PUT /api/config`
- `GET /api/config/defaults`

Strategy (`/api/strategy`):
- `GET /api/strategy`
- `GET /api/strategy/active`
- `POST /api/strategy/active`
- `POST /api/strategy/validate`
- `GET /api/strategy/{strategy_id}`
- `POST /api/strategy`
- `PUT /api/strategy/{strategy_id}`
- `DELETE /api/strategy/{strategy_id}`

Screener (`/api/screener`):
- `POST /api/screener/run` (sync locally, async job launch on dyno by default)
- `GET /api/screener/run/{job_id}` (poll async screener status/result)
- `GET /api/screener/recurrence`

Screener responses label data freshness as `intraday` while a relevant market is still open and `final_close` once the daily bars are final. Intraday responses are previews, not final end-of-day recommendations.

Candle data (screener candidates and watchlist items): `PriceHistoryPoint` now carries optional `open`/`high`/`low`/`volume` alongside `close` (absent fields omitted; backward-compatible). Candidates and watchlist items also expose `patterns` (list of `{bar_index, date, name, direction, key_level, context}`). Screener candidates additionally expose `pattern_stop` / `pattern_stop_reason` — a structural stop derived from a bullish candlestick pattern on the latest bar (advisory; does not affect ranking).

Universes (`/api/universes`):
- `GET /api/universes`
- `GET /api/universes/{universe_id}`
- `POST /api/universes/auto-refresh`
- `POST /api/universes/{universe_id}/refresh`
- `POST /api/universes/{universe_id}/benchmark`

Portfolio (`/api/portfolio`):
- `GET /api/portfolio/positions`
- `GET /api/portfolio/positions/{position_id}`
- `GET /api/portfolio/positions/{position_id}/metrics`
- `PUT /api/portfolio/positions/{position_id}/stop`
- `GET /api/portfolio/positions/{position_id}/stop-suggestion`
- `GET /api/portfolio/positions/{position_id}/stop-preview` (read-only current-price preview; does not persist a stop change)
- `PATCH /api/portfolio/positions/{position_id}/trail-method`
- `POST /api/portfolio/stop-suggestion/compute`
- `POST /api/portfolio/positions/{position_id}/close`
- `POST /api/portfolio/positions/{position_id}/partial-close`
- `GET /api/portfolio/summary`
- `GET /api/portfolio/earnings-proximity/{ticker}`
- `GET /api/portfolio/analytics/regime-breakdown`
- `POST /api/portfolio/orders`
- `GET /api/portfolio/orders/local`
- `POST /api/portfolio/orders/{order_id}/fill`
- `DELETE /api/portfolio/orders/{order_id}`

Daily Review (`/api/daily-review`):
- `GET /api/daily-review`
- `POST /api/daily-review/compute`

Intelligence (`/api/intelligence`):
- `POST /api/intelligence/{ticker}` — enriches the request with full data (fundamentals + Finnhub + earnings, fetched server-side and blocking) before running the analysis. Request body fields stay optional, so this is not a breaking change.
- `GET /api/intelligence/{ticker}/latest`
- `POST /api/intelligence/sweep`

Fundamentals (`/api/fundamentals`):
- `GET /api/fundamentals/config`
- `PUT /api/fundamentals/config`
- `GET /api/fundamentals/snapshot/{symbol}` — `FundamentalSnapshotResponse` now also exposes optional Finnhub signals (`net_margin`, `insider_net_shares_90d`, `insider_transaction_count_90d`, `forward_eps_estimate`, `analyst_upgrade_downgrade_net_30d`).
- `POST /api/fundamentals/refresh`
- `POST /api/fundamentals/compare`
- `POST /api/fundamentals/warmup`
- `GET /api/fundamentals/warmup/{job_id}`

Watchlist (`/api/watchlist`):
- `GET /api/watchlist`
- `PUT /api/watchlist/{ticker}`
- `DELETE /api/watchlist/{ticker}`

Market Data (`/api/market-data`):
- `GET /api/market-data/{ticker}/candles` — returns `price_history` (OHLCV, up to 252 bars) and `patterns` for any ticker. Used as a fallback when the ticker is not present in the last screener result (e.g. open positions, watchlist items).

Calendar:
- `GET /api/calendar/events`

Weekly Reviews (`/api/weekly-reviews`):
- `GET /api/weekly-reviews`
- `GET /api/weekly-reviews/{week_id}`
- `PUT /api/weekly-reviews/{week_id}`

Catalysts (`/api/catalysts`):
- `POST /api/catalysts/manual`
- `POST /api/catalysts/daily-scan`
- `GET /api/catalysts/latest`
- `GET /api/catalysts/symbol/{ticker}`

## Ownership
Routers live in `api/routers/` and call services in `api/services/`.
