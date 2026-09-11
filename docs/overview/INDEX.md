# Documentation index

> Last reviewed: 2026-06-28.

## Entry points

- [`README.md`](/README.md) — product overview, setup, architecture links, principles
- [`AGENTS.md`](/AGENTS.md) — contributor conventions and release policy
- [`CHANGELOG.md`](/CHANGELOG.md) — versioned release notes

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
- [`docs/engineering/specs/2026-07-21-lightweight-versioning-design.md`](../engineering/specs/2026-07-21-lightweight-versioning-design.md) — approved lightweight Semantic Versioning design
- [`docs/engineering/plans/2026-07-21-lightweight-versioning.md`](../engineering/plans/2026-07-21-lightweight-versioning.md) — implementation plan for lightweight release versioning

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
| Intelligence | [`src/swing_screener/intelligence/README.md`](/src/swing_screener/intelligence/README.md) | LLM pipeline diagrams, data/source map, prompt flow, observability, evidence collectors, caching, action types |
| Analysis | [`src/swing_screener/analysis/README.md`](/src/swing_screener/analysis/README.md) | Advisory single-symbol analysis engines, including approximate volume-zone analysis |
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

## Current implementation plans

- [`docs/superpowers/specs/2026-09-04-reporting-pipeline-remediation-design.md`](../superpowers/specs/2026-09-04-reporting-pipeline-remediation-design.md) — approved ownership, contracts, and 18-PR delivery design for backend reporting-pipeline remediation
- [`docs/superpowers/plans/2026-09-04-reporting-pipeline-remediation-roadmap.md`](../superpowers/plans/2026-09-04-reporting-pipeline-remediation-roadmap.md) — merge-order roadmap linking the seven subsystem implementation plans
- [`docs/superpowers/plans/2026-09-04-risk-plan-correctness.md`](../superpowers/plans/2026-09-04-risk-plan-correctness.md) — PR plans for structural targets and executable position sizing
- [`docs/superpowers/plans/2026-09-04-cache-freshness.md`](../superpowers/plans/2026-09-04-cache-freshness.md) — stacked PR plans for evaluation and final-close market-data freshness
- [`docs/superpowers/plans/2026-09-04-currency-contract.md`](../superpowers/plans/2026-09-04-currency-contract.md) — stacked PR plans for currency metadata, authoritative account FX, and monetary fields
- [`docs/superpowers/plans/2026-09-04-reporting-contract.md`](../superpowers/plans/2026-09-04-reporting-contract.md) — PR plans for stable report schemas and concentration semantics
- [`docs/superpowers/plans/2026-09-04-order-daily-review.md`](../superpowers/plans/2026-09-04-order-daily-review.md) — PR plans for order safety, daily-review errors, stateless state, and persistence
- [`docs/superpowers/plans/2026-09-04-ranking-data-signals.md`](../superpowers/plans/2026-09-04-ranking-data-signals.md) — PR plans for rank provenance, OHLCV normalization, and signal windows
- [`docs/superpowers/plans/2026-09-04-configuration-cleanup.md`](../superpowers/plans/2026-09-04-configuration-cleanup.md) — stacked PR plans for runtime configuration and ownership cleanup
- [`docs/superpowers/specs/2026-07-27-symbol-workspace-redesign-design.md`](../superpowers/specs/2026-07-27-symbol-workspace-redesign-design.md) — approved UX, data-flow, reliability, and testing design for the Today-page symbol workspace
- [`docs/superpowers/plans/2026-07-27-symbol-workspace-redesign.md`](../superpowers/plans/2026-07-27-symbol-workspace-redesign.md) — task-by-task implementation plan for the Today-page symbol workspace redesign
- [`docs/superpowers/specs/2026-07-22-coherent-execution-workflow-design.md`](../superpowers/specs/2026-07-22-coherent-execution-workflow-design.md) — approved design for the coherent execution workflow
- [`docs/superpowers/plans/2026-07-22-coherent-execution-workflow.md`](../superpowers/plans/2026-07-22-coherent-execution-workflow.md) — implementation plan for the coherent execution workflow
- [`docs/superpowers/plans/2026-07-07-volume-zone-analysis/spec.md`](../superpowers/plans/2026-07-07-volume-zone-analysis/spec.md) — approved design for Volume-Zone Stock Analysis V1
- [`docs/superpowers/plans/2026-07-07-volume-zone-analysis/plan.md`](../superpowers/plans/2026-07-07-volume-zone-analysis/plan.md) — task-by-task implementation plan for Volume-Zone Stock Analysis V1
