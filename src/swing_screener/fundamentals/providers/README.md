# fundamentals/providers

Fundamental data provider implementations (income statement, balance sheet, ratios).

## Providers

| Module | Provider class | Source | Role |
|--------|---------------|--------|------|
| `sec_edgar.py` | `SecEdgarFundamentalsProvider` | SEC EDGAR | primary |
| `yfinance.py` | `YfinanceFundamentalsProvider` | Yahoo Finance | fallback |
| `degiro.py` | `DegiroFundamentalsProvider` | DeGiro (EU equities) | primary (requires `DEGIRO_USERNAME` + `DEGIRO_PASSWORD`) |

`FinnhubEnrichmentClient` (`fundamentals/finnhub_client.py`) is registered as a
diagnostics-only source (`role=enrichment`; requires `FINNHUB_API_KEY`). It is
not a `FundamentalsProvider` subclass — it enriches snapshots with signal fields
rather than supplying full fundamental records.

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
