# Web UI Guide

> Status: current.  
> Last reviewed: 2026-07-02.

## Purpose

Daily trading workflow through the Swing Screener web interface.

## Navigation & Routes

Sidebar has five primary areas: Today · Screener · Calendar · Book · System.

| Page | Route | Purpose |
|------|-------|---------|
| Today | `/today` | Action Inbox — no tabs. Daily-review buckets flattened into one prioritized queue — close → update-stop → exit-signal → stale-order → add-on → new → watch → weekly-review. Each row carries severity dots, badgeMap-driven type badges, R-multiple readouts (`RChip`), and inline action buttons (close / apply-stop / update-stop / cancel-order / plan-order / analyze). Each row has an expandable "why" section. Keyboard nav: `j`/`k` to move between rows. Cold load shows a 4-row skeleton; zero state reads "Nothing to do. No signals — do nothing." and stamps the as-of time with a refresh button. Below the queue: `PositionsMiniCard` (collapsible card of held positions — RChip, days held, time-stop/exhaustion/earnings badges, Trim badge, P&L%) and `CalendarPeekCard` (7-day peek at position events and catalysts; links to Calendar). Click any symbol row to open the global symbol analysis drawer (880px, permalink "open ↗" in the drawer header, Overview / Fundamentals / Order / Backtest tabs; Backtest runs a per-symbol event study inline). For a held symbol the Order tab is hidden (unless a fresh add-on entry signal exists) and position management is folded into Overview. Removed: `WeeklyReviewNudge` and `PendingOrdersBadge` banners (weekly nudge is now the bottom inbox row; pending-order staleness is surfaced as inbox rows). |
| Screener | `/screener` (with `?tab=candidates\|watchlist`) | Standalone full-width page, split out of the old Today tabs. **Candidates tab** (`ScreenerPanel`): run/re-run the screener against the taxonomy-filtered symbol pool (`QuickFilterBar` — region/cap/type/sector/index — plus a collapsible panel for currency/exchange/OTC/price), review ranked candidates, open the global symbol drawer from any row. The running indicator reflects the real backend job status (`queued`/`running`). **Watchlist tab** (`WatchlistPipelinePanel`): watchlist CRUD and pipeline state. |
| Symbol | `/symbol/:ticker` | Full-page symbol analysis (local tab state, same content/tabs as drawer). Permalink target; accessible via the drawer header's "open ↗" link or direct navigation. |
| Calendar | `/calendar` | Earnings calendar, upcoming catalyst events |
| Book | `/book` (with `?tab=positions\|orders\|journal\|performance\|review`) | Five tabs on the shared `Tabs` primitive, tab state kept in the URL: open positions (stop updates, partial close, trail config), pending orders (create, fill, cancel), trade journal, performance analytics, and weekly review |
| Pool | `/system/pool` | Universe management, manual refresh, benchmark, symbol discovery with ad-hoc screener run (row click opens the global symbol drawer). **Pool tab**: refresh-all-universes, rebuild symbol pool, and enrich taxonomy — each with a field-level diff table (`PoolTab` / `PoolDiffTable` / `UniverseRefreshSummary`) |
| Strategy | `/system/strategy` | Strategy CRUD, activation, and validation. Read-only strategy chip moved from header to StatusBar; switching strategies happens here. |
| Data Sources | `/system/datasources` | Data source diagnostics: inventory of all sources with configured/probeable status, per-source Test button (fires a live canary probe), Test All (concurrent probe of all probeable sources), and a fallback event feed. One intelligence source is probeable: `sec_edgar_catalysts`. |

`/system` (index) redirects to `/system/pool` — a nested-route default, not a legacy-URL redirect.

**Old-path redirects:** `/universes` → `/system/pool`, `/datasources` → `/system/datasources`, `/strategy` → `/system/strategy`, `/settings` → `/system/strategy`.

## Feature Directory Map

Each domain has a directory under `web-ui/src/features/<domain>/` with `api.ts` (fetch functions), `hooks.ts` (React Query hooks), and types.

