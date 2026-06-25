# Intelligence Module

Post-close LLM enrichment for screener candidates and open positions.

## Purpose

Given a ticker, builds a structured context snapshot (OHLCV features, fundamentals, Finnhub signals) and sends it to an LLM for swing-trading analysis. Output is a `SymbolIntelligence` result with narrative, action recommendation, and catalyst context. Results are cached per ticker (TTL-based, stored in `data/intelligence/`).

## Files

| File | Purpose |
|------|---------|
| `symbol_analyzer.py` | Entry point. Assembles context → LLM prompt → parses `SymbolIntelligence`. |
| `models.py` | `SymbolIntelligence`, `SymbolIntelligenceRequest` data contracts. |
| `cache.py` | Per-ticker JSON cache (today's latest). Reads/writes to `data/intelligence/`. |
| `history.py` | Durable per-symbol analysis history (newest-first, capped). Feeds the thesis-drift digest + UI timeline. |
| `market_hours.py` | Minimal zoneinfo US market-hours helper. Decides pre-open mode + previous session close. |
| `catalysts/generator.py` | AI-assisted catalyst report generation. |
| `catalysts/models.py` | Catalyst data models. |
| `catalysts/prompts.py` | Prompt templates for catalyst analysis. |
| `catalysts/store.py` | Catalyst persistence (`data/intelligence/`). |

## API Surface

```
POST /api/intelligence/{ticker}         — run analysis; cache result
GET  /api/intelligence/{ticker}/latest  — return most-recent cached result
GET  /api/intelligence/{ticker}/history — return per-symbol analysis history (newest-first, capped)
POST /api/intelligence/sweep            — batch run across watchlist + open positions
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

## Pre-open gap outlook

When analysis runs for a **US symbol** (`currency == "USD"`) during the US
pre-market window (ET, weekday, before the 09:30 open — see `market_hours.py`),
the analyzer enters pre-open mode and asks the model for a `pre_open_outlook`:
`gap_direction` (gap_up/gap_down/flat), `magnitude` bucket (minor/moderate/large —
never a fake %), `primary_driver` (the overnight item most likely to move the
open, source-cited), `action_at_open`, `stop_gap_plan` (what to do if it gaps
through the stop), and `confidence`. Sourcing is web-search only (index/sector
futures + the stock's pre-market print + overnight headlines since the previous
session close). Outside the window, or for non-US symbols, the field is `None`
and behavior is unchanged. Applies to held positions (framed on the real stop)
and screener candidates (framed on the planned entry/stop).

## Analysis memory (thesis drift)

Every successful analysis appends a compact entry to
`data/intelligence/history/{TICKER}.json` (newest-first, capped at
`analysis_history.max_entries`, default 50). Before each run the analyzer reads
the last `analysis_history.digest_size` entries (default 5) and feeds them into
the prompt as a `--- Prior analyses (most recent first) ---` digest. The model
returns a `thesis_delta` (`status`: new/confirmed/weakening/invalidated,
`summary`, `what_played_out`) comparing today's read to the prior ones. The full
history is exposed via `GET /api/intelligence/{ticker}/history` for the UI timeline.

## Configuration

`config/intelligence.yaml` — LLM provider (OpenAI), model, temperature, signal type toggles,
plus `analysis_history` (history cap + digest size) and `pre_open` (timezone + session bounds).

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
| `evidence/models.py` | re-exports `SourceEvidence` (pydantic) from `catalysts.models` — `title, url, publisher, published_at, quote_or_summary, relevance` |
| `evidence/config.py` | `EvidenceConfig` + `load_evidence_config()` — reads `config.evidence` from the intelligence document |
| `evidence/rss.py` | `parse_feed`/`fetch_feed` — hardened lxml RSS/Atom parser (XXE-safe) + httpx fetch |
| `evidence/curation.py` | `curate(items, *, window_days, max_items, asof_date)` — recency-window filter + dedup (normalized title+url) + newest-first + cap |
| `evidence/collect.py` | `collect_evidence(ticker, *, asof_date, cfg, cache_root)` — per-date cache, fan-out across enabled collectors (fail-soft), curate |
| `evidence/collectors/sec_edgar.py` | `SecEdgarCatalystCollector` — SEC EDGAR submissions API (`data.sec.gov/submissions/CIK…json`), material-event filings (8-K, 6-K, SC 13D/G, 424B, DEF 14A) |
| `evidence/collectors/company_ir.py` | `CompanyIrRssCollector` — official IR RSS: `ir_feeds.json` seed first, then `evidence/discovery.py` auto-discovery on a seed miss |
| `evidence/discovery.py` | `discover_ir_feed`/`cached_discover` — resolve company site via yfinance `.info`, find + validate its RSS feed, cache long-term in `discovered_feeds_cache.json` |

### Collectors

Both implement the `DiagnosableSource` protocol (`describe()` + `probe(canary)`). Registered in `_PROBEABLE` in `api/services/datasources_service.py`.

- **`sec_edgar_catalysts`** (`SecEdgarCatalystCollector`): reads the SEC EDGAR submissions API (ticker→CIK via `company_tickers.json`, then `submissions/CIK…json`) and keeps recent material-event filings for US tickers. Forms are matched by prefix (`config.evidence.sec_forms`, default `8-K, 6-K, SC 13D, SC 13G, 424B, DEF 14A`, so `424B` catches `424B5` and `SC 13D` catches `SC 13D/A`), and each item carries a per-form relevance label. Fail-soft — returns empty on HTTP errors and records a fallback event.
- **`company_ir_rss`** (`CompanyIrRssCollector`): resolves the company's IR RSS feed in priority order: the hand-verified `data/intelligence/ir_feeds.json` seed first, then `evidence/discovery.py` auto-discovery (resolve the company site via yfinance `.info` `website`/`irWebsite`, parse the advertised `<link rel="alternate" type="application/rss+xml">`, else probe a short bounded path list, validate via `parse_feed`). Discovered feed URLs are cached long-term in `data/intelligence/discovered_feeds_cache.json` (found TTL 30d, negative TTL 7d). Auto-discovery is gated by `config.evidence.discovery_enabled`. Fail-soft throughout.

A third venue-wide `exchange_announcements` collector was removed: every seeded EU exchange RSS endpoint (Euronext, CNMV, Borsa Italiana, SIX, Nasdaq Nordic) is dead or no longer serves parseable RSS, and venue-wide notices are not symbol-specific, so it added no information beyond the `web_search` pass.

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
