# data/providers

Market-data provider implementations for OHLCV and price history.

## Providers

| Module | Provider class | Source | Role |
|--------|---------------|--------|------|
| `yfinance_provider.py` | `YfinanceProvider` | Yahoo Finance | primary |
| `alpaca_provider.py` | `AlpacaDataProvider` | Alpaca Markets | primary (requires `ALPACA_API_KEY` + `ALPACA_SECRET_KEY`) |
| `polygon_provider.py` | `PolygonProvider` | Polygon.io | primary (requires `POLYGON_IO_API_KEY`) |

## API provenance

`GET /api/market-data/{ticker}/candles` reports the selected provider's
`get_provider_name()` result and the requested interval. Its `data_as_of` value
is the latest returned candle date; `fetched_at` is the separate,
timezone-aware API fetch timestamp. Neither timestamp is inferred from the
other, and `data_as_of` is null when the provider returns no bars.

## Cache freshness policy

`MarketDataProvider.fetch_ohlcv()` accepts an optional
`MarketDataCachePolicy`. When `fresh_after_utc` is set, each cache-capable
provider (yfinance, Polygon) accepts a covering Parquet file only when its
modification time is at or after that instant. The screener supplies the
latest relevant market close only for a current-date `final_close` run;
historical and explicitly intraday runs use the normal cache policy.

If the required refresh fails, yfinance may return the older covering cache.
That result is marked with `stale_cache_fallback` in both DataFrame provenance
and provider health. Consumers must retain the stale/intraday label and must not
promote the result to `final_close` from wall-clock time alone.

## How to add a data source

A source appears on the Data Sources page when it implements the diagnostics
contract (`swing_screener.data.source_health.DiagnosableSource`):

1. Implement the domain fetch method (`fetch_ohlcv` / `fetch_record`).
2. Add two classmethods:
   - `describe() -> SourceDescriptor` — static, credential-free; set `configured`
     by checking the env var / package; set `probeable` accordingly.
   - `probe(canary: str) -> ProbeResult` — a tiny real request; return
     `not_configured` (no exception) when keys/pkg are missing.
3. Register the provider id → class in `api/services/datasources_service.py`
   (`_PROBEABLE`). It then auto-appears in the inventory, gets a Test button,
   and (if it has fallbacks) records events via `record_fallback(...)`.

To remove a source: delete the provider file and its `_PROBEABLE` entry.
