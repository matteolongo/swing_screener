# Data Source Audit And Provider Strategy

Last updated: 2026-03-20

## Scope

- App scope: `US + Europe`
- Acquisition posture: `official APIs + public web only`
- Bias: `free-first`, while still naming the best paid stack
- Explicitly rejected: session-cookie replay, private API piggybacking, authenticated endpoint abuse, captcha bypass

## Implementation Status

| Tier | Status | Branch |
| --- | --- | --- |
| **Tier 1** — Free-first / Bootstrap | ✅ Complete | `codex/tier1-free-first-bootstrap` |
| **Tier 1.5** — EU catalog population | ✅ Complete | `codex/tier1-free-first-bootstrap` |
| **DeGiro enrichment layer** — Capability audit + portfolio sync | ✅ Phase 1 & 2 | `codex/degiro-capability-sync` |
| **Tier 2** — Low-cost / Practical | Not started | — |
| **Tier 3** — Best Quality / Production | Not started | — |

---

---

## DeGiro as a Validated Enrichment Layer (Phase 1 & 2)

DeGiro is treated as an **opt-in enrichment layer**, not inserted into the `config.py` provider chain. It is accessed exclusively via the `degiro-connector` optional dependency (`pip install -e '.[degiro]'`) and authenticated through environment variables (`DEGIRO_USERNAME`, `DEGIRO_PASSWORD`, `DEGIRO_INT_ACCOUNT`, `DEGIRO_TOTP_SECRET_KEY` or `DEGIRO_ONE_TIME_PASSWORD`).

### Phase 1 — Capability Audit (`POST /api/fundamentals/degiro/capability-audit`)

- Resolves each requested symbol to a DeGiro product reference (exact → alias → exchange/currency → ambiguous).
- Probes available data endpoints: quotes, company profile, financial statements, analyst views, news, agenda.
- Writes two artifacts per run: `{audit_id}_summary.md` (markdown table) and `{audit_id}_normalized.json` (full JSON), stored under `data/degiro/capability_audits/`.
- Returns `503` when the library is missing or credentials are absent — no import-time crash.

### Phase 2 — Portfolio Reconciliation (`POST /api/portfolio/sync/degiro/preview` and `/apply`)

- Fetches live portfolio, pending orders, order history, and transactions from DeGiro.
- Matches broker records to local orders/positions using: `broker_order_id` (exact) → `product_id + side + quantity + date` (fuzzy) → `isin/symbol alias`. Ambiguous matches are never auto-applied.
- `preview` is read-only; `apply` is idempotent (upsert-only, no hard deletes).
- Fee resolution uses transaction data; unresolved fees stay `None` (CSV importer remains the fallback for fee hydration).
- Artifacts written to `data/degiro/sync/`.

### Design decisions

- **Not in the provider chain**: DeGiro is a user's own broker; its data is portfolio-scoped, not market-wide. It sits alongside the fundamentals chain, not inside it.
- **Lazy imports everywhere**: the absence of `degiro-connector` never breaks the server startup or the existing fundamentals/screener APIs.
- **Read-only philosophy**: the integration never places orders. It reconciles state that already exists in DeGiro.

---

## Executive Summary

The app originally got too much of its truth from Yahoo-derived paths. That dependency showed up in daily prices, ticker metadata, fundamentals, news ingestion, and earnings calendar ingestion.

**Tier 1 and Tier 1.5 have now addressed the most critical gaps:**

- SEC EDGAR is the primary fundamentals source for US equities; yfinance is the fallback.
- Stooq is wired as an automatic OHLCV fallback when yfinance returns no data for a symbol.
- All six evidence adapters are active (`yahoo_finance`, `earnings_calendar`, `sec_edgar`, `company_ir_rss`, `exchange_announcements`, `financial_news_rss`).
- Exchange announcement feeds are populated for 10 EU exchanges.
- Company IR RSS feeds are seeded for all 12 instruments in the initial universe.
- Peer cluster map is seeded for theme confirmation scoring.
- OpenFIGI integration is implemented and documented; off by default, enable via `.env`.

