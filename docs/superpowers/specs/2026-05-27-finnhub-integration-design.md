# Finnhub Integration Design

**Date:** 2026-05-27
**Branch:** codex/ux-simplification-stage-3
**Status:** Approved — ready for implementation

## Overview

Finnhub (`FINNHUB_API_KEY`) is already wired for the economic events calendar. This design extends that key to:

1. **Fundamentals enrichment** — fill `None` metric fields and add three new signals (analyst recommendations, analyst price target, earnings beat streak) on top of the existing yfinance/sec_edgar/degiro provider chain.
2. **Calendar enrichment** — switch earnings dates from yfinance to Finnhub (adds EPS estimates), and add IPO and dividend event types.

## Architecture

### Approach: Enrichment client, not a provider

Finnhub is **not** added to the `FundamentalsProvider` chain. The existing chain (sec_edgar → degiro → yfinance) runs first; a separate `FinnhubEnrichmentClient` then fills gaps and appends new signals. This preserves the "first success wins" provider contract and avoids a merge-provider abstraction.

```
get_snapshot(symbol)
  └── existing provider chain → ProviderFundamentalsRecord (primary)
        └── FinnhubEnrichmentClient.enrich(record)
              ├── _fetch_metric_supplement  → fills None metric fields
              ├── _fetch_recommendation_score → analyst_recommendation_score
              ├── _fetch_price_target         → analyst_price_target
              └── _fetch_beat_streak          → earnings_beat_streak
                    └── build_snapshot(enriched_record, cfg) → FundamentalSnapshot
```

Enrichment is silently skipped when `FINNHUB_API_KEY` is absent — zero behaviour change for users without the key.

## Components

### 1. New model fields

Added to both `ProviderFundamentalsRecord` and `FundamentalSnapshot` as optional `None` defaults. Existing providers require no changes.

| Field | Type | Source endpoint |
|---|---|---|
| `net_margin` | `float \| None` | `/stock/metric` fill-gap |
| `analyst_recommendation_score` | `float \| None` | `/stock/recommendation` |
| `analyst_price_target` | `float \| None` | `/stock/price-target` |
| `earnings_beat_streak` | `int \| None` | `/stock/earnings` |

`_coverage_status()` in `scoring.py` does **not** count these fields — they are enrichment-only, not primary coverage indicators.

### 2. `FinnhubEnrichmentClient`

**File:** `src/swing_screener/fundamentals/finnhub_client.py`

```python
class FinnhubEnrichmentClient:
    def __init__(self, api_key: str) -> None: ...

    def enrich(self, record: ProviderFundamentalsRecord) -> ProviderFundamentalsRecord:
        """Calls all four fetch methods; merges results via dataclasses.replace()."""

    def _fetch_metric_supplement(self, symbol: str) -> dict[str, float | None]:
        """GET /stock/metric?symbol=X&metric=all
        Maps Finnhub metric keys to ProviderFundamentalsRecord field names.
        Only returns values for fields that are None on the record.
        Key mappings (Finnhub → model):
          netProfitMarginAnnual     → net_margin
          revenueGrowthAnnualYoy    → revenue_growth_yoy
          epsGrowthAnnualYoy        → earnings_growth_yoy
          grossMarginAnnual         → gross_margin
          operatingMarginAnnual     → operating_margin
          totalDebt/totalEquityAnnual → debt_to_equity
          currentRatioAnnual        → current_ratio
          roeAnnual                 → return_on_equity
          peAnnual                  → trailing_pe
          pbAnnual                  → price_to_book
        """

    def _fetch_recommendation_score(self, symbol: str) -> float | None:
        """GET /stock/recommendation — most recent period.
        score = strongBuy + buy - sell - strongSell (raw net bull count).
        """

    def _fetch_price_target(self, symbol: str) -> float | None:
        """GET /stock/price-target → targetMedian."""

    def _fetch_beat_streak(self, symbol: str) -> int | None:
        """GET /stock/earnings?limit=8
        Counts consecutive quarters (from most recent back) where actual > estimate.
        Stops at first miss or when estimate is unavailable.
        """
```

**HTTP:** `httpx`, 10s timeout per call, no retries. Each `_fetch_*` method is independently wrapped in `try/except Exception` — one failing endpoint logs at DEBUG and returns `None`/empty dict; siblings still run.

Rate-limit 429 treated identically (log + skip, not raise).

### 3. `FundamentalsAnalysisService` changes

**File:** `src/swing_screener/fundamentals/service.py`

New constructor param:
```python
def __init__(
    self,
    *,
    storage: FundamentalsStorage | None = None,
    sec_edgar_provider: ... | None = None,
    yfinance_provider: ... | None = None,
    degiro_provider: ... | None = None,
    finnhub_client: FinnhubEnrichmentClient | None = None,  # new
) -> None:
```

