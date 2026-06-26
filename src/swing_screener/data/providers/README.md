# data/providers

Market-data provider implementations for OHLCV and price history.

## Providers

| Module | Provider class | Source | Role |
|--------|---------------|--------|------|
| `yfinance_provider.py` | `YfinanceProvider` | Yahoo Finance | primary |
| `stooq_provider.py` | `StooqDataProvider` | Stooq | fallback |
| `alpaca_provider.py` | `AlpacaDataProvider` | Alpaca Markets | primary (requires `ALPACA_API_KEY` + `ALPACA_SECRET_KEY`) |

## Alpaca caveats (US equities/ETFs only)

`AlpacaDataProvider` serves US equities and ETFs — no indices, no FX. To stay
drop-in compatible with `YfinanceProvider`:

- **Index benchmarks → ETF proxies.** Universe benchmarks are index symbols
  (`^NDX`, `^GSPC`, `^DJI`, `^RUT`). The provider transparently fetches the
  tradeable ETF proxy (QQQ/SPY/DIA/IWM) and exposes it under the original `^`
  symbol so relative-strength keeps working. Index symbols without a proxy
  (foreign benchmarks) are dropped with a warning — Alpaca can't serve those
  universes anyway.
- **tz-naive date index.** Alpaca returns tz-aware UTC timestamps; the provider
  converts to US/Eastern and drops the tz so the index matches yfinance and the
  `(field, ticker)` OHLCV convention (`index = date`).
- **FX is not from Alpaca.** The EURUSD rate (portfolio EUR display) is always
  sourced from yfinance (`api/services/portfolio_service.py::_eurusd_rate`),
  regardless of the configured provider.

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
