# Scalable Universe Automation Proposal

> Status: proposal.  
> Last reviewed: 2026-06-16.

## Problem

Changing the screener universe manually before every run does not scale: the user must know which market, index, sector, liquidity profile, and currency set is relevant before the system has collected the basic facts needed to make that choice.

The screener already accepts either a named `universe` or an explicit `tickers` list, and the web API already exposes universe-management endpoints for listing, discovering, refreshing, and benchmarking universes. The scalable solution should therefore automate universe creation and maintenance upstream, while keeping the screener deterministic and focused on ranking tradable candidates.

## Proposed solution: an auto-curated universe pipeline

Introduce an `auto_universe` pipeline that builds and refreshes symbol sets in three stages:

1. **Discover** a broad candidate set from configured sources.
   - Examples: exchange listings, index constituents, sector ETFs, existing watchlist, portfolio holdings, and manually pinned symbols.
   - Output: raw symbols with source attribution and retrieval timestamp.
2. **Enrich** every symbol with basic metadata needed before screening.
   - Required fields: normalized ticker, exchange, currency, asset type, country, sector/industry, market cap bucket, average volume, last close, data-provider availability, delisting/suspension flag, and optional benchmark mapping.
   - Output: a cached symbol metadata table so repeated screener runs do not refetch the same facts.
3. **Filter and materialize** only relevant symbols into named universes.
   - Hard filters: supported asset type, supported currency, minimum price, minimum liquidity, data availability, non-delisted status.
   - Strategy filters: region, sector inclusion/exclusion, market cap bucket, volatility bounds, benchmark, and strategy-specific price range.
   - Output: stable named universes such as `auto_us_liquid`, `auto_eu_liquid`, `auto_semiconductors`, and `auto_watchlist_plus_candidates`.

The screener should consume these materialized universes exactly like any other named universe. This keeps screening reproducible: a run references a universe version, a strategy id, and an as-of date.

## Why this is better than manual switching

- **Less operator work:** the user chooses a goal, not a hand-maintained ticker list.
- **Deterministic runs:** each universe has a cached version and source metadata.
- **Better coverage:** new index constituents and watchlist-adjacent symbols enter automatically after refresh.
- **Safer filtering:** illiquid, unsupported, delisted, or wrong-currency symbols are removed before expensive analysis.
- **Scalable intelligence:** enrichment and AI analysis can be queued only for symbols that pass cheap eligibility filters.

## Minimal architecture

```text
Configured sources
  -> symbol discovery
  -> metadata enrichment cache
  -> eligibility filters
  -> versioned symbol sets
  -> screener run
  -> top candidates + optional intelligence
```

### Data model additions

Add a persisted symbol registry and versioned universe manifests:

- `symbol_registry`: one row per normalized symbol/provider mapping.
- `symbol_metadata_snapshot`: cached basic facts with `asof_date`, `provider`, and `quality_flags`.
- `universe_manifest`: universe id, filter definition hash, source list, refresh timestamp, benchmark, and symbol count.
- `universe_membership`: universe version id plus ordered symbols and inclusion reasons.

A JSON-backed implementation is enough for a first iteration if it follows the same shape; SQLite is preferable once refresh history and metadata quality checks become important.

## Refresh policy

Use different refresh frequencies for different costs:

| Layer | Suggested cadence | Notes |
| --- | --- | --- |
| Source membership | Daily or weekly | Index constituents and exchange listings change slowly. |
| Static metadata | Weekly | Exchange, sector, country, and asset type rarely change. |
| Liquidity and last close | Daily after close | Needed for filters before the final screener run. |
| Fundamentals snapshot | On demand or weekly | Run only after cheap technical/liquidity filters. |
| AI intelligence | On demand for top candidates | Avoid analyzing thousands of symbols. |

## Operator workflow

1. User configures high-level goals, for example `regions: [US, EU]`, `currencies: [USD, EUR]`, `min_avg_volume`, `min_price`, and excluded sectors.
2. System refreshes configured symbol sources.
3. System enriches and filters symbols into versioned universes.
4. User picks an auto universe once, or the strategy defaults to a configured auto universe.
5. Daily screener runs against the latest eligible version and returns ranked candidates.

## Implementation phases

### Phase 1 — Practical MVP

- Add a backend `UniverseRefreshService` that reuses current universe endpoints and writes versioned manifests.
- Store symbol metadata in the existing runtime data area.
- Support one default generated universe, for example `auto_liquid_supported`.
- Add filters for price, currency, asset type, average volume, and provider availability.
- Add a UI label that shows universe source, last refresh, and symbol count.

### Phase 2 — Strategy-aware universes

- Let each strategy declare a default `auto_universe` profile in YAML configuration.
- Materialize strategy-specific universes from the same registry without duplicating discovery.
- Record the universe version id in screener job history for reproducibility.

### Phase 3 — Intelligent prioritization

- Add scoring before the screener for cheap metadata-only prioritization: liquidity, sector strength proxy, earnings proximity availability, and watchlist/portfolio adjacency.
- Queue expensive fundamentals or AI enrichment only for candidates that pass the deterministic screener or are pinned by the user.

## Recommendation

Build this as a universe-preparation layer, not as additional screener branching. The screener should continue to receive `universe` or `tickers`; the new layer should make sure the named universe is always fresh, relevant, versioned, and explainable.
