# Swing Screener API

## Authentication Boundary

Production uses an OIDC authorization-code flow and a signed, HTTP-only
`swing_session` cookie. Configure `APP_ENV=production`, `AUTH_MODE=oidc`, the
four `OIDC_*` provider values, role claim/value mappings, and a random
`SESSION_SECRET` of at least 32 bytes. Production refuses to start with disabled
or incomplete authentication.

`GET /api/auth/login` begins login, `/api/auth/callback` completes it,
`GET /api/auth/session` bootstraps the UI, and `POST /api/auth/logout` clears the
session. Viewer identities may read business APIs. Unsafe business methods
require an admin identity and the session's `X-CSRF-Token`.

The post-login destination is configured independently from the provider
callback: production keeps the default `OIDC_POST_LOGIN_REDIRECT_URI=/`, while
a direct local OIDC run uses provider callback
`http://localhost:8000/api/auth/callback`, post-login destination
`http://localhost:5173/`, and `SESSION_COOKIE_SECURE=false`. Vite must run on
exactly port 5173. Docker Compose continues to force disabled authentication by
default, so explicitly override it for this local test flow.

Static UI files, auth flow endpoints, and `GET /health/live` are public.
`/api/**`, `/health`, `/health/ready`, `/metrics`, and enabled API docs require a
session. CORS only controls browser interoperability; it is not an access
control boundary.

The single-worker deployment uses a bounded in-memory fixed-window limiter:
120 reads/minute, 60 mutations/minute, 5 expensive analysis requests/minute,
and 2 intelligence sweeps/minute by default. Sweeps also reject more than
`INTELLIGENCE_SWEEP_MAX_SYMBOLS` items before analyzer/provider work. A
multi-worker deployment requires a shared limiter before increasing
`WEB_CONCURRENCY`.

## Entry Approval Tokens

Actionable screener candidates carry a short-lived HMAC approval token. Entry
orders must return that opaque token; the API verifies its ticker, active
strategy, signed decision gates, freshness, currency, FX, target source, and
earnings context, then recomputes quantity, price, reward/risk, trade risk,
position cap, cash, heat, and fees from the submitted order. Country
concentration is a risk-share warning and does not block an otherwise valid
trade. Configure a separate 32-byte `ORDER_APPROVAL_SIGNING_KEY` in production;
rotation invalidates outstanding tokens.

FastAPI service that exposes the Swing Screener backend as a REST API.

## Run
```bash
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

Docs:
- `http://localhost:8000/docs`
- `http://localhost:8000/openapi.json`

## Data + Concurrency
- Orders, positions, and idempotency records use one SQL database. Development
  defaults to `sqlite:///data/swing_screener.db`; production requires
  `DATABASE_URL` and is expected to use PostgreSQL.
- Each portfolio request owns one SQLAlchemy unit of work. SQLite writes begin
  with `BEGIN IMMEDIATE`; PostgreSQL lifecycle reads use row locks. Order fill
  and position mutation commit or roll back together.
- `data/orders.json` and `data/positions.json` are import-only legacy sources.
  They are validated and imported once into an empty schema, recorded with row
  counts and SHA-256 checksums, and are never changed or dual-written. A
  migration-created singleton lock serializes import classification and writes
  across application instances, so concurrent startup returns the committed
  import report instead of attempting a second import. Signed legacy broker fee
  debits are canonicalized to positive fee amounts during import; the source
  JSON remains unchanged.
- Order create/fill and every persisted position write require `Idempotency-Key`.
  Replaying the same request returns its stored response; reusing a key for
  different input returns `409`. Stop-price market-data validation runs before
  the idempotent write transaction, then the persisted update is rechecked and
  reserved atomically.
- `DATABASE_URL` accepts `postgres://` and `postgresql://`; both are normalized
  to SQLAlchemy's `postgresql+psycopg://` dialect URL.

## Database Operations

