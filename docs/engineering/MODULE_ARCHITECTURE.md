# Module Architecture

> Status: current.
> Last reviewed: 2026-02-24.

This document is the canonical module layout after the 2026 architecture consolidation.

## Canonical Top-Level Domains

- `src/swing_screener/data`
- `src/swing_screener/execution`
- `src/swing_screener/indicators`
- `src/swing_screener/intelligence`
- `src/swing_screener/portfolio`
- `src/swing_screener/reporting`
- `src/swing_screener/risk`
- `src/swing_screener/selection`
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

## Canonical Import Paths

Use these paths for new code:

- Strategy APIs: `swing_screener.strategy.*`
- Strategy modules: `swing_screener.strategy.modules.*`
- Selection pipeline: `swing_screener.selection.*`
- Recommendations: `swing_screener.risk.recommendations.*`
- Report config: `swing_screener.strategy.report_config.ReportConfig`

## Removed Legacy Packages

The following legacy top-level packages were removed and must not be reintroduced:

- `swing_screener.strategies`
- `swing_screener.screeners`
- `swing_screener.signals`
- `swing_screener.recommendations`

Also removed:

- `swing_screener.reporting.config` as a canonical import target.

## Universe Registry Data Sources

The packaged universe registry (`src/swing_screener/data/universes/registry/`) is
refreshed by source adapters in the `data` domain:

- `data/universe_sources.py` — adapter dispatch (`refresh_snapshot_from_source`); Euronext AEX-family and `wikipedia_index_review` adapters.
- `data/wikipedia_sources.py` — fetch and parse index constituent tables from Wikipedia; normalize tickers to Yahoo symbols.
- `data/instrument_enrichment.py` — resolve a Yahoo symbol to an instrument-master record via yfinance `.info` (MIC, currency, country, timezone, type).

Refreshing an index universe (`refresh_package_universe(..., apply=True)`, or
`python -m swing_screener.cli universes refresh --name <id> --apply`) writes the
snapshot and appends any newly enriched symbols to
`data/intelligence/instrument_master.json` (append-only; never overwrites
existing records).

## API and Frontend Note

This refactor was internal to module structure. API routes and frontend endpoint usage remain unchanged:

- API routes are still under `api/routers/*` and mounted in `api/main.py`.
- Web endpoint constants remain in `web-ui/src/lib/api.ts`.

## Contributor Checklist

Before opening a PR:

1. Confirm no imports use removed legacy paths.
2. Keep new domain logic in canonical modules only.
3. Run `pytest` and ensure architecture import tests pass.