The remaining Yahoo dependence is in: news/catalyst ingestion (still primary), earnings calendar (still primary), ticker metadata, and EU fundamentals (yfinance fallback only — no free primary source exists for Europe).

For paid data, the cleanest production path remains a split stack:

- US prices/reference: `Polygon`
- US event/news enrichment: `Wall Street Horizon` or `Benzinga/Alpaca News`
- US filings/fundamentals ground truth: `SEC EDGAR/XBRL`
- EU/global fundamentals and reference: `EODHD` or `Twelve Data`
- Cross-market security master: `OpenFIGI` plus repo overrides

---

## Current External Source Inventory

| Domain | Current source | Acquisition class | Role today | Coverage bias | Status |
| --- | --- | --- | --- | --- | --- |
| Price / OHLCV | `yfinance` | `unofficial` | Primary | Mixed (strongest on US liquid names) | Active |
| Price / OHLCV | `Stooq CSV` | `public web` | Automatic fallback when yfinance returns no data | Mixed | ✅ Wired (Tier 1) |
| Ticker metadata | `yfinance info` | `unofficial` | Primary | Mixed | Active; no replacement yet |
| Fundamentals | `SEC EDGAR/XBRL` | `official` | Primary for US equities | US only | ✅ Active (Tier 1) |
| Fundamentals | `yfinance` | `unofficial` | Fallback (EU/global, or when EDGAR has no CIK) | Mixed | Active fallback |
| News / catalysts | Yahoo Finance search endpoint | `unofficial` | Primary intelligence provider | Mixed | Active; Tier 2 target for replacement |
| Earnings calendar | `yfinance.Ticker().calendar` | `unofficial` | Primary intelligence provider | Mixed | Active; Tier 2 target for replacement |
| Official filings (evidence) | SEC EDGAR submissions API | `official` | Active evidence adapter | US | ✅ Active (Tier 1) |
| Company disclosures | Company IR RSS + autodiscovery | `public web` | Active evidence adapter | Mixed | ✅ Seeded for 12 symbols (Tier 1.5) |
| Exchange disclosures | Exchange announcement feeds | `official` / `public web` | Active evidence adapter | US + 10 EU exchanges | ✅ Populated (Tier 1.5) |
| Financial news RSS | RSS catalog + manual feeds | `public web` | Active evidence adapter | Mixed | ✅ Active (Tier 1) |
| Calendar scrape fallback | Public HTML pages with compliance guardrails | `public web` | Disabled (scraping_enabled: false) | Mixed | Available; off by default |
| Identifier mapping | OpenFIGI + instrument_master overrides | `aggregated commercial` | Opt-in; heuristic fallback when disabled | Mixed | ✅ Implemented; off by default (Tier 1) |
| Peer clustering | Curated peer_map.yaml | `internal` | Theme confirmation scoring | Initial 12-symbol universe | ✅ Seeded (Tier 1.5) |

---

## Gap Analysis (Updated)

| App need | Current state | Gap severity | What is missing |
| --- | --- | --- | --- |
| Authoritative daily / intraday OHLCV | yfinance primary + Stooq fallback | Medium | Contracted source of truth for US intraday; clean EOD/delayed policy |
| Normalized fundamentals — US | SEC EDGAR primary, yfinance fallback | Low | Data is now official; remaining work is richer XBRL field extraction |
| Normalized fundamentals — EU/global | yfinance fallback only | High | No viable free primary; needs EODHD or Twelve Data (Tier 2) |
| Forward corporate-event calendars | Yahoo calendar only | High | Higher-confidence earnings dates and event revisions |
| Official filings (evidence layer) | SEC EDGAR active; exchange feeds populated | Low | XETR (Deutsche Börse) has no free RSS; German issuers covered via ADR cross-listings |
| Cross-market identifier mapping | OpenFIGI implemented, off by default; instrument_master covers 12 symbols | Low–Medium | Enable for larger universes; anonymous rate limit (25 req/min) is sufficient for bootstrap |
| Redundant backups | OHLCV: yfinance → Stooq. Fundamentals: SEC EDGAR → yfinance | Medium | Health-based automatic switching not yet implemented |
| EU coverage — exchange feeds | 10 EU exchanges populated | Low | XETR remains empty; Nasdaq Nordic URL structure needs periodic verification |
| EU coverage — fundamentals | yfinance fallback only | High | Needs paid vendor (Tier 2) |