Before the first deployment, back up both the target database and the two
legacy JSON files. For PostgreSQL, use a provider snapshot or:

```bash
pg_dump "$DATABASE_URL" --format=custom --file swing-screener-before-import.dump
cp data/orders.json data/orders.before-sql.json
cp data/positions.json data/positions.before-sql.json
```

For SQLite, stop application writers and use `sqlite3`'s online backup command:

```bash
sqlite3 data/swing_screener.db ".backup data/swing_screener.before-import.db"
```

Apply the schema, inspect the empty import state, and execute the same importer
used at application startup:

```bash
alembic upgrade head
python scripts/migrate_json_to_sqlite.py --dry-run
python scripts/migrate_json_to_sqlite.py
```

The execute command prints imported order and position counts. Verify those
counts against the JSON documents and verify `/health/ready` reports
`connectivity=ok`, `migration=ok`, and `legacy_import=complete`. Startup refuses
to serve when the schema is stale or the import ledger is incomplete.

`/health` and `/health/ready` also check that the frozen legacy JSON files and
their parent directory remain readable and writable. `/health/live` remains a
dependency-free process liveness check. If readiness reports a partial import state, stop the application. Restore the
database backup, confirm that all portfolio and import-ledger tables reflect the
same point in time, rerun `alembic upgrade head`, and retry the importer. Do not
manually add a ledger row to populated tables. Returning to a release that
writes JSON is an explicit operator rollback decision: restore the frozen JSON
backup first and ensure no SQL-only fills or position changes would be lost.

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
- `POST /api/screener/run` (sync locally, async job launch on dyno by default). Accepts `taxonomy_filter` (region / market_cap_tier / sector / index_memberships / **instrument_type** (coarse equity/etf) / instrument_type_detail / provider / currency / exchange_mics / liquidity_tier) and `preset` to pre-filter the unified symbol pool. Filtering on enrichment-derived dimensions (sector / market_cap_tier / instrument_type_detail / liquidity_tier) excludes symbols whose data is not yet enriched and surfaces a warning counting them. The `universe` field is **deprecated** — it now resolves to `taxonomy_filter.index_memberships=[universe]` and will be removed in a later release.
- `GET /api/screener/run/{job_id}` (poll async screener status/result)
- `GET /api/screener/recurrence`

Each candidate recommendation exposes additive `workflow_status` and
`next_step` fields. `workflow_status` is one of `ready`, `waiting_trigger`,
`needs_review`, or `no_setup`. `next_step.code` is stable and always one of
`review_order`, `wait_pullback`, `wait_breakout_close`, `define_target`,
`refresh_data`, `fix_stop`, `inspect_gate_conflict`, or `observe`. For
pullback/breakout waits, `next_step` also contains `trigger_price` plus
`currency`. These fields are the canonical execution-workflow authority.
`decision_summary.action` remains an analytical compatibility field and must
not be used to authorize order review.

