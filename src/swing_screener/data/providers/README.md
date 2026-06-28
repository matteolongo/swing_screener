# data/providers

Market-data provider implementations for OHLCV and price history.

## Providers

| Module | Provider class | Source | Role |
|--------|---------------|--------|------|
| `yfinance_provider.py` | `YfinanceProvider` | Yahoo Finance | primary |
| `alpaca_provider.py` | `AlpacaDataProvider` | Alpaca Markets | primary (requires `ALPACA_API_KEY` + `ALPACA_SECRET_KEY`) |
| `polygon_provider.py` | `PolygonProvider` | Polygon.io | primary (requires `POLYGON_IO_API_KEY`) |

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