---

## Tier 1: Free-first / Bootstrap — COMPLETE ✅

**Delivered on branch `codex/tier1-free-first-bootstrap`.**

| Domain | Primary | Secondary | Fallback | Implemented |
| --- | --- | --- | --- | --- |
| US price / OHLCV | `yfinance` | — | `Stooq` (automatic) | ✅ |
| US fundamentals | `SEC EDGAR/XBRL` | — (Alpha Vantage skipped: 25 req/day unusable) | `yfinance` | ✅ |
| EU/global fundamentals | — (no viable free primary) | — | `yfinance` fallback + instrument_master overrides | ✅ (fallback wired) |
| Events / news | `SEC RSS + SEC APIs + company IR RSS` | `exchange_announcements + financial_news_rss` | compliant HTML scrape (disabled) | ✅ |
| Security master | `OpenFIGI` (opt-in) | `instrument_master` overrides | heuristic suffix mapping | ✅ |

**Key changes:**

- `StooqDataProvider` — automatic OHLCV fallback in `YfinanceProvider`
- `SecEdgarFundamentalsProvider` — primary US fundamentals; `TIER1_PROVIDERS = ("sec_edgar", "yfinance")` constant
- `data_region` provenance field on all fundamentals records (`"US"` from SEC EDGAR; inferred from ticker suffix in yfinance)
- All 6 evidence adapters active in `config/intelligence.yaml` and `config/defaults.yaml`
- OpenFIGI integration in `evidence.py` (env var opt-in, local cache)
- `InstrumentProfile` FIGI fields in `intelligence/models.py`
- Provider badge in `FundamentalsSnapshotCard` (UI shows e.g. `"sec_edgar · US"`)
- `tests/test_tier1_stack_smoke.py` — 5 integration smoke tests (all mocked HTTP)

---

## Tier 1.5: EU Catalog Population — COMPLETE ✅

**Delivered on the same branch.**

| Item | Status |
| --- | --- |
| `.gitignore` refined — seed files tracked, dated runtime outputs excluded | ✅ |
| `source_catalog.json` — 10 EU exchange feeds added | ✅ |
| `domain_policies.json` — 7 EU domain entries added | ✅ |
| `ir_feeds.json` — direct IR RSS feeds seeded for all 12 universe symbols | ✅ |
| `peer_map.yaml` — 5 peer clusters seeded for theme confirmation | ✅ |
| `.env.example` — OpenFIGI and all env vars documented | ✅ |

**EU exchange feeds added to `source_catalog.json`:**

| MIC | Exchange | Feed source |
| --- | --- | --- |
| XPAR / XAMS / XLIS | Euronext (Paris, Amsterdam, Lisbon) | Euronext market-notices RSS |
| XMAD | Bolsas y Mercados Españoles | CNMV significant-facts RSS (Spanish regulator) |
| XMIL | Borsa Italiana (Euronext Milan) | Borsa Italiana press RSS |
| XLON | London Stock Exchange | Investegate UK RNS aggregator RSS |
| XSWX | SIX Swiss Exchange | SIX exchange regulation news RSS |
| XHEL / XSTO / XCSE | Nasdaq Nordic (Helsinki, Stockholm, Copenhagen) | Nasdaq Nordic per-exchange RSS |
| XOSL | Oslo Bors (Euronext Oslo) | Oslo Bors newsweb RSS |
| XETR | Xetra / Deutsche Börse | ⚠️ No suitable free feed; left empty |

