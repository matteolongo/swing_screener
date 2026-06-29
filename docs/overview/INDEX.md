# Documentation index

> Last reviewed: 2026-06-28.

## Entry points

- [`README.md`](/README.md) — product overview, setup, architecture links, principles
- [`CLAUDE.md`](/CLAUDE.md) — model and contributor conventions (Claude Code)

---

## Product docs

- [`docs/product/DAILY_USAGE_GUIDE.md`](../product/DAILY_USAGE_GUIDE.md) — daily 7-step workflow and trading rules
- [`docs/product/DEGIRO_ORDER_SETUP.md`](../product/DEGIRO_ORDER_SETUP.md) — how to place breakout and pullback orders in DeGiro

---

## Engineering docs

- [`docs/engineering/MODULE_ARCHITECTURE.md`](../engineering/MODULE_ARCHITECTURE.md) — canonical module layout, design rules, screener pipeline, DiagnosableSource protocol
- [`docs/engineering/DATA_SOURCE_AUDIT_AND_PROVIDER_STRATEGY.md`](../engineering/DATA_SOURCE_AUDIT_AND_PROVIDER_STRATEGY.md) — provider tier strategy and gap analysis
- [`docs/engineering/FRAGILE_DATA_ACQUISITION_PATTERNS_AND_SAFE_ALTERNATIVES.md`](../engineering/FRAGILE_DATA_ACQUISITION_PATTERNS_AND_SAFE_ALTERNATIVES.md) — allowed vs rejected data acquisition patterns
- [`docs/engineering/ROADMAP.md`](../engineering/ROADMAP.md) — feature completion table and near-term focus

---

## Layer READMEs

| Layer | Doc | What it covers |
| --- | --- | --- |
| API | [`api/README.md`](/api/README.md) | All REST endpoints, request/response shapes |
| Config | [`config/README.md`](/config/README.md) | Every config file and key |
| Data | [`data/README.md`](/data/README.md) | Runtime state schema, migration history |
| Web UI | [`web-ui/README.md`](/web-ui/README.md) | Pages and routes |
| Web UI guide | [`web-ui/docs/WEB_UI_GUIDE.md`](/web-ui/docs/WEB_UI_GUIDE.md) | Feature directories, shared primitives, workflow |
| Web UI architecture | [`web-ui/docs/WEB_UI_ARCHITECTURE.md`](/web-ui/docs/WEB_UI_ARCHITECTURE.md) | Directory structure, API contract rules, state management |
| Design tokens | [`web-ui/docs/DESIGN_TOKENS.md`](/web-ui/docs/DESIGN_TOKENS.md) | Dark-theme semantic token system, ESLint enforcement |

---

## Module READMEs

| Module | Doc | What it covers |
| --- | --- | --- |
| Intelligence | [`src/swing_screener/intelligence/README.md`](/src/swing_screener/intelligence/README.md) | LLM pipeline, two-call architecture, evidence collectors, caching, action types |
| Data | [`src/swing_screener/data/README.md`](/src/swing_screener/data/README.md) | OHLCV provider config, caching, universes, per-symbol eval cache |
| Data providers | [`src/swing_screener/data/providers/README.md`](/src/swing_screener/data/providers/README.md) | Provider table, how to add/remove a data source |
| Selection | [`src/swing_screener/selection/README.md`](/src/swing_screener/selection/README.md) | Universe filtering, momentum ranking, entry signal detection |
| Strategy | [`src/swing_screener/strategy/README.md`](/src/swing_screener/strategy/README.md) | Plugin architecture, StrategyModule protocol, 18 plugins |
| Risk | [`src/swing_screener/risk/README.md`](/src/swing_screener/risk/README.md) | RiskConfig, position sizing, regime-aware scaling |
| Portfolio | [`src/swing_screener/portfolio/README.md`](/src/swing_screener/portfolio/README.md) | Position/ManageConfig classes, R-multiple tracking, metrics API |
| Execution | [`src/swing_screener/execution/README.md`](/src/swing_screener/execution/README.md) | Order lifecycle, DeGiro fee import |
| Indicators | [`src/swing_screener/indicators/README.md`](/src/swing_screener/indicators/README.md) | Trend, momentum, volatility indicator configs and output columns |
| Reporting | [`src/swing_screener/reporting/README.md`](/src/swing_screener/reporting/README.md) | Daily report, CSV export, today_actions, sector concentration warnings |
| Backtest | [`src/swing_screener/backtest/README.md`](/src/swing_screener/backtest/README.md) | Event-study backtesting, fill model, known limitations |
| Fundamentals providers | [`src/swing_screener/fundamentals/providers/README.md`](/src/swing_screener/fundamentals/providers/README.md) | SEC EDGAR, yfinance, DeGiro fundamentals providers |
| Utils | [`src/swing_screener/utils/README.md`](/src/swing_screener/utils/README.md) | Shared helpers: date, file locking, DataFrame utilities |
