# Web UI Guide

> Status: current.  
> Last reviewed: 2026-06-01.

## Purpose

Daily trading workflow through the Swing Screener web interface.

## Pages

| Page | Route | Purpose |
|------|-------|---------|
| Today | `/today` | Compute daily review, check pending orders, open risk summary |
| Calendar | `/calendar` | Earnings calendar, upcoming catalyst events |
| Book | `/book` | Open positions: stop updates, partial close, trail config; order management: create, fill, cancel |
| Research | `/research` | Screener run and candidates, symbol intelligence analysis, watchlist |
| Universes | `/universes` | Universe management, manual refresh, benchmark, symbol discovery with ad-hoc screener run (row click opens symbol detail modal) |
| Strategy | `/strategy` | Strategy CRUD, activation, and validation |
| Journal | `/journal` | Weekly reviews and trade log |
| Onboarding | `/onboarding` | Setup guide for new users |
| Analytics | `/analytics` | Regime breakdown and performance analytics |
| Fundamentals | `/fundamentals` | Fundamental data browser: snapshot, compare, warmup |

## Feature Directory Map

Each domain has a directory under `web-ui/src/features/<domain>/` with `api.ts` (fetch functions), `hooks.ts` (React Query hooks), and types.

| Feature dir | Feeds page(s) | Domain |
|---|---|---|
| `features/portfolio` | Book | Positions: CRUD, stop updates, partial close, trail method |
| `features/orders` | Book, Today | Order lifecycle: create, fill, cancel |
| `features/screener` | Research | Screener run, candidates, recurrence state |
| `features/intelligence` | Research | Symbol analysis (LLM), cached results, sweep |
| `features/watchlist` | Research | Watchlist CRUD |
| `features/dailyReview` | Today | Daily review compute and structured result |
| `features/analytics` | Analytics | Regime breakdown, performance stats |
| `features/fundamentals` | Fundamentals | Fundamental snapshots, compare, warmup job |
| `features/calendar` | Calendar | Calendar events |
| `features/weeklyReview` | Journal | Weekly review CRUD |
| `features/strategy` | Strategy | Strategy CRUD and activation |
| `features/universes` | Universes | Universe list, detail, refresh, benchmark |
| `features/config` | (cross-cutting) | App config read/write |
| `features/persistence` | (cross-cutting) | API vs localStorage mode toggle |

Charts (`components/domain/market/`): `CandleChart` is a responsive hand-rolled SVG candlestick chart (bodies + wicks + volume bars + pattern markers with i18n tooltips + a rebased benchmark comparison line). `CachedSymbolCandleChart` wraps it, sourcing OHLCV bars, detected patterns, and the benchmark series from the cached screener result by ticker, and adds a time-range selector (`1W`/`1M`/`3M`/`6M`/`1Y`/`MAX`, default `MAX`) plus a fullscreen overlay. It is used in the full symbol views (`WorkspaceSymbolModal`, `SymbolAnalysisContent`); range slicing reuses `features/screener/priceHistory.ts`. The older close-only `CachedSymbolPriceChart` was removed.

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
2. **Today** — compute daily review, check pending orders.
3. **Research** — run screener, review candidates, trigger intelligence analysis.
4. Create orders via **Book**.
5. Next trading day: fill orders and update stops in **Book**.

Full timing guidance: `docs/product/DAILY_USAGE_GUIDE.md`.

## Testing

- Run `npm test` before and after any change.
- Use `renderWithProviders()` for component tests (wraps React Query + Zustand).
- Mock API calls with MSW handlers in `web-ui/src/test/mocks/handlers.ts`.
- Assert user-facing copy via i18n keys (`web-ui/src/i18n/`), not hardcoded strings.
- Coverage thresholds enforced: 80%+ lines, 75%+ branches.