| Feature dir | Feeds page(s) | Domain |
|---|---|---|
| `features/portfolio` | Book | Positions: CRUD, stop updates, partial close, trail method |
| `features/orders` | Book | Order lifecycle: create, fill, cancel |
| `features/screener` | Screener | Screener run, candidates, recurrence state. The screener filters the unified symbol pool by taxonomy (`taxonomyFilter` + `preset`) via `QuickFilterBar` (region/cap/type/sector/index) above the table; currency/exchange/OTC/price stay in the collapsible panel. The `universe` field is a deprecated index-membership alias. |
| `features/pool` | Screener (filter bar), StatusBar (review queue), System/Pool tab | Taxonomy presets, pool browse, and review-queue health. `QuickFilterBar` consumes presets; `components/domain/pool/ReviewQueueDrawer` + the StatusBar badge surface symbols that repeatedly failed OHLCV fetch (Keep restores, Remove drops the queue entry). `admin.ts` + `adminHooks.ts` drive the Pool tab's rebuild/enrich/refresh-all operations. |
| `features/intelligence` | Symbol drawer, Symbol page | Symbol analysis (LLM), cached results, sweep, pre-open gap outlook, thesis-delta, analysis-history timeline. Runs on-demand only (explicit button click) — never auto-run. |
| `features/watchlist` | Screener (Watchlist tab) | Watchlist CRUD |
| `features/dailyReview` | Today | Daily review compute and structured result; powers the Today Action Inbox (`buildInboxItems`) |
| `features/analytics` | Book (Performance tab) | Regime breakdown, performance stats. Embedded via `AnalyticsPage`; no standalone route. |
| `features/fundamentals` | Symbol drawer, Symbol page | Fundamental snapshots used by the symbol analysis panels. The `useSymbolFundamentalsSync` hook syncs fundamentals across the drawer and full-page views. The standalone Research/Fundamentals comparison page and its `compare`/`warmup` hooks were removed. |
| `features/calendar` | Calendar | Calendar events |
| `features/weeklyReview` | Book | Weekly review CRUD |
| `features/strategy` | Strategy | Strategy CRUD and activation |
| `features/universes` | System → Pool (`/system/pool`) | Universe list, detail, refresh, benchmark |
| `features/backtest` | Symbol drawer (Backtest tab) | Event-study run (202+poll), trade ledger + metrics, snake_case→camelCase transform. Run inline per-symbol from the symbol drawer's Backtest tab (`components/domain/workspace/SymbolBacktestTab`, locked to the selected symbol); results render via `components/domain/backtest/BacktestResults`. No standalone page |
| `features/datasources` | Data Sources | Source inventory, per-source and bulk probe, fallback event feed |
| `features/config` | (cross-cutting) | App config read/write |

Charts (`components/domain/market/`): `CandleChart` is a responsive hand-rolled SVG candlestick chart (bodies + wicks + volume bars + pattern markers with i18n tooltips + a rebased benchmark comparison line). `CachedSymbolCandleChart` wraps it, sourcing OHLCV bars, detected patterns, and the benchmark series from the cached screener result by ticker, and adds a time-range selector (`1W`/`1M`/`3M`/`6M`/`1Y`/`MAX`, default `MAX`) plus a fullscreen overlay. It is used in the full symbol views (`SymbolAnalysisContent`, rendered by both the global `SymbolDrawer` and the `/symbol/:ticker` page); range slicing reuses `features/screener/priceHistory.ts`. The older close-only `CachedSymbolPriceChart` was removed.

**StatusBar** (replaces Header): read-only strategy chip now lives here with equity/P&L/risk segments and freshness badge. Strategy switching moved to the `/system/strategy` page.

Symbol analysis overview (`components/domain/workspace/SymbolAnalysisContent.tsx`, overview tab): one screener-owned verdict at the top (`AnalysisDecisionStrip` — action, conviction, trade plan), then a unified `DecisionWhyPanel` ("What to do / Why now / Watch for", enriched by the AI summary line when present) and a compact `FundamentalsStrip` (P/E, revenue growth, gross margin, valuation). For a held symbol a `ManagePositionPanel` is folded in here (Update stop / Scale out / Exit / Check live, reusing the existing position hooks/modals; Add-to-position only when a fresh `BUY_*` signal exists, which routes to the Order tab) and `AnalysisDecisionStrip` shows the real position entry/stop/target rather than the fresh-setup close. Below those sits the AI analysis (`NarrativeAnalysisCard`) as enrichment — it no longer shows a competing verdict banner; when the AI's action differs from the screener's it renders an inline "second opinion" note (suppressed in position/manage-only mode, where the two verdicts sit on different axes). `NarrativeAnalysisCard` also renders a prominent **pre-open outlook** card (gap direction + magnitude + overnight driver + at-open/stop-gap actions, only when the US market is pre-open), a **thesis-delta** badge in the decision-focus block ("since last analysis": confirmed/weakening/invalidated), and a collapsible **analysis-history timeline** fed by `useIntelligenceHistoryQuery` (`GET /api/intelligence/{ticker}/history`). Technical detail (chart + `TechnicalMetricsGrid`) follows underneath.

