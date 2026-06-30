# Taxonomy-based Symbol Pool

**Date:** 2026-06-30
**Branch basis:** `main`
**Status:** Approved, pending implementation

## Problem

The screener uses 25 manually-curated universes selected one at a time. Switching universes is friction: signals get missed because switching is lazy, and running multiple universes burns rate limits. Universes are overlapping silos with no shared filtering surface.

## Goal

Replace universe selection with a unified symbol pool filtered by taxonomy dimensions. All known symbols live in one pool. The screener pre-filters by taxonomy (no network required) then fetches OHLCV only for the filtered subset.

---

## Data Layer

### `data/symbol_pool.json` (new)

The query-time source of truth. Built manually via a future UI action. Contains ~1500–3000 symbols: deduplicated merge of all 25 universe snapshots + instrument master filtered to `status=active` + `primary_listing=true` + known exchange MIC.

The screener pre-filter reads only this file. No network call needed for filtering.

### `data/review_queue.json` (new)

Symbols the screener has failed to fetch `fetch_failure_threshold` consecutive times (default 3, configurable in `config/defaults.yaml`). Surfaced in the UI as a badge with count. Requires deliberate action per entry — no auto-resolution.

Schema per entry:
```json
{
  "symbol": "AAPL",
  "exchange_mic": "XNAS",
  "failure_count": 3,
  "first_failed_at": "2026-06-28",
  "last_failed_at": "2026-06-30",
  "reason": "yfinance: no data returned"
}
```

### `data/intelligence/instrument_master.json` (unchanged)

Remains the raw enrichment source used when building the pool. Schema and role unchanged.

### `config/taxonomy_presets.yaml` (new)

Named filter combos that replace the universe concept for UX convenience. Example:

```yaml
presets:
  us_large_cap_equities:
    label: "US Large Cap Equities"
    filter:
      region: [us]
      market_cap_tier: [large]
      instrument_type_detail: [equity]
  eu_blue_chips:
    label: "EU Blue Chips"
    filter:
      region: [europe]
      market_cap_tier: [large]
      instrument_type_detail: [equity]
  sector_etfs:
    label: "Sector ETFs"
    filter:
      instrument_type_detail: [etf_sector]
```

---

## Taxonomy Schema

New fields on every symbol in `symbol_pool.json`:

| Field | Type | Values | Source |
|---|---|---|---|
| `region` | enum | `us` \| `europe` \| `asia_pacific` \| `other` | derived from `exchange_mic` + `country` at build time |
| `market_cap_tier` | enum | `large` \| `mid` \| `small` \| `micro` \| `null` | yfinance `marketCap` at build time |
| `sector` | string | Morningstar sector (Technology, Healthcare, …) | yfinance |
| `industry` | string | Morningstar industry (granular) | yfinance |
| `index_memberships` | string[] | old universe IDs the symbol appeared in | derived from universe snapshots at build time |
| `liquidity_tier` | enum | `high` \| `mid` \| `low` | derived from avg 30d dollar volume at build time |
| `instrument_type_detail` | enum | `equity` \| `etf_equity` \| `etf_sector` \| `etf_leveraged` \| `etf_bond` \| `etf_commodity` | yfinance `quoteType` + `category` |
| `available_providers` | string[] | `["yfinance", "degiro", "eodhd"]` | derived from `provider_symbol_map` in instrument master; defaults to `["yfinance"]` if absent |
| `primary_provider` | string | `yfinance` \| `degiro` \| `eodhd` | preferred provider for this symbol |
| `taxonomy_refreshed_at` | date | ISO date | pool build timestamp |
| `fetch_failure_count` | int | 0–N | incremented by screener on fetch failure |
| `last_fetch_ok_at` | date | ISO date | updated by screener on fetch success |

**Market cap tier thresholds** (configurable in `config/defaults.yaml`):
- large ≥ $10B
- mid $2B–$10B
- small $300M–$2B
- micro < $300M

**Liquidity tier thresholds** (configurable):
- high ≥ $50M avg daily dollar volume
- mid $5M–$50M
- low < $5M

