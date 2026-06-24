# Intelligence Module

Post-close LLM enrichment for screener candidates and open positions.

## Purpose

Given a ticker, builds a structured context snapshot (OHLCV features, fundamentals, Finnhub signals) and sends it to an LLM for swing-trading analysis. Output is a `SymbolIntelligence` result with narrative, action recommendation, and catalyst context. Results are cached per ticker (TTL-based, stored in `data/intelligence/`).

## Files

| File | Purpose |
|------|---------|
| `symbol_analyzer.py` | Entry point. Assembles context → LLM prompt → parses `SymbolIntelligence`. |
| `models.py` | `SymbolIntelligence`, `SymbolIntelligenceRequest` data contracts. |
| `cache.py` | Per-ticker JSON cache. Reads/writes to `data/intelligence/`. |
| `catalysts/generator.py` | AI-assisted catalyst report generation. |
| `catalysts/models.py` | Catalyst data models. |
| `catalysts/prompts.py` | Prompt templates for catalyst analysis. |
| `catalysts/store.py` | Catalyst persistence (`data/intelligence/`). |

## API Surface

```
POST /api/intelligence/{ticker}        — run analysis; cache result
GET  /api/intelligence/{ticker}/latest — return most-recent cached result
POST /api/intelligence/sweep           — batch run across watchlist + open positions
```

Router: `api/routers/intelligence.py`
Service: `api/services/intelligence_service.py`
Core: `symbol_analyzer.py`

## Input Context

The analyzer assembles context from:
- OHLCV features (Close, ATR%, SMA trend, momentum, 52w high proximity)
- Fundamentals snapshot (P/E, revenue growth, gross margin, balance sheet signals)
- Finnhub signals (insider transactions, forward EPS estimate, upgrade/downgrade actions)
- Open position details (if ticker is already held — switches action to `MANAGE_ONLY`)
- Recent candlestick patterns via `SymbolIntelligenceRequest.recent_patterns`
  (list of `"name@context"` strings). When present they render a
  "Recent candlestick patterns" line in the prompt; the field is optional and the
  caller (e.g. the web UI request builder) populates it from detected patterns.

### Server-side auto-fetch (full data, blocking)

`POST /api/intelligence/{ticker}` runs `enrich_intelligence_request`
(`api/services/intelligence_enrichment.py`) before the LLM call. Any request field
left unset is filled server-side (blocking) from the fundamentals snapshot
(`FundamentalsService.get_snapshot`) and earnings proximity — so the model always
sees the full picture regardless of what the caller sent. Provider errors degrade
gracefully (the field stays unset; analysis never fails on a fetch error), and
caller-provided values are never overwritten.

`POST /api/intelligence/position/{position_id}` enriches the same way: it runs
`enrich_intelligence_request` (fundamentals + earnings) and then `enrich_with_technicals`,
which fetches recent OHLCV via `PortfolioService.fetch_recent_ohlcv` and computes SMAs,
6m/12m momentum, ATR, 52-week-high distance and candle patterns for the held symbol. This
is why open positions get the same `--- Technical context ---`, `--- Fundamentals ---`,
`--- Chart quality ---` and `--- Finnhub enrichment signals ---` blocks a candidate gets,
instead of only entry/stop. Benchmark-relative fields (`rel_strength`, `sector_rs`) are not
filled on this single-symbol path. The screener decision-context block stays candidate-only.

The prompt now renders a `--- Fundamentals ---` block from the raw-fundamentals
fields on `SymbolIntelligenceRequest`: `trailing_pe`, `revenue_growth_yoy`,
`gross_margin`, `net_margin`, `return_on_equity`, `debt_to_equity` (alongside the
existing Finnhub signal fields). The web-search instruction is multi-hop — search
broadly, follow the material leads, then run a dedicated forward-looking catalyst
pass — and every news claim must cite its source URL.

## Configuration

`config/intelligence.yaml` — LLM provider (OpenAI), model, temperature, signal type toggles.

API keys go in environment variables, not the config file.

## Caching

Results stored as JSON under `data/intelligence/<ticker>_analysis.json`. TTL is set in `config/intelligence.yaml`. `cache.py` exposes `get_cached_analysis(ticker)` → returns `None` on miss or expiry.

## Action Types

`SymbolIntelligence.action` is one of:
- `BUY_NOW` — entry signal active at current price
- `BUY_ON_PULLBACK` — waiting for price to pull back to planned entry level
- `MANAGE_ONLY` — position already held; narrative is position-management focused
- `SKIP` — no actionable signal

## Evidence Collectors

`intelligence/evidence/` gathers structured catalyst evidence from real sources before the LLM call.

### Module layout

| Path | Purpose |
|------|---------|
| `evidence/models.py` | `SourceEvidence` dataclass — id, headline, url, published_at, source_id, confidence |
| `evidence/curate.py` | `curate(items, *, window_days, max_items)` — recency filter + dedup + sort |
| `evidence/collect.py` | `collect(ticker, *, asof_date, cfg)` — fan-out across enabled collectors, curate, return list |
| `evidence/collectors/sec_edgar.py` | `SecEdgarCatalystCollector` — SEC EDGAR EFTS full-text search for 8-K/6-K filings |
| `evidence/collectors/company_ir.py` | `CompanyIrRssCollector` — company IR RSS feed via SEC CIK lookup |
| `evidence/collectors/exchange.py` | `ExchangeAnnouncementsCollector` — Euronext announcement RSS (EU-MIC symbols only) |

### Collectors

All three implement the `DiagnosableSource` protocol (`describe()` + `probe(canary)`). Registered in `_PROBEABLE` in `api/services/datasources_service.py`.

- **`sec_edgar_catalysts`** (`SecEdgarCatalystCollector`): queries SEC EDGAR full-text search for recent 8-K/6-K filings for US tickers. Fail-soft — returns empty on HTTP errors and records a fallback event.
- **`company_ir_rss`** (`CompanyIrRssCollector`): fetches the company's own IR RSS feed located via SEC's CIK lookup. Fail-soft.
- **`exchange_announcements`** (`ExchangeAnnouncementsCollector`): fetches Euronext announcement RSS for symbols traded on EU MICs. No-op for non-EU tickers; fail-soft.

### Curation defaults

Controlled by `config.evidence` in `config/intelligence.yaml`:
- `recency_window_days: 30` — discard items older than 30 days
- `max_items_per_symbol: 8` — keep the 8 most-recent items after dedup

### Cache

Curated evidence is cached lazily at `data/intelligence/evidence/{date}/{ticker}.json` (regenerable; not committed). No schema migration required.

### Prompt injection

`collect.py` is called during `enrich_intelligence_request` and the curated items are passed into the LLM prompt as a `--- Catalyst evidence ---` block.

### Fail-soft behavior

Each collector catches all HTTP/parse errors, calls `record_fallback(...)`, and returns an empty list. The enrichment pipeline never raises on a collector failure.

## Open-position fields

When the request carries position context (`entry_price`, `entry_date`, `r_now`, `days_open`), the
result also populates:
- `position_signal` — HOLD / TRIM / EXIT call
- `position_outlook` — forward holding plan (expected hold, thesis status, invalidation signals, …)
- `position_move_explanation` — backward look: why price moved from entry to now (`direction`
  up/down/flat, `summary`, and `drivers[]` of `{label, detail}` grounded in news since the entry
  date), explaining the sign and size of the current R. `null` outside position context.