## Shared primitives

Reusable building blocks live in `components/common/`. Prefer these over hand-rolling markup so styling and behavior stay in one place (colors come from the semantic tokens in `docs/DESIGN_TOKENS.md`, enforced by the ESLint token rule).

| Primitive | Use for |
|---|---|
| `Field` | Label + optional hint/error wrapper. Generates an id via `useId` and associates the label with a nested `Input`/`Select`/`Textarea`, so controls get a real accessible name instead of a loose `aria-label`. |
| `Input` / `Select` / `Textarea` | Form controls carrying the canonical `CONTROL_CLASS` (exported from `Input`). `forwardRef`, spread all native props, auto-wire `id` from the surrounding `Field`. Pass only deviations (width, alignment) via `className`. |
| `CollapsibleSection` | Progressive disclosure. Native `<details>` + chevron, token-styled; `title`, optional `meta`, `defaultOpen`. Used by the Strategy advanced panel and the System/Pool discovery filters. |
| `Tabs` | Underline-style tab strip driven by `tabs`/`active`/`onChange` props (no built-in keyboard navigation). Consumers: `SymbolDrawer` (Overview / Fundamentals / Order / Backtest tabs) and `/symbol/:ticker` page; the Screener page (Candidates / Watchlist, tab state in the URL); the Book page (Positions / Orders / Journal / Performance / Review, tab state in the URL). |
| `StatusDot` | Indicator dot for status states (`ok` / `warn` / `down` / `idle` tones). Compact visual for health/state signals in tables and pills. |
| `CollapsibleCard` | Compact disclosure card combining header + content; alternative to `CollapsibleSection` for card-based layouts. |
| `PageHeader` | Page top chrome: title, description, optional action buttons. Standardizes layout for System pages. |
| `Drawer` | Slide-out panel (typically from the right). Consumer: `SymbolDrawer` (880px, mounted globally in `MainLayout`, driven by `workspaceStore.selectedTicker`; hardened focus/scroll-lock/topmost-Escape). |
| `StatsTable` | Presentational 5-column stats table (label + Trades/WinRate/AvgR/Expectancy). Backs `EdgeBreakdownTable` and `RegimeBreakdownTable`; takes translated headers + rows. |
| `RChip` | R-multiple readout: `formatR` + sign color (`getSignColorClass`) in tabular mono. |
| `Card` / `Button` / `Badge` / `ModalShell` / `TableShell` / `DataTable` | Layout and table chrome. |
| `lib/badgeMap` | Enum-to-badge specs mapper. Maps status/severity enums to `{ variant, labelKey }` for consistent visual communication (no icon field). |

Not every control fits a primitive: checkboxes, radios, range sliders, search boxes with custom layouts, and inline table-edit inputs stay hand-rolled.

## Typical Workflow

1. Start API and web UI.
2. **Today** — work the Action Inbox: review the prioritized queue from the daily review, check pending-order staleness, trigger symbol analysis from the drawer.
3. **Screener** — run the screener, review ranked candidates, track the Watchlist tab.
4. Create orders via **Book**.
5. Next trading day: fill orders and update stops in **Book**.

Full timing guidance: `docs/product/DAILY_USAGE_GUIDE.md`.

## Testing

- Run `npx vitest run && npm run typecheck && npm run lint && npm run build` before any commit (full gate). `npm test` is watch mode for development.
- Use `renderWithProviders()` for component tests (wraps React Query + Zustand).
- Mock API calls with MSW handlers in `web-ui/src/test/mocks/handlers.ts`.
- Assert user-facing copy via i18n keys (`web-ui/src/i18n/`), not hardcoded strings.
- Coverage thresholds enforced: 80%+ lines, 75%+ branches.

## i18n dead-key cleanup

The Phase 7 sweep that pruned the stale key groups left behind by the Today Action Inbox rewrite and banner removals (old action list, pending-orders badge, weekly-review nudge, daily-review banner) is complete.
