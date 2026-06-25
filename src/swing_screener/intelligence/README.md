# Intelligence Module

Post-close LLM enrichment for screener candidates and open positions.

## Purpose

Given a ticker, builds a structured context snapshot (OHLCV features, fundamentals, Finnhub signals) and sends it to an LLM for swing-trading analysis. Output is a `SymbolIntelligence` result with narrative, action recommendation, and catalyst context. Results are cached per ticker (TTL-based, stored in `data/intelligence/`).

## Files

| File | Purpose |
|------|---------|
| `symbol_analyzer.py` | Entry point. Assembles context → two-call LLM flow → parses `SymbolIntelligence`. |
| `models.py` | `SymbolIntelligence`, `SymbolIntelligenceRequest` data contracts. |
| `cache.py` | Per-ticker JSON cache (today's latest). Reads/writes to `data/intelligence/`. |
| `history.py` | Durable per-symbol analysis history (newest-first, capped). Feeds the thesis-drift digest + UI timeline. |
| `market_hours.py` | Minimal zoneinfo US market-hours helper. Decides pre-open mode + previous session close. |
| `metrics.py` | Append-only per-analysis metrics log (`data/intelligence/intelligence_metrics.json`). |

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

## Two-call analyzer

The symbol analyzer runs two sequential LLM calls to keep web-search from truncating structured output mid-JSON:

1. **Call 1 (search)** — `config.llm.web_search_model` (default `gpt-4o`) performs the multi-hop web search, writes a prose narrative with cited source URLs, and returns free-text.
2. **Call 2 (format)** — `config.llm.format_model` (default `gpt-4o-mini`) receives the prose and structures it into the validated `SymbolIntelligence` schema via the Responses structured-output API (`responses.parse`). No tool use in call 2.

The split preserves full reasoning in call 1 while using a cheaper model for deterministic schema extraction in call 2. Phase 2 (Tavily evidence injection) will feed additional structured evidence into call 1 at the `--- Catalyst evidence ---` seam.

## Configuration

`config/intelligence.yaml` — LLM provider (OpenAI), model, temperature, signal type toggles,
plus `analysis_history` (history cap + digest size) and `pre_open` (timezone + session bounds).

Key LLM settings:

| Key | Default | Purpose |
|-----|---------|---------|
| `llm.web_search_model` | `gpt-4o` | Call 1: web search + narrative |
| `llm.format_model` | `gpt-4o-mini` | Call 2: tool-free structured output |
| `llm.web_search_max_tokens` | `4000` | Token budget for call 1 |
| `llm.request_timeout_seconds` | `60` | Per-call HTTP timeout |
| `llm.max_retries` | `2` | Retry count for transient errors |
| `llm.analyzer_enabled` | `true` | Kill-switch: `false` → endpoints return 503 |

API keys go in environment variables, not the config file.

## Caching

Results stored as JSON under `data/intelligence/<ticker>_analysis.json`. TTL is set in `config/intelligence.yaml`. `cache.py` exposes `get_cached_analysis(ticker)` → returns `None` on miss or expiry.

`POST /api/intelligence/{ticker}` checks the cache first and returns the same-day result unless `force=true` is passed. `/sweep` applies the same cache-before-spend logic per symbol.

## Observability

`data/intelligence/intelligence_metrics.json` — append-only log (capped at 500 entries) written by `metrics.py` after each analysis. Each entry: `{ts, ticker, tokens}`. A sudden `tokens: null` run pinpoints a call that did not complete; a gap in SEC coverage is visible by diffing evidence counts in the logged evidence cache.

Phase 3 (calibration scorer) will extend each history entry's `predictions` list (`{direction, reason, reference}`) to score outcomes against prior calls; the persistence seam is already in place.

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
| `evidence/models.py` | `SourceEvidence` (pydantic) — `title, url, publisher, published_at, quote_or_summary, relevance` |
| `evidence/config.py` | `EvidenceConfig` + `load_evidence_config()` — reads `config.evidence` from the intelligence document |
| `evidence/curation.py` | `curate(items, *, window_days, max_items, asof_date)` — recency-window filter + dedup (normalized title+url) + newest-first + cap |
| `evidence/collect.py` | `collect_evidence(ticker, *, asof_date, cfg, cache_root)` — per-date cache, fan-out across enabled collectors (fail-soft), curate |
| `evidence/collectors/sec_edgar.py` | `SecEdgarCatalystCollector` — SEC EDGAR submissions API (`data.sec.gov/submissions/CIK…json`), material-event filings (8-K, 6-K, SC 13D/G, 424B, DEF 14A) |

### Collectors

`SecEdgarCatalystCollector` implements the `DiagnosableSource` protocol (`describe()` + `probe(canary)`). Registered in `_PROBEABLE` in `api/services/datasources_service.py` as `sec_edgar_catalysts`.

- **`sec_edgar_catalysts`** (`SecEdgarCatalystCollector`): reads the SEC EDGAR submissions API (ticker→CIK via `company_tickers.json`, then `submissions/CIK…json`) and keeps recent material-event filings for US tickers. Forms are matched by prefix (`config.evidence.sec_forms`, default `8-K, 6-K, SC 13D, SC 13G, 424B, DEF 14A`, so `424B` catches `424B5` and `SC 13D` catches `SC 13D/A`), and each item carries a per-form relevance label. The HTTP User-Agent declares a contact email (`config.evidence.http.user_agent`) as required by SEC EDGAR fair-use policy. Fail-soft — returns empty on HTTP errors and records a fallback event.

The `company_ir_rss` collector (IR RSS feed auto-discovery) and the `exchange_announcements` collector (EU venue-wide RSS) were removed: IR feeds were unreliable and symbol-IR coverage was incomplete; exchange-wide notices are not symbol-specific and add no signal beyond the web-search pass.

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

## Distilled fields and UI panels

The narrative is the long-form reasoning; the web UI keeps it collapsed and leads with distilled,
structured fields the call-2 formatter extracts from the prose. The card renders a **fixed,
status-aware panel skeleton** so the layout does not silently vary with which fields the model filled:

- **Screened candidate**: Decision focus (`summary_line` + `price_hook` "why now") · Key numbers
  (`key_numbers`) · What to expect (`prediction_bullets` + `upcoming_events`) · News (`news`) · Risks
  (`risk_factors`) · Full rationale (collapsed).
- **Open position** (action `MANAGE_ONLY`): Decision focus + Position signal (`position_signal`) · Why
  it moved (`position_move_explanation`) · Outlook (`position_outlook`) · Key numbers · What to expect ·
  News · Full rationale (collapsed).

`news` is a list of `NewsItem` (`{headline, url, date, sentiment}`) — recent, already-happened items
the model surfaced in search, distinct from `upcoming_events` (forward-looking). Additive and
backward-compatible: results from before this field default to `[]`. The prompt is responsible for
filling each panel for the active status; a genuinely empty panel renders a muted placeholder rather
than disappearing.
