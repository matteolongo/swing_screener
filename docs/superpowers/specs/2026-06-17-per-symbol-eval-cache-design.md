# Per-Symbol Screener Evaluation Cache — Design

Date: 2026-06-17
Branch: `feat/per-symbol-eval-cache`

## Problem

Opening the Today page (and refreshing any page) re-runs heavy screener work even
right after a manual screen. Two distinct causes:

1. **Redundant per-symbol computation.** Every screener run recomputes indicators,
   signals, setup quality, fundamentals and trade-plan primitives for each symbol
   from scratch. The existing per-symbol OHLCV cache
   (`.cache/market_data/by_ticker/`) saves the network download, not the CPU.
2. **Duplicate screen.** `daily_review_service.generate_daily_review` calls a
   *second* full `run_screener` over the universe, independent of the manual run.
   The Today page therefore triggers a whole extra screen.

The raw-data layer already does exactly the "check coverage per symbol, fetch only
the misses, share across mixed universes" behaviour. What is missing is reuse of the
**computed** per-symbol evaluation.

## Goal

Cache screener evaluation **per symbol**, keyed so that:
- a symbol with fresh cached evaluation is skipped (no recompute, no fetch);
- only not-cached symbols are computed;
- **mixed / overlapping universes share** the cache (key is per symbol, never per
  universe);
- the manual screen and the daily-review screen reuse each other's work.

Scope: deterministic features only (no catalyst/intelligence/LLM in the cache yet).
Both A (per-symbol eval cache) and C (daily-review reuse) ship together.

## Cache boundary (the crux)

`compute_hot_score` builds `score` as the **weighted percentile rank** of
`mom_6m / mom_12m / rs_6m` across the input set. So `score`, `rank` and
`confidence` (derived from `score`) are **cross-sectional** — they depend on the
universe peer set. Caching final candidates would produce wrong scores for a
different/mixed universe.

The raw inputs to ranking are **per-symbol and universe-independent** (`mom_*` are
price returns; `rs_*` are relative to the benchmark/sector ETF, not to the universe
peers).

| Cached per symbol (parquet) | Recomputed every run (in-memory pandas) |
|---|---|
| `mom_6m`, `mom_12m`, `rs_6m`, `sector_rs_6m`, `sma20_slope`, `sma50_slope`, `trend_ok`, `dist_sma50_pct`, `dist_sma200_pct`, `weekly_trend`, `atr*`, `atr_pct`, `breakout_level`, `ma*_level`, `consolidation_tightness`, `close_location_in_range`, `volume_ratio`, `avg_daily_volume_eur`, `dist_52w_high_pct`, `near_52w_high`, signal board, setup quality, ticker_info (sector), patterns, fundamentals, earnings proximity, **entry/stop/ATR primitives** | percentile ranks → `score` → `rank` → top-N selection → `confidence` → combined-priority re-rank → regime scaling → **position sizing (`shares`, `position_value`, `realized_risk`)** |

Position sizing depends on account equity and the requested `top`, so it is
recomputed each run to stay fresh; only the price/stop/ATR primitives it needs are
cached.

## Pipeline restructure

Current order in `build_momentum_report`:

```
eligible_universe → top_candidates (rank + truncate to top_n) → signal board / setup quality (only on survivors) → trade plans → confidence
```

New order:

```
eligible_universe (full eligible set)
  → per-symbol feature compute for the FULL eligible set (incl. signal board + setup quality)   ← cacheable unit
  → [eval cache: split hit/miss, compute only misses, persist]
  → cross-sectional stage: rank + score + top-N select + confidence + combined-priority + regime + sizing
```

Cold-run cost: signals/setup are now computed for the whole eligible set rather than
just the post-ranking `top_n`. Accepted — this is the price of reuse, and every
later run reuses it.

## Store

- Parquet per symbol: `.cache/eval/{strategy_sig}/{asof_date}/{SYMBOL}.parquet`.
- Lookup: file exists → **hit**; otherwise **miss**. Over a ticker list this yields a
  hit set and a miss set in one pass.
- Compute only the miss set, write each symbol's parquet, then assemble the full
  feature table (hits + freshly computed) and run the cross-sectional stage.
- Mixed universes share because the key contains the symbol, the as-of date and the
  strategy signature — never the universe id.

## Strategy signature

`strategy_sig` = stable hash of **only the config that affects per-symbol features**:
- signals / indicators config (breakout lookback, pullback MA, min history, …)
- universe filter config (price/ADV/trend eligibility thresholds)
- risk stop parameters (those that set the per-symbol stop/ATR primitives)

Excluded from the signature (do not change per-symbol features): `top_n`, universe
id, display/result filters, account equity. Excluding these maximises cache hits.

## C — daily-review reuse (≈ free once A lands)

`daily_review_service` already routes through `self.screener.run_screener`. Once
`run_screener` reads the eval cache, the daily-review screen hits whatever the manual
screen wrote — same `asof_date`, same `strategy_sig`, overlapping symbols — because
the cache is on disk and process-shared.

The only extra work for C: ensure both entry points resolve to the **same**
`asof_date` and `strategy_sig` so their keys collide. Manual screen and daily-review
must align their as-of resolution and strategy resolution.

## Invalidation & refresh

- **New trading day** → new `{asof_date}` directory; previous day's entries are no
  longer keyed and are pruned.
- **Strategy edit** → new `{strategy_sig}` → automatic miss.
- **Retention**: prune eval parquet files older than **24 hours** (by mtime). Keying
  by `asof_date` guarantees correctness; the 24h prune is disk hygiene. A weekend may
  drop Friday's cache before Monday's new close — acceptable perf miss, never a
  correctness issue.
- **Force refresh** (manual refresh button): **whole-run** bypass — ignore cached
  reads for every symbol in the run, recompute, overwrite. No per-symbol refresh.

## Components

- New `EvalCache` (under `src/swing_screener/data/` or a new `selection/eval_cache.py`)
  with: `split(tickers, asof, strat_sig) -> (hits_df, misses)`, `write(records, …)`,
  `prune(max_age=24h)`. Parquet I/O mirrors the OHLCV provider's atomic-write pattern.
- `screener_service` / `build_momentum_report` restructured to the new order and
  wired to `EvalCache` between per-symbol compute and the cross-sectional stage.
- `strategy_sig` helper computing the hash from the per-symbol-affecting config only.

## Testing

- Per-symbol determinism: same symbol + asof + sig → identical cached record.
- Hit/miss split: overlapping universes recompute only the new symbols.
- Cross-sectional correctness: `score`/`rank`/`confidence` for a symbol differ
  between two universes even though its cached features are identical (proves ranking
  is not cached).
- Force-refresh bypass overwrites.
- Retention prune drops >24h files, keeps fresh ones.
- daily-review after a manual screen produces zero per-symbol recompute for
  overlapping symbols (cache-hit assertion).

## Non-goals

- Catalyst / intelligence / LLM caching (deterministic features only for now).
- Frontend React Query persistence (separate concern; not in this PR).
- Any change to the OHLCV provider cache (already per-symbol and working).