Enrichment inserted in `get_snapshot()` after the primary provider fetch, before `build_snapshot`:

```python
record = provider.fetch_record(normalized_symbol)
if self._finnhub_client:
    record = self._finnhub_client.enrich(record)
snapshot = build_snapshot(record, cfg)
```

`FundamentalsConfig` is **unchanged** — enrichment is on/off via key presence, not config.

### 4. API wiring

**File:** `api/dependencies.py`

```python
import os
from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient

_finnhub_key = os.environ.get("FINNHUB_API_KEY")
_finnhub_client = FinnhubEnrichmentClient(_finnhub_key) if _finnhub_key else None

def get_fundamentals_analysis_service() -> FundamentalsAnalysisService:
    return FundamentalsAnalysisService(finnhub_client=_finnhub_client)
```

### 5. Calendar changes

**File:** `api/services/calendar_service.py`

**Model:** `api/models/calendar.py` — `CalendarEvent` gains:
```python
eps_estimate: float | None = None
eps_actual: float | None = None
```
`event_type` gains two new valid values: `"ipo"`, `"dividend"`.

**New/changed methods on `CalendarService`:**

| Method | Change |
|---|---|
| `_fetch_earnings_for(ticker)` | Replaced by Finnhub `/calendar/earnings` when key present; yfinance path kept as fallback when key absent |
| `_fetch_ipo_events(start, end)` | New — GET `/calendar/ipo`, event_type="ipo" |
| `_fetch_dividend_events(tickers, start, end)` | New — GET `/calendar/dividend` per position ticker, batched via ThreadPoolExecutor, event_type="dividend" |

`get_events()` orchestration:
```
earnings  → Finnhub /calendar/earnings if key, else yfinance
economic  → Finnhub /calendar/economic (existing, unchanged)
ipo       → Finnhub /calendar/ipo if key
dividends → Finnhub /calendar/dividend if key, position tickers only
```

Dividends fetched for **position tickers only** — dividend dates for screener candidates are noise.

IPO events: filter to `status in {"priced", "filed"}` to exclude speculative pre-filing noise.

## Error handling

All Finnhub calendar paths follow the existing `_fetch_economic_events` pattern: `try/except Exception`, log at INFO, return `[]`. Earnings Finnhub failure falls back to yfinance silently.

All Finnhub fundamentals paths: per-method `try/except`, log at DEBUG, return `None`/empty. `enrich()` never raises.

Timeouts: 10s per HTTP call. No retries — end-of-day workflow tolerates staleness over latency.

## Testing

### Unit tests (no network)

**`FinnhubEnrichmentClient`:**
- Mock `httpx.get` per endpoint
- Assert `None` fields filled; non-`None` fields untouched
- Assert per-method failure doesn't poison sibling calls
- Assert 429 response → graceful skip

**`FundamentalsAnalysisService`:**
- Mock enrichment client; assert `enrich()` called after primary provider fetch
- Assert enrichment skipped when `finnhub_client=None`
- Assert enriched fields appear in resulting `FundamentalSnapshot`

**Calendar:**
- Mock Finnhub HTTP; assert `eps_estimate` parsed from earnings response
- Assert IPO and dividend events carry correct `event_type`
- Assert yfinance fallback triggered when `finnhub_api_key` absent

### Integration tests (marked `@pytest.mark.integration`, skipped in CI)

One real live fetch per Finnhub endpoint using `FINNHUB_API_KEY` from environment.

## Files changed

| File | Change |
|---|---|
| `src/swing_screener/fundamentals/models.py` | Add 4 new optional fields to `ProviderFundamentalsRecord` + `FundamentalSnapshot` |
| `src/swing_screener/fundamentals/finnhub_client.py` | New — `FinnhubEnrichmentClient` |
| `src/swing_screener/fundamentals/__init__.py` | Export `FinnhubEnrichmentClient` |
| `src/swing_screener/fundamentals/service.py` | Add `finnhub_client` param + enrichment call |
| `api/dependencies.py` | Construct + inject `FinnhubEnrichmentClient` |
| `api/models/calendar.py` | Add `eps_estimate`, `eps_actual` fields; expand `event_type` |
| `api/services/calendar_service.py` | Switch earnings to Finnhub, add IPO + dividend fetch methods |
| `tests/fundamentals/test_finnhub_client.py` | New unit tests |
| `tests/fundamentals/test_fundamentals_service_enrichment.py` | New unit tests |
| `tests/services/test_calendar_service.py` | Extend with Finnhub calendar cases |