**Known gap — XETR:** Deutsche Börse has no publicly accessible RSS for company announcements. German issuers (SAP.DE, SIE.DE) are covered via their SEC EDGAR ADR cross-listings and seeded IR RSS feeds until a paid BaFin or Bundesanzeiger feed is sourced (Tier 2).

---

## Tier 2: Low-cost / Practical — NOT STARTED

| Domain | Planned primary | Planned secondary | Free fallback |
| --- | --- | --- | --- |
| US price / OHLCV | Contracted US feed | `yfinance` | `Stooq` |
| US fundamentals | `SEC EDGAR/XBRL` | `EODHD` for convenience fields | `yfinance` spot checks |
| EU/global fundamentals + reference | `EODHD` | `Twelve Data` | manual reports for priority names |
| Events / news | Paid financial news API | `SEC + IR RSS + exchange feeds` | public RSS catalogs |
| Security master | `OpenFIGI` | repo overrides | heuristics |

**Priority items for Tier 2:**
1. `EohdFundamentalsProvider` — EU fundamentals coverage (biggest remaining gap)
2. Add a contracted US OHLCV/reference backup if yfinance quality becomes the bottleneck
3. Wire a paid financial-news source to replace Yahoo Finance news ingestion
4. Config shape refactor: split `market_data.primary/secondary`, `fundamentals.primary/secondary` per domain

---

## Tier 3: Best Quality / Production — NOT STARTED

| Domain | Planned primary | Planned secondary | Free fallback |
| --- | --- | --- | --- |
| US price / OHLCV + reference | `Polygon` | Contracted US feed | `Stooq` / `yfinance` emergency only |
| US fundamentals | `SEC EDGAR/XBRL` | `Polygon financials/ratios` | `Alpha Vantage` selective use |
| EU/global fundamentals + reference | `EODHD` | `Twelve Data` | issuer reports + repo overrides |
| Forward corporate events | `Wall Street Horizon` | `SEC + IR RSS + exchange feeds` | compliant public calendars |
| News / catalysts | `Benzinga via Polygon or similar` | `financial_news_rss + IR RSS` | Yahoo news tertiary only |
| Security master | `OpenFIGI` | repo `instrument_master` | heuristics |

---

## Verified Vendor And Service Notes

### SEC EDGAR

Classification: `official`

