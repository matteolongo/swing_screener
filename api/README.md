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

Candle data (screener candidates and watchlist items): `PriceHistoryPoint` now carries optional `open`/`high`/`low`/`volume` alongside `close` (absent fields omitted; backward-compatible). Candidates and watchlist items also expose `patterns` (list of `{bar_index, date, name, direction, key_level, context}`). Screener candidates additionally expose `pattern_stop` / `pattern_stop_reason` — a structural stop derived from a bullish candlestick pattern on the latest bar. When present it becomes the candidate's entry `stop` (and `target`/`rr`/`risk_usd` are recomputed from it; `shares` unchanged); it does not affect ranking.

Backtest (`/api/backtest`):
- `POST /api/backtest/event-study` (sync locally, async job launch on dyno by default) — replay the live signal/stop/exit path over history for the requested tickers and return per-trade R outcomes plus an R-distribution summary. The baseline config is built from the **active strategy** (its `signals`/`risk`/`manage` blocks), so results mirror live behaviour; `pattern_stop_enabled` is a global execution flag (not per-strategy). Optional `config` overrides (e.g. `pattern_stop_enabled`, `breakeven_at_r`, `k_atr`) layer on top to test a variant; an A/B is two requests differing in one field. Defaults to today's-snapshot data from `2022-01-01`. Event study only (no portfolio/equity curve), zero-cost fills; see `src/swing_screener/backtest/README.md` for scope and known limitations.
- `GET /api/backtest/event-study/{job_id}` (poll async backtest status/result)

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
- `POST /api/intelligence/{ticker}?force=false` — enriches with full data (fundamentals + Finnhub + earnings + SEC evidence, server-side blocking) then runs the two-call LLM analysis. Same-day cache is returned unless `force=true`. Responses carry nullable `pre_open_outlook` (US pre-market) and `thesis_delta` (when prior analyses exist), plus a `news` list (`{headline, url, date, sentiment}`, additive; defaults to `[]` for pre-existing cached results). Returns 503 when `llm.analyzer_enabled: false` or `OPENAI_API_KEY` is unset.
- `GET /api/intelligence/{ticker}/latest`
- `GET /api/intelligence/{ticker}/history` — per-symbol analysis history, newest-first, capped at `analysis_history.max_entries`. Returns `{entries: HistoryEntry[]}`; empty list (not 404) when none.
- `POST /api/intelligence/sweep` — same full enrich + two-call analysis as the single-symbol endpoint, applied to each symbol in the request. No batch cap; cost scales linearly. Per-symbol cache-before-spend applies unless `force=true` per symbol. Returns 503 on the same kill-switch conditions.

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

Data Sources (`/api/datasources`) — read-only diagnostics, no config mutation:
- `GET /api/datasources` — inventory of all known sources. Response: `{sources: [SourceDescriptorOut, ...]}`. Each `SourceDescriptorOut` has `id`, `display_name`, `domain`, `role` (`primary`/`fallback`/`enrichment`), `requires` (env var or pkg name; null if unconditional), `configured` (bool), `probeable` (bool), `canary_market` (`us`/`eu`/null), `note` (null or a free-text annotation), and `last_probe` (null or `ProbeResultOut` from the most recent probe run). One intelligence collector (`sec_edgar_catalysts`) appears with `probeable=true`. The enrichment pipeline injects curated SEC filings into the LLM prompt via `collect.py` (no new endpoint).
- `POST /api/datasources/probe` — probe all probeable sources concurrently. Response: `[ProbeResultOut, ...]`. `ProbeResultOut` has `id`, `status` (`ok`/`down`/`not_configured`), `latency_ms`, `detail`, `sample` (small dict of live data), `error`.
- `POST /api/datasources/{source_id}/probe` — probe one source by id. Response: `ProbeResultOut` (same shape). Returns `not_configured` status (no exception) for unknown or non-probeable ids.
- `GET /api/datasources/events?limit=N` — most recent fallback/stale-cache events recorded at runtime (default 100, max 200). Response: `{events: [FallbackEventOut, ...]}`. Each `FallbackEventOut` has `ts` (ISO-8601 UTC), `domain`, `from_provider`, `reason`, `fell_back_to` (null or id), `tickers` (list), `stale_asof` (null or date string). Events are in-memory only (not persisted; reset on server restart).

## Ownership
Routers live in `api/routers/` and call services in `api/services/`.
