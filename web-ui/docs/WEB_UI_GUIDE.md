# Web UI Guide

> Status: current.  
> Last reviewed: 2026-06-01.

## Purpose

Daily trading workflow through the Swing Screener web interface.

## Pages

| Page | Route | Purpose |
|------|-------|---------|
| Today | `/today` | Left panel with three tabs — Today (open positions, daily review, pending orders), Last Run (screener candidates), Watchlist — plus the symbol analysis canvas on the right (Overview / Fundamentals / Order / Backtest tabs; the Backtest tab runs a per-symbol event study inline) |
| Calendar | `/calendar` | Earnings calendar, upcoming catalyst events |
| Book | `/book` | Open positions: stop updates, partial close, trail config; order management: create, fill, cancel; trade journal; performance analytics; weekly review |
| Universes | `/universes` | Universe management, manual refresh, benchmark, symbol discovery with ad-hoc screener run (row click opens symbol detail modal) |
| Strategy | `/strategy` | Strategy CRUD, activation, and validation |
| Onboarding | `/onboarding` | Setup guide for new users |

## Feature Directory Map

Each domain has a directory under `web-ui/src/features/<domain>/` with `api.ts` (fetch functions), `hooks.ts` (React Query hooks), and types.

| Feature dir | Feeds page(s) | Domain |
|---|---|---|
| `features/portfolio` | Book | Positions: CRUD, stop updates, partial close, trail method |
| `features/orders` | Book, Today | Order lifecycle: create, fill, cancel |
| `features/screener` | Today | Screener run, candidates, recurrence state |
| `features/intelligence` | Today | Symbol analysis (LLM), cached results, sweep |
| `features/watchlist` | Today | Watchlist CRUD (Watchlist tab) |
| `features/dailyReview` | Today | Daily review compute and structured result |
| `features/analytics` | Analytics | Regime breakdown, performance stats |
| `features/fundamentals` | Today (symbol analysis) | Fundamental snapshots used by the symbol analysis panels. The standalone Research/Fundamentals comparison page was removed; the `compare`/`warmup` hooks are now unused and pending cleanup. |
| `features/calendar` | Calendar | Calendar events |
| `features/weeklyReview` | Book | Weekly review CRUD |
| `features/strategy` | Strategy | Strategy CRUD and activation |
| `features/universes` | Universes | Universe list, detail, refresh, benchmark |
| `features/backtest` | Today (canvas Backtest tab) | Event-study run (202+poll), trade ledger + metrics, snake_case→camelCase transform. Run inline per-symbol from the analysis canvas Backtest tab (`components/domain/workspace/SymbolBacktestTab`, locked to the selected symbol); results render via `components/domain/backtest/BacktestResults`. No standalone page |
| `features/config` | (cross-cutting) | App config read/write |
| `features/persistence` | (cross-cutting) | API vs localStorage mode toggle |

Charts (`components/domain/market/`): `CandleChart` is a responsive hand-rolled SVG candlestick chart (bodies + wicks + volume bars + pattern markers with i18n tooltips + a rebased benchmark comparison line). `CachedSymbolCandleChart` wraps it, sourcing OHLCV bars, detected patterns, and the benchmark series from the cached screener result by ticker, and adds a time-range selector (`1W`/`1M`/`3M`/`6M`/`1Y`/`MAX`, default `MAX`) plus a fullscreen overlay. It is used in the full symbol views (`SymbolViewModal`, `SymbolAnalysisContent`); range slicing reuses `features/screener/priceHistory.ts`. The older close-only `CachedSymbolPriceChart` was removed.

Symbol analysis overview (`components/domain/workspace/SymbolAnalysisContent.tsx`, overview tab): one screener-owned verdict at the top (`AnalysisDecisionStrip` — action, conviction, trade plan), then a unified `DecisionWhyPanel` ("What to do / Why now / Watch for", enriched by the AI summary line when present) and a compact `FundamentalsStrip` (P/E, revenue growth, gross margin, valuation). Below those sits the AI analysis (`NarrativeAnalysisCard`) as enrichment — it no longer shows a competing verdict banner; when the AI's action differs from the screener's it renders an inline "second opinion" note. Technical detail (chart + `TechnicalMetricsGrid`) follows underneath.

## Shared primitives

Reusable building blocks live in `components/common/`. Prefer these over hand-rolling markup so styling and behavior stay in one place (colors come from the semantic tokens in `docs/DESIGN_TOKENS.md`, enforced by the ESLint token rule).

| Primitive | Use for |
|---|---|
| `Field` | Label + optional hint/error wrapper. Generates an id via `useId` and associates the label with a nested `Input`/`Select`/`Textarea`, so controls get a real accessible name instead of a loose `aria-label`. |
| `Input` / `Select` / `Textarea` | Form controls carrying the canonical `CONTROL_CLASS` (exported from `Input`). `forwardRef`, spread all native props, auto-wire `id` from the surrounding `Field`. Pass only deviations (width, alignment) via `className`. |
| `CollapsibleSection` | Progressive disclosure. Native `<details>` + chevron, token-styled; `title`, optional `meta`, `defaultOpen`. Used by the Strategy advanced panel and the Universes discovery filters. |
| `StatsTable` | Presentational 5-column stats table (label + Trades/WinRate/AvgR/Expectancy). Backs `EdgeBreakdownTable` and `RegimeBreakdownTable`; takes translated headers + rows. |
| `RChip` | R-multiple readout: `formatR` + sign color (`getSignColorClass`) in tabular mono. |
| `Card` / `Button` / `Badge` / `ModalShell` / `TableShell` / `DataTable` | Layout and table chrome. |

Not every control fits a primitive: checkboxes, radios, range sliders, search boxes with custom layouts, and inline table-edit inputs stay hand-rolled.

## Typical Workflow

1. Start API and web UI.
2. **Today** — compute daily review and check pending orders (Today tab), run the screener and review candidates (Last Run tab), trigger symbol analysis, track the Watchlist tab.
3. Create orders via **Book**.
4. Next trading day: fill orders and update stops in **Book**.

Full timing guidance: `docs/product/DAILY_USAGE_GUIDE.md`.

## Testing

- Run `npm test` before and after any change.
- Use `renderWithProviders()` for component tests (wraps React Query + Zustand).
- Mock API calls with MSW handlers in `web-ui/src/test/mocks/handlers.ts`.
- Assert user-facing copy via i18n keys (`web-ui/src/i18n/`), not hardcoded strings.
- Coverage thresholds enforced: 80%+ lines, 75%+ branches.