`index_memberships` replaces universe identity. A symbol in both `us_sp500` and `broad_market_stocks` carries `["us_sp500", "broad_market_stocks"]`. Filterable directly.

---

## Screener Flow

### Phase 1 — Pre-filter (no network, instant)

1. Load `data/symbol_pool.json`
2. Apply `TaxonomyFilter` from the request: region, cap tier, sector, index memberships, instrument type, provider, currency, exchange, liquidity tier
3. Exclude symbols currently in `data/review_queue.json`
4. Result: filtered symbol list (~50–500 symbols)

If `primary_provider=degiro` credentials are absent, symbols with `primary_provider=degiro` are excluded at this step rather than failing at fetch time.

### Phase 2 — Screen (same pipeline as today)

5. Fetch OHLCV only for the filtered list, batched in chunks of 100, routed to `primary_provider` per symbol
6. On fetch failure: increment `fetch_failure_count` in pool; if ≥ threshold → move to `review_queue.json`. Write-back to `symbol_pool.json` happens post-run (not mid-run) to avoid concurrent write issues.
7. On fetch success: clear `fetch_failure_count`, update `last_fetch_ok_at`. Same post-run write-back.
8. Run signal pipeline (trend, RS, volatility, breakout/pullback)
9. Rank candidates, return top N

Intelligence enrichment (LLM, Polygon) is **not triggered automatically**. It remains a manual per-symbol action from the symbol canvas.

---

## API Changes

### Modified

**`POST /api/screener/run`**

Replace `universe_id: str` with:
```json
{
  "taxonomy_filter": {
    "region": ["us"],
    "market_cap_tier": ["large", "mid"],
    "sector": ["Technology"],
    "index_memberships": ["us_sp500"],
    "instrument_type_detail": ["equity"],
    "provider": ["yfinance"],
    "currency": ["USD"],
    "exchange_mics": ["XNAS", "XNYS"],
    "liquidity_tier": ["high", "mid"]
  },
  "preset": "us_large_cap_equities"
}
```

`universe_id` kept as a deprecated alias: resolves to `index_memberships: [universe_id]`.

### New Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/pool/symbols` | Browse pool with taxonomy filter params, paginated |
| `GET` | `/api/pool/review-queue` | List flagged symbols |
| `POST` | `/api/pool/review-queue/{symbol}/remove` | Permanently remove from pool |
| `POST` | `/api/pool/review-queue/{symbol}/restore` | Reset failure counter, return to active pool |
| `GET` | `/api/pool/presets` | List taxonomy presets from `config/taxonomy_presets.yaml` |

---

## UI Changes

### Quick filter bar (new, above screener table, always visible)

Left to right:

| Control | Type | Dimensions |
|---|---|---|
| Preset | dropdown | Named presets from `taxonomy_presets.yaml`; selecting one pre-fills all chips. Manual change after selection marks it "custom". |
| Region | chip group | All \| US \| Europe \| Asia-Pac |
| Cap tier | chip group | All \| Large \| Mid \| Small \| Micro |
| Type | chip group | All \| Equity \| ETF |
| Sector | multi-select dropdown | Morningstar sectors |
| Index | multi-select dropdown | S&P 500, NASDAQ 100, DAX, CAC 40, … |

### Collapsible panel (existing, repurposed)

Universe selector removed. Retains:
- Currency, Exchange MIC, Liquidity tier, OTC inclusion, Provider
- Price range, ATR bounds (existing screener params)

### Review queue (new)

Badge on nav/header showing count of pending entries. Click opens a drawer/modal with a table:
- Columns: symbol, exchange, cap tier, sector, provider, failure count, last ok date, reason
- Actions per row: **Remove** (permanent) | **Keep** (resets counter, returns to active pool)

---

## Out of Scope

- Pool build / taxonomy refresh UI trigger (future, separate PR)
- Nightly pre-cache of OHLCV data
- Intelligence auto-enrichment from screener results

---

## Decisions

- `fetch_failure_threshold`: **3**
- `universe_id` alias: kept in this PR as a silent deprecated alias; **removed in a separate stacked PR**
- Symbol pool floor filter: **none** — all symbols included regardless of liquidity tier; filter bar controls exclusion at screen time