- The SEC publishes JSON APIs on `data.sec.gov` for company submissions and extracted XBRL data, with no auth or API key required: [EDGAR API docs](https://www.sec.gov/edgar/sec-api-documentation).
- The APIs are updated throughout the day, and the SEC explicitly publishes nightly bulk ZIP archives such as `companyfacts.zip` and `submissions.zip`: [EDGAR API docs](https://www.sec.gov/edgar/sec-api-documentation).
- The SEC developer page also points to company-search RSS usage, which matters for free alerting and evidence ingestion: [Developer resources](https://www.sec.gov/about/developer-resources).

Verdict: permanent ground truth for US filings and US fundamentals. **Now active as primary fundamentals provider.**

### Polygon

Classification: `aggregated commercial`

- Polygon's stocks pricing page currently shows a free plan with EOD/reference/corporate actions access and higher tiers for delayed/real-time feeds: [Polygon pricing](https://polygon.io/pricing).
- Polygon's reference data suite includes ticker details, ticker news, financial reports, corporate actions, and more across plans: [Reference data](https://polygon.io/knowledge-base/article/what-is-polygons-reference-data).
- Polygon's ticker overview includes exchange, identifiers such as CIK and FIGI, market cap, and classifications: [Ticker overview](https://polygon.io/docs/rest/stocks/tickers/ticker-overview/).
- Polygon's newer ratios/fundamentals endpoints are available on higher-end stock plans or add-ons: [Ratios API](https://polygon.io/docs/rest/stocks/fundamentals/ratios), [Changelog](https://polygon.io/changelog).

Verdict: best fit for US price/reference infrastructure if we want one commercial anchor instead of stitching together multiple lighter vendors. Target for Tier 3.

### EODHD

Classification: `aggregated commercial`

- EODHD positions itself as a global API for historical, real-time, fundamental, and news data, with free entry and paid plans starting from `$19.99/month`: [Overview](https://eodhd.com/).
- EODHD documents a free plan limited to `20 API calls per day`, with one-year EOD history and symbol-list access: [Quick start](https://eodhd.com/financial-apis/quick-start-with-our-financial-data-apis/).
- EODHD states its US EOD/delayed data comes from Nasdaq Cloud API and European coverage from Cboe Europe Equities; it also describes internally standardized fundamentals built from filings, corporate websites, annual reports, and news sources: [Data sources](https://eodhd.com/financial-apis/our-data-sources-and-data-partners).
- EODHD documents global fundamentals, news, exchange-symbol lists, and earnings calendars, including EU examples such as `AI.PA`: [Fundamentals](https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds/), [Financial news](https://eodhd.com/financial-apis/financial-news-api/), [Exchange symbols](https://eodhd.com/financial-apis/list-supported-exchanges/), [Calendar API](https://eodhd.com/knowledgebase/calendar-upcoming-earnings-ipos-and-splits/).

Verdict: strong candidate for EU/global reference, fundamentals, and event coverage. **Priority #1 for Tier 2.**

### Twelve Data

Classification: `aggregated commercial`

- Twelve Data's Basic plan is free and currently advertises `800/day` API credits, while paid plans add more markets and corporate-event access: [Pricing](https://twelvedata.com/pricing).
- Twelve Data's fundamentals product markets global company financials, historical statements, profiles, and corporate events: [Fundamentals](https://twelvedata.com/fundamentals).
- Its docs show earnings and earnings calendar endpoints on paid tiers, and Pro advertises `70+ markets` with `real-time EU market data`: [Docs](https://twelvedata.com/docs), [Pricing](https://twelvedata.com/pricing).

Verdict: credible alternative to EODHD, especially when we want a modern multi-market API with a simpler plan ladder and explicit EU market language.

### Alpha Vantage

Classification: `aggregated commercial`

- Alpha Vantage documents a free limit of `25 API requests per day`: [Support](https://www.alphavantage.co/support/).
- Its documentation includes 20+ years of historical time series, normalized financial statements, shares outstanding, and an earnings calendar endpoint: [Documentation](https://www.alphavantage.co/documentation/).
- Alpha Vantage also states that real-time and 15-minute delayed US market data are premium-only: [Support](https://www.alphavantage.co/support/).

Verdict: **Skipped.** 25 req/day is unusable for full-universe daily workflows. Not planned for any tier.

### OpenFIGI

Classification: `aggregated commercial`

- OpenFIGI's mapping API is public and free to use, with higher rate limits when authenticated: [API documentation](https://www.openfigi.com/api/documentation).
- Without an API key, mapping requests are limited to `25 per minute` and `10 jobs per request`; with an API key, mapping rises to `25 per 6 seconds` and `100 jobs per request`: [API documentation](https://www.openfigi.com/api/documentation).

Verdict: the cleanest external service for symbol/market/security-master normalization. **Implemented in Tier 1; opt-in via `SWING_SCREENER_OPENFIGI_ENABLED=true` or `OPENFIGI_API_KEY`. See `.env.example`.**

### Wall Street Horizon

Classification: `aggregated commercial`

- Wall Street Horizon describes itself as covering `11,000+` companies worldwide and `40+` corporate event types: [Homepage](https://www.wallstreethorizon.com/).
- It emphasizes publicly sourced, compliant forward-looking corporate-event data and outlines a primary-source collection methodology across press releases, company websites, SEC filings, and IR information: [Company overview](https://www.wallstreethorizon.com/company-overview), [Earnings calendar](https://www.wallstreethorizon.com/earnings-calendar).

Verdict: best specialist add-on when event accuracy matters more than keeping the stack all-in-one. Target for Tier 3.

---

## Free And Compliant Workarounds

| Pattern | Status | Why |
| --- | --- | --- |
| SEC submissions / companyfacts APIs and bulk ZIPs | `allowed` | Official, high-trust, machine-readable, excellent for US filings/fundamentals |
| SEC company-search RSS feeds | `allowed` | Official alerting path for recent filing activity |
| Company IR RSS autodiscovery | `allowed` | Public company-authored disclosures, often the fastest free event source outside SEC |
| Exchange announcement feeds | `allowed` | Official when feed exists; now populated for 10 EU exchanges |
| Public RSS / Atom feeds from financial publishers and newswires | `allowed` | Cheap and cacheable, especially when used as supporting evidence rather than sole truth |
| Public HTML scrape where robots and ToS checks pass | `allowed with caution` | Acceptable only as a transparent, throttled fallback with strict domain policy |
| Stooq CSV fallback | `allowed with caution` | Useful EOD backstop, but still public-web quality |
| Yahoo-derived `yfinance` / Yahoo public web calls | `use carefully` | Convenient and broad, but unofficial and operationally fragile |
| Free-tier commercial APIs with tiny quotas | `use carefully` | Fine for warmups, symbol-level checks, or prototypes; weak for full-universe production |
| Session-cookie replay / private API usage / pretending to be a logged-in user | `rejected` | Operationally fragile, legally weak, and exactly the wrong habit for a product that needs dependable data |

---

## Concrete Recommendation Table

| Domain | Recommended primary | Recommended secondary | Free fallback | Implementation difficulty | Tier |
| --- | --- | --- | --- | --- | --- |
| US price / OHLCV | `Polygon` | `Alpaca SIP` | `Stooq` → `yfinance` | Medium | 3 |
| US ticker / reference data | `Polygon reference data` | `OpenFIGI` | repo overrides | Low | 3 |
| US fundamentals | `SEC EDGAR/XBRL` ✅ | `Polygon financials/ratios` | `yfinance` ✅ | High | **Done (Tier 1)** |
| EU/global fundamentals + reference | `EODHD` | `Twelve Data` | issuer reports + overrides | Medium | 2 |
| Forward corporate events | `Wall Street Horizon` | `SEC + IR RSS + exchange feeds` ✅ | compliant public calendar pages | Medium | 3 |
| News / catalysts | `Benzinga via Polygon or Alpaca` | `financial_news_rss + company IR RSS` ✅ | Yahoo news | Medium | 2–3 |
| Company / exchange disclosures | `SEC + company IR RSS + exchange feeds` ✅ | `financial_news_rss` ✅ | compliant HTML scrape | Medium | **Done (Tier 1.5)** |
| Security master / ID mapping | `OpenFIGI` ✅ (opt-in) | repo `instrument_master` ✅ | heuristic suffix mapping ✅ | Low | **Done (Tier 1)** |

---

## Suggested Follow-Up Interfaces

The current config shape should eventually split by domain instead of treating "provider" as a single concept. This becomes pressing when Tier 2 adds a second fundamentals provider alongside SEC EDGAR.

Recommended future config/interface additions:

- `market_data.primary`
- `market_data.secondary`
- `fundamentals.primary`
- `fundamentals.secondary`
- `intelligence.sources.official`
- `intelligence.sources.news`
- `intelligence.sources.scrape_fallback`
- `reference_data.primary`
- `reference_data.secondary`
- `security_master.primary`
- `security_master.secondary`

That split will let the app stop pretending one vendor can be the best source for every data domain.