Symbol pool (`/api/pool`):
- `GET /api/pool/symbols` — browse the unified pool with taxonomy query params (`region`, `market_cap_tier`, `sector`, `index_memberships`, `instrument_type_detail`, `provider`, `currency`, `exchange_mics`, `liquidity_tier`), paginated (`page`, `page_size`). Returns `{symbols, total, page, page_size}`.
- `GET /api/pool/review-queue` — symbols flagged after repeated OHLCV fetch failures. Returns `{entries}`.
- `POST /api/pool/review-queue/{symbol}/remove` — clear the symbol's review-queue entry. Returns `{removed: bool}`. (Clears the queue entry only; the symbol re-enters screening on the next run unless it fails again. Hard removal from `symbol_pool.json` is deferred with the pool-edit work.)
- `POST /api/pool/review-queue/{symbol}/restore` — reset the symbol's failure counter and return it to the active pool. Returns `{restored: bool}`.
- `GET /api/pool/presets` — list taxonomy presets from `config/taxonomy_presets.yaml`. Returns `{presets: [{id, label, filter}]}`.
- `POST /api/pool/rebuild` — re-merge the universe snapshots + instrument master into `symbol_pool.json` (the runtime equivalent of the base-build runbook in `data/README.md`). Structural fields (`index_memberships`, `exchange_mic`, `currency`, `region`, `instrument_type`, providers) are recomputed; yfinance enrichment is carried over for surviving symbols. The diff is computed before the file is written. Returns `{applied, additions, removals, modifications, summary}` where additions/removals are full symbol snapshots and modifications are `[{symbol, changes: [{field, before, after}]}]` (list fields compared order-insensitively). Returns `409` if another pool operation (rebuild/enrich) is already running.
- `POST /api/pool/enrich` — launch a best-effort yfinance enrichment job over the current pool (`sector`, `market_cap_tier`, `liquidity_tier`, `instrument_type_detail`). Runs in a background thread; returns `{job_id}` immediately. Returns `409` if another pool operation is already running (pool writes are serialized). Jobs are disk-persisted under `data/pool/enrich_jobs/` and trimmed to the most recent 16.
- `GET /api/pool/enrich/{job_id}` — poll enrichment status. Returns `{status: running|done|failed, progress: {processed, total, failed}, error, diff}`. `diff` is `{modified: [{symbol, changes}], failed_symbols}` and is populated only when `status == done`. A job interrupted by an API restart is recovered as `failed` (not 404); unknown job id → 404.

Screener responses label data freshness as `intraday` while a relevant market is still open and `final_close` once the daily bars are final. Intraday responses are previews, not final end-of-day recommendations.

Candle data (screener candidates and watchlist items): `PriceHistoryPoint` now carries optional `open`/`high`/`low`/`volume` alongside `close` (absent fields omitted; backward-compatible). Candidates and watchlist items also expose `patterns` (list of `{bar_index, date, name, direction, key_level, context, volume_ratio, bar_pressure, volume_confirmed}`). The last three are optional volume-pressure annotations: `volume_ratio` (bar volume ÷ trailing 20-bar average), `bar_pressure` (intrabar close-location 0–1), and `volume_confirmed` (true when the pattern fired on elevated, direction-aligned volume; null for neutral patterns or when volume data is insufficient). Screener candidates additionally expose `pattern_stop` / `pattern_stop_reason` — a structural stop derived from a bullish candlestick pattern on the latest bar. When present it becomes the candidate's entry `stop` (and `target`/`rr`/`risk_usd` are recomputed from it; `shares` unchanged); it does not affect ranking.

Backtest (`/api/backtest`):
- `POST /api/backtest/event-study` (sync locally, async job launch on dyno by default) — replay the live signal/stop/exit path over history for the requested tickers and return per-trade R outcomes plus an R-distribution summary. The baseline config is built from the **active strategy** (its `signals`/`risk`/`manage` blocks), so results mirror live behaviour; `pattern_stop_enabled` is a global execution flag (not per-strategy). Optional `config` overrides (e.g. `pattern_stop_enabled`, `breakeven_at_r`, `k_atr`) layer on top to test a variant; an A/B is two requests differing in one field. Defaults to today's-snapshot data from `2022-01-01`. Event study only (no portfolio/equity curve), zero-cost fills; see `src/swing_screener/backtest/README.md` for scope and known limitations.
- `GET /api/backtest/event-study/{job_id}` (poll async backtest status/result)

