# Data Module Optimization Guide

## Responsibility
Provide universe selection, market data retrieval, provider abstraction, and ticker metadata/currency helpers.

## Optimization Instructions
1. Consolidate OHLCV cleanup and column standardization logic into a single shared function used by both `market_data.py` and provider implementations.
2. Make `fetch_ohlcv` a thin orchestrator and keep provider-specific caching/retry logic inside providers.
3. Replace per-symbol metadata fetches with batched retrieval where possible, and avoid rewriting the full cache file when only a subset changes.
4. In sequential download fallback paths, collect frames first and `concat` once at the end.

## Simplification Instructions
1. Separate responsibilities clearly: orchestration in `market_data.py`, transport/caching in `providers/*`, enrichment in `ticker_info.py`.
2. Remove duplicated error-handling branches by using common helper utilities for retry/backoff and logging.

## Per-Symbol Evaluation Cache

Per-symbol screener evaluation is cached on top of the existing per-symbol OHLCV cache (`.cache/market_data/by_ticker/`). Eval parquets live under `.cache/eval/{strategy_sig}/{asof_date}/`. On a re-run over an overlapping universe, OHLCV data is served from the OHLCV cache and per-symbol features (momentum/RS, signals, setup quality, ATR/stop primitives, eligibility) are served from the eval_cache — only new symbols require full computation. The daily-review workflow reuses eval parquets already written by a prior manual screen on the same day, so overlapping symbols are not recomputed twice.

## Definition of Done
- One canonical OHLCV normalization path exists.
- Metadata/cache writes are incremental and measurable.
- Data fetch code paths are easier to trace and covered by tests.
