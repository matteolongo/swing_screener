# Module Architecture

> Status: current.
> Last reviewed: 2026-06-16.

This document is the canonical module layout after the 2026 architecture consolidation.

## Canonical Top-Level Domains

- `src/swing_screener/backtest`
- `src/swing_screener/data`
- `src/swing_screener/execution`
- `src/swing_screener/fundamentals`
- `src/swing_screener/indicators`
- `src/swing_screener/integrations`
- `src/swing_screener/intelligence`
- `src/swing_screener/portfolio`
- `src/swing_screener/recommendation`
- `src/swing_screener/reporting`
- `src/swing_screener/risk`
- `src/swing_screener/selection`
- `src/swing_screener/settings`
- `src/swing_screener/strategy`
- `src/swing_screener/utils`

## Design Rules

1. `strategy` orchestrates strategy modules and report assembly inputs.
2. `selection` owns universe filtering, ranking, and entry signals.
3. `risk` owns risk decisions and recommendations (`risk/recommendations`).
4. `reporting` formats/presents report outputs and does not own strategy registry.
5. `execution` owns order state/workflows.
6. `portfolio` owns position state/metrics.
7. `data` owns provider access and market-data ingestion.
8. `fundamentals` owns fundamental data providers, scoring, and snapshot storage.
9. `intelligence` owns the LLM analysis pipeline, cache, and symbol analyzer.
10. `recommendation` owns the unified decision summary (what-to-do / why) — distinct from
    `risk/recommendations`, which owns the risk-side recommendation engine and trade thesis.
11. `settings` owns settings load/migrate/path resolution.
12. `integrations` owns third-party brokerage integrations (e.g. degiro).
13. `backtest` orchestrates the live signal/stop/exit functions over point-in-time history to measure expectancy; owns no trading logic of its own. Validation harness only, never a parameter optimizer.

## Canonical Import Paths

Use these paths for new code:

- Strategy APIs: `swing_screener.strategy.*`
- Strategy modules: `swing_screener.strategy.modules.*`
- Selection pipeline: `swing_screener.selection.*`
- Recommendations: `swing_screener.risk.recommendations.*`
- Report config: `swing_screener.strategy.report_config.ReportConfig`
- Scalar coercion helpers: `swing_screener.utils.coerce.*` (`is_na_scalar`, `safe_float`, `safe_optional_float`, `safe_optional_int`, `safe_list`)
- Price-history / OHLCV shaping: `swing_screener.data.price_history.*` (`merge_ohlcv`, `to_date_iso`, `last_bar_map`, `price_history_map`, `price_history_change_pct`, `aligned_benchmark_price_history`)

## Screener Pipeline

`ScreenerService.run_screener` (`api/services/screener_service.py`) is a thin orchestrator
that builds a `_RunContext` and calls seven private pipeline steps in order, then constructs
the `ScreenerResponse` from the context:

1. `_resolve_universe_and_window`
2. `_build_signals_and_fetch_ohlcv`
3. `_build_run_configs`
4. `_run_daily_report` (returns `None` when there are no candidates)
5. `_build_candidates`
6. `_apply_same_symbol_filter`
7. `_enrich_and_rank`

Each step reads/writes `_RunContext`; the orchestrator owns response construction. The pure,
side-effect-free helpers it relies on live in core: scalar coercion in
`swing_screener.utils.coerce` and price-history shaping in `swing_screener.data.price_history`.
The candidate decision-context enrichment helpers (fundamentals-snapshot loading, decision-summary
context, recommendation rebuild keyed off the decision action, and decision-priority ranking) live in
`api/services/decision_context.py` — they operate on API models (`ScreenerCandidate`/`Recommendation`)
and call fundamentals storage, the catalyst store and the risk engine, so they stay in the API layer
rather than core. The I/O-coupled `_fetch_ohlcv_chunked` remains in the service.

## Removed Legacy Packages

The following legacy top-level packages were removed and must not be reintroduced:

- `swing_screener.strategies`
- `swing_screener.screeners`
- `swing_screener.signals`
- `swing_screener.recommendations`

Also removed:

- `swing_screener.reporting.config` as a canonical import target.

## Data Source Diagnostics

`src/swing_screener/data/source_health.py` owns the diagnostics contract and the
in-memory fallback ring used by the Data Sources page.

**`DiagnosableSource` Protocol** — a `@runtime_checkable` Protocol a provider
implements to appear in the inventory and get a Test button. Both methods must be
**classmethods** (so unconfigured providers can be described without instantiation):

- `describe() -> SourceDescriptor` — static, credential-free; reports `configured`
  (env var / package present) and `probeable` (has a live canary path).
- `probe(canary: str) -> ProbeResult` — fires a small real request; returns
  `ProbeResult(status="not_configured")` (no exception) when credentials/package
  are absent.

**`FallbackEventRing`** — process-local, bounded (`capacity=200`), thread-safe
`deque`. Call `record_fallback(...)` at any provider fallback site; read via
`recent_events(limit)`. Not persisted — resets on server restart. Surfaced by
`GET /api/datasources/events`.

The single cross-domain enumeration (`id → provider class`) lives in
`api/services/datasources_service.py` (`_PROBEABLE`). There is no central
registry in core; to add or remove a probeable source, update `_PROBEABLE` only.

`intelligence/evidence/` adds one probeable collector registered in `_PROBEABLE`:
- `sec_edgar_catalysts` → `SecEdgarCatalystCollector`

This appears on the Data Sources page with a live Test button. `INTELLIGENCE_SOURCES` is now empty: the inert placeholders (`yahoo_finance`, `earnings_calendar`, `financial_news_rss`), the venue-wide `exchange_announcements` collector, and the `company_ir_rss` IR RSS collector were all dropped. SEC EDGAR is now the sole deterministic evidence source.

## Universe Registry Data Sources

The packaged universe registry (`src/swing_screener/data/universes/registry/`) is
refreshed by source adapters in the `data` domain:

- `data/universe_sources.py` — adapter dispatch (`refresh_snapshot_from_source`); Euronext AEX-family and `wikipedia_index_review` adapters.
- `data/wikipedia_sources.py` — fetch and parse index constituent tables from Wikipedia; normalize tickers to Yahoo symbols.
- `data/instrument_enrichment.py` — resolve a Yahoo symbol to an instrument-master record via yfinance `.info` (MIC, currency, country, timezone, type).

Refreshing an index universe (`refresh_package_universe(..., apply=True)`) writes the
snapshot and appends any newly enriched symbols to
`data/intelligence/instrument_master.json` (append-only; never overwrites
existing records).

## Error Boundary

The application layer (`api/services`), persistence (`api/repositories`), and IO helpers
(`api/utils/file_lock.py`, `api/utils/files.py`) are framework-free: they raise
`swing_screener.errors.DomainError` subclasses, never `fastapi.HTTPException`. A single handler in
`api/main.py` (`register_domain_error_handler`) translates `DomainError.http_status` to the HTTP
response. Enforced by `tests/test_services_no_fastapi.py`.

## API and Frontend Note

This refactor was internal to module structure. API routes and frontend endpoint usage remain unchanged:

- API routes are still under `api/routers/*` and mounted in `api/main.py`.
- Web endpoint constants remain in `web-ui/src/lib/api.ts`.

## Contributor Checklist

Before opening a PR:

1. Confirm no imports use removed legacy paths.
2. Keep new domain logic in canonical modules only.
3. Run `pytest` and ensure architecture import tests pass.