Universes (`/api/universes`):
- `GET /api/universes`
- `GET /api/universes/{universe_id}`
- `POST /api/universes/auto-refresh`
- `POST /api/universes/refresh-all` — refresh every **registry** universe snapshot from its source (`apply=true` for each), aggregating per-universe diffs. Auto universes are skipped (they refresh via their own discovery path) and counted in `skipped_auto`. Per-universe failures are surfaced inline (`{id, error}`), never as a 500. Returns `{universes: [{id, applied, changed, current_member_count, proposed_member_count, additions, removals}], total_additions, total_removals, total_changed, skipped_auto}`.
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
- `GET /api/daily-review` — accepts `preset` and `taxonomy_filter` (JSON-encoded `TaxonomyFilter`) for the legacy combined review. Pass `include_candidates=false` for a portfolio/watchlist-only review that does not run the screener.
- `POST /api/daily-review/compute` — supports the same `include_candidates` switch for local-persistence mode.

Intelligence (`/api/intelligence`):
- `POST /api/intelligence/{ticker}/evidence/refresh` — read-only refresh of configured intelligence evidence collectors. It does not call the LLM, generate/cache `SymbolIntelligence`, or mutate positions, orders, or trading state. Returns `{ticker, refreshed_at, status, sources}` where overall `status` is `fresh`, `partial`, or `failed`; each source includes `source`, provider id, `status` (`fresh` or `failed`), `item_count`, `as_of`, and a nullable sanitized `message`. Invalid tickers return 422. Provider exceptions and secrets are never returned.
- `POST /api/intelligence/{ticker}?force=false` — enriches with full data (fundamentals + Finnhub + earnings + SEC evidence, server-side blocking) then runs the two-call LLM analysis. Same-day cache is returned unless `force=true`. Responses carry nullable `pre_open_outlook` (US pre-market) and `thesis_delta` (when prior analyses exist), plus a `news` list (`{headline, url, date, sentiment}`, additive; defaults to `[]` for pre-existing cached results). Responses also expose additive `classified_catalysts` (typed, already-happened cited catalysts), nullable `evidence_ledger` (advisory bull/bear evidence balance; never changes `action` or `conviction`), and `inputs_used.enrichment_diagnostics`. Each diagnostic has `source`, `status` (`used`, `missing`, or `failed`), nullable `as_of`, nullable `item_count`, and a nullable sanitized `message`; raw provider exceptions, payloads, and credential-bearing URLs are never returned. Older cached results may omit the diagnostics field. Returns 503 when `llm.analyzer_enabled: false` or `OPENAI_API_KEY` is unset.
- `GET /api/intelligence/{ticker}/latest`
- `GET /api/intelligence/{ticker}/history` — per-symbol analysis history, newest-first, capped at `analysis_history.max_entries`. Returns `{entries: HistoryEntry[]}`; empty list (not 404) when none. History predictions may include an optional advisory `outcome` (`confirmed`, `contradicted`, `unresolved`) derived from later `thesis_delta.what_played_out` text.
- `GET /api/intelligence/{ticker}/chat` — returns the persisted follow-up chat for today's cached analysis. Returns 409 when no cached analysis exists.
- `POST /api/intelligence/{ticker}/chat` — asks an advisory follow-up question about today's cached analysis. Request body: `{message, refresh_sources, analysis_generated_at?, candidate?, position?}`. When `refresh_sources=true`, the endpoint refreshes only app-configured intelligence evidence collectors and returns `evidence_used` on the assistant message.
- `GET /api/intelligence/runs/{run_id}` — return a single persisted agent-run trace (404 on miss).
- `GET /api/intelligence/{ticker}/runs` — per-symbol run-trace index (newest-first, capped).
- `POST /api/intelligence/position-review/{position_id}` — manual advisory review for an open position. Returns structured move explanation, thesis status, profit-protection guidance, stop advice, macro/geopolitical overlay, and evidence used. Does not mutate positions or orders. Request body: `{refresh_sources}`.
- `POST /api/intelligence/{ticker}/position-review` — manual advisory symbol review for a non-held or ad-hoc ticker. Reads the latest cached analysis across sweep dates (not just today's), then frames the result as an entry candidate: `suggested_action` (`ENTER` / `WATCH` / `AVOID`) and `thesis_status` derive from the cached analysis, and the response carries an `entry_plan` (stance, what confirms / invalidates entry) instead of the position-only `profit_protection` / `stop_advice`, which are `null` in this mode. Returns 409 when no cached analysis or refreshed evidence exists. Request body: `{refresh_sources}`.
- `POST /api/intelligence/strategic-review` — manual app-context-only strategic overlay for a symbol. Request body: `{ticker, topic?, refresh_sources, risk_mode, horizon_days}`. Uses cached `SymbolIntelligence` and, only when `refresh_sources=true`, refreshed configured app evidence collectors. Returns strategic situations, affected symbols, predictions, invalidation, and advisory review actions; it never creates trade execution actions.
- `POST /api/intelligence/sweep` — same full enrich + two-call analysis as the single-symbol endpoint, applied to each symbol in the request. No batch cap; cost scales linearly. Per-symbol cache-before-spend applies unless `force=true` per symbol. Returns 503 on the same kill-switch conditions.
- `POST /api/intelligence/position/{position_id}?force=false` — position-aware LLM analysis for an open position. Enriches with the same fundamentals and technicals a screener candidate gets, so the model has real data to manage the position. Returns cached result unless `force=true`. Returns 404 if position not found.

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
- `GET /api/market-data/{ticker}/volume-analysis` — read-only advisory volume-zone analysis for one symbol. Query params: `interval` (default `1d`), `lookback` (default `120`), and `min_rr` (default `2.0`). Uses the configured market-data provider's OHLCV bars only, returns an approximate bar-based profile warning, and does not affect screener ranking, sizing, positions, or orders.

Calendar:
- `GET /api/calendar/events`

Weekly Reviews (`/api/weekly-reviews`):
- `GET /api/weekly-reviews`
- `GET /api/weekly-reviews/{week_id}`
- `PUT /api/weekly-reviews/{week_id}`

Cache Management (`/api/cache`):
- `GET /api/cache/status` — list all caches with storage type, TTL, last modified, and entry count
- `POST /api/cache/clear/{cache_id}` — clear a named cache. Returns 400 for unknown or non-clearable (memory) caches

Data Sources (`/api/datasources`) — read-only diagnostics, no config mutation:
- `GET /api/datasources` — inventory of all known sources. Response: `{sources: [SourceDescriptorOut, ...]}`. Each `SourceDescriptorOut` has `id`, `display_name`, `domain`, `role` (`primary`/`fallback`/`enrichment`), `requires` (env var or pkg name; null if unconditional), `configured` (bool), `probeable` (bool), `canary_market` (`us`/`eu`/null), `note` (null or a free-text annotation), and `last_probe` (null or `ProbeResultOut` from the most recent probe run). One intelligence collector (`sec_edgar_catalysts`) appears with `probeable=true`. The enrichment pipeline injects curated SEC filings into the LLM prompt via `collect.py` (no new endpoint).
- `POST /api/datasources/probe` — probe all probeable sources concurrently. Response: `[ProbeResultOut, ...]`. `ProbeResultOut` has `id`, `status` (`ok`/`down`/`not_configured`), `latency_ms`, `detail`, `sample` (small dict of live data), `error`.
- `POST /api/datasources/{source_id}/probe` — probe one source by id. Response: `ProbeResultOut` (same shape). Returns `not_configured` status (no exception) for unknown or non-probeable ids.
- `GET /api/datasources/events?limit=N` — most recent fallback/stale-cache events recorded at runtime (default 100, max 200). Response: `{events: [FallbackEventOut, ...]}`. Each `FallbackEventOut` has `ts` (ISO-8601 UTC), `domain`, `from_provider`, `reason`, `fell_back_to` (null or id), `tickers` (list), `stale_asof` (null or date string). Events are in-memory only (not persisted; reset on server restart).

## Ownership
Routers live in `api/routers/` and call services in `api/services/`.
