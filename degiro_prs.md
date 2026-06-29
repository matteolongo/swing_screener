# DeGiro integration PRs

Six stacked PRs, merge in order. Each branch is based on the one before it.

---

## PR 1: Restore DeGiro integration layer

**Title:** `Add DeGiro integration layer (credentials + client)`

**Branch:** `worktree-feat+degiro-integration-core`
**Base:** `main`
**Compare:** https://github.com/matteolongo/swing_screener/compare/main...worktree-feat+degiro-integration-core?expand=1

**Description:**

Creates `src/swing_screener/integrations/degiro/{credentials,client}.py`, which were missing (only `__pycache__` bytecodes remained). These are the two modules `_degiro_integration_available()` checks for, so without them the entire provider chain was short-circuiting to yfinance for all EU equities.

`credentials.py` loads `DEGIRO_USERNAME`, `DEGIRO_PASSWORD`, and optionally `DEGIRO_INT_ACCOUNT` / `DEGIRO_TOTP_SECRET` from env vars. `client.py` is a thin session wrapper around `degiro_connector.trading.API` that exposes `connect()`, `disconnect()`, and `.api`.

Also adds `degiro-connector>=3.0.35` to `pyproject.toml` dependencies (was installed system-wide but not declared).

---

## PR 2: Populate company name, sector, and currency from DeGiro profile API

**Title:** `Populate company_name, sector, currency via DeGiro get_company_profile`

**Branch:** `feat/degiro-company-profile`
**Base:** `worktree-feat+degiro-integration-core`
**Compare:** https://github.com/matteolongo/swing_screener/compare/worktree-feat+degiro-integration-core...feat/degiro-company-profile?expand=1

**Description:**

`DegiroFundamentalsProvider.fetch_record()` was leaving `company_name`, `sector`, and `currency` as `None` with a comment "available via `get_company_profile` if needed". This PR makes that call and fills those three fields.

Also adds a note to `src/swing_screener/intelligence/README.md` documenting that DeGiro's `EarningsCalendar` agenda API is available but not implemented yet, including the exact shape of the call to make it easy to pick up later.

---

## PR 3: Add historical revenue and net income from DeGiro financial statements

**Title:** `Add actual historical revenue/net income series from DeGiro financial statements`

**Branch:** `feat/degiro-financial-statements`
**Base:** `feat/degiro-company-profile`
**Compare:** https://github.com/matteolongo/swing_screener/compare/feat/degiro-company-profile...feat/degiro-financial-statements?expand=1

**Description:**

Extends `fetch_record()` with a `get_financial_statements(isin)` call. Populates `historical_series["revenue"]` and `historical_series["net_income"]` from the actual annual P&L figures (up to 7 years), alongside the existing analyst estimate series that were already there.

The `_estimate_item()` helper is reused to extract `SAL` and `NINC` codes from the statements structure. Values from DeGiro are in millions, so they're multiplied by `1_000_000` to match the `currency` unit convention in `FundamentalMetricSeries`.

---

## PR 4: Add DeGiro news collector for EU intelligence evidence

**Title:** `Add DegiroNewsCollector for EU intelligence evidence`

**Branch:** `feat/degiro-news-collector`
**Base:** `feat/degiro-financial-statements`
**Compare:** https://github.com/matteolongo/swing_screener/compare/feat/degiro-financial-statements...feat/degiro-news-collector?expand=1

**Description:**

Creates `src/swing_screener/intelligence/evidence/collectors/degiro_news.py`, which fetches company news via `get_news_by_company(isin)` and maps results to `SourceEvidence`. This fills the gap where EU tickers were getting zero news context in the LLM prompt (Polygon is US-biased, SEC EDGAR is US-only).

ISIN resolution reuses the existing `_load_isin_map()` from the fundamentals provider, so any ticker with an entry in `data/degiro/isin_map.json` gets coverage automatically. The client is lazily instantiated and module-level cached to avoid reconnecting per analysis.

`degiro_news` is wired into `collect.py`'s `_COLLECTORS` dict, added to `EvidenceConfig.enabled_sources` defaults, and registered in `DatasourcesService._PROBEABLE` so it appears in the datasources inventory. Test updated accordingly.

---

## PR 5: Add POST /portfolio/sync-degiro holdings reconciliation endpoint

**Title:** `Add DeGiro portfolio sync endpoint`

**Branch:** `feat/degiro-holdings-sync`
**Base:** `feat/degiro-news-collector`
**Compare:** https://github.com/matteolongo/swing_screener/compare/feat/degiro-news-collector...feat/degiro-holdings-sync?expand=1

**Description:**

Adds `POST /api/portfolio/sync-degiro`. Fetches the live DeGiro portfolio via `get_update(PORTFOLIO)`, enriches each holding with product info (`get_products_info`), then compares against open positions in `positions.json`. Returns the full list of DeGiro holdings and flags which tickers are not yet registered locally.

Side-effect: calls `update_isin_map_from_audit()` with the enriched ticker/ISIN pairs, which feeds both the fundamentals provider and the news collector going forward.

Positions are not created automatically. The `CreatePositionRequest` requires `stop_price`, which only the user can set, so unregistered holdings are surfaced as candidates to register via the existing `POST /positions` endpoint.

---

## PR 6: Add dividend calendar proximity signal

**Title:** `Add DeGiro dividend calendar proximity signal to intelligence enrichment`

**Branch:** `feat/degiro-dividend-calendar`
**Base:** `feat/degiro-holdings-sync`
**Compare:** https://github.com/matteolongo/swing_screener/compare/feat/degiro-holdings-sync...feat/degiro-dividend-calendar?expand=1

**Description:**

Adds `days_to_dividend`, `next_dividend_date`, and `next_dividend_amount` to `SymbolIntelligenceRequest`. `api/services/portfolio/degiro_dividend.py` fetches `get_agenda(DividendCalendar, isin=..., window=90d)` and returns a `DividendProximity` model with the nearest upcoming ex-date.

Wired into `enrich_intelligence_request()` as a new `dividend` callback (same pattern as `earnings`), and passed into all three call sites in `api/routers/intelligence.py`: sweep, single-ticker analysis, and position analysis. ISIN is resolved from `isin_map.json` before the DeGiro API call, so the lookup is a no-op when credentials aren't configured or the ticker isn't in the map.

Particularly useful for EU stocks where free dividend calendar data is sparse or absent.
