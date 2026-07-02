# Web UI Guide

> Status: current.  
> Last reviewed: 2026-07-02.

## Purpose

Daily trading workflow through the Swing Screener web interface.

## Navigation & Routes

Sidebar has four primary areas: Today · Calendar · Book · System.

| Page | Route | Purpose |
|------|-------|---------|
| Today | `/today` | Single full-width column with three tabs. **Today tab (Action Inbox)**: daily-review buckets flattened into one prioritized queue — close → update-stop → exit-signal → stale-order → add-on → new → watch → weekly-review. Each row carries severity dots, badgeMap-driven type badges, R-multiple readouts (`RChip`), and inline action buttons (close / apply-stop / update-stop / cancel-order / plan-order / analyze). Each row has an expandable "why" section. Keyboard nav: `j`/`k` to move between rows. Cold load shows a 4-row skeleton; zero state reads "Nothing to do. No signals — do nothing." and stamps the as-of time with a refresh button. Below the queue: `PositionsMiniCard` (compact card collapsing held positions — RChip, days held, time-stop/exhaustion/earnings badges, Trim badge, P&L%) and `CalendarPeekCard` (7-day peek at position events and catalysts; links to Calendar). **Last Run tab** and **Watchlist tab** unchanged. Click any symbol row to open the global symbol analysis drawer (880px, permalink "open ↗" in the drawer header, Overview / Fundamentals / Order / Backtest tabs; Backtest runs a per-symbol event study inline). For a held symbol the Order tab is hidden (unless a fresh add-on entry signal exists) and position management is folded into Overview. Removed: `WeeklyReviewNudge` and `PendingOrdersBadge` banners (weekly nudge is now the bottom inbox row; pending-order staleness is surfaced as inbox rows). |
| Symbol | `/symbol/:ticker` | Full-page symbol analysis (local tab state, same content/tabs as drawer). Permalink target; accessible via the drawer header's "open ↗" link or direct navigation. |
| Calendar | `/calendar` | Earnings calendar, upcoming catalyst events |
| Book | `/book` | Open positions: stop updates, partial close, trail config; order management: create, fill, cancel; trade journal; performance analytics; weekly review |
| Pool | `/system/pool` | Universe management, manual refresh, benchmark, symbol discovery with ad-hoc screener run (row click opens the global symbol drawer). **Pool tab**: refresh-all-universes, rebuild symbol pool, and enrich taxonomy — each with a field-level diff table (`PoolTab` / `PoolDiffTable` / `UniverseRefreshSummary`) |
| Strategy | `/system/strategy` | Strategy CRUD, activation, and validation. Read-only strategy chip moved from header to StatusBar; switching strategies happens here. |
| Data Sources | `/system/datasources` | Data source diagnostics: inventory of all sources with configured/probeable status, per-source Test button (fires a live canary probe), Test All (concurrent probe of all probeable sources), and a fallback event feed. One intelligence source is probeable: `sec_edgar_catalysts`. |

**Old-path redirects:** `/universes` → `/system/pool`, `/datasources` → `/system/datasources`, `/strategy` → `/system/strategy`, `/settings` → `/system/strategy`.

## Feature Directory Map

Each domain has a directory under `web-ui/src/features/<domain>/` with `api.ts` (fetch functions), `hooks.ts` (React Query hooks), and types.

| Feature dir | Feeds page(s) | Domain |
|---|---|---|
| `features/portfolio` | Book | Positions: CRUD, stop updates, partial close, trail method |
| `features/orders` | Book, Today | Order lifecycle: create, fill, cancel |
| `features/screener` | Today | Screener run, candidates, recurrence state. The screener filters the unified symbol pool by taxonomy (`taxonomyFilter` + `preset`) via `QuickFilterBar` (region/cap/type/sector/index) above the table; currency/exchange/OTC/price stay in the collapsible panel. The `universe` field is a deprecated index-membership alias. |
| `features/pool` | Today (filter bar), StatusBar (review queue), System/Pool tab | Taxonomy presets, pool browse, and review-queue health. `QuickFilterBar` consumes presets; `components/domain/pool/ReviewQueueDrawer` + the StatusBar badge surface symbols that repeatedly failed OHLCV fetch (Keep restores, Remove drops the queue entry). `admin.ts` + `adminHooks.ts` drive the Pool tab's rebuild/enrich/refresh-all operations. |
| `features/intelligence` | Today | Symbol analysis (LLM), cached results, sweep, pre-open gap outlook, thesis-delta, analysis-history timeline |
| `features/watchlist` | Today | Watchlist CRUD (Watchlist tab) |
| `features/dailyReview` | Today | Daily review compute and structured result |
| `features/analytics` | Analytics | Regime breakdown, performance stats |
| `features/fundamentals` | Today (symbol analysis), Symbol page | Fundamental snapshots used by the symbol analysis panels. The `useSymbolFundamentalsSync` hook syncs fundamentals across the drawer and full-page views. The standalone Research/Fundamentals comparison page and its `compare`/`warmup` hooks were removed. |
| `features/calendar` | Calendar | Calendar events |
| `features/weeklyReview` | Book | Weekly review CRUD |
| `features/strategy` | Strategy | Strategy CRUD and activation |
| `features/universes` | System → Pool (`/system/pool`) | Universe list, detail, refresh, benchmark |
| `features/backtest` | Today (drawer Backtest tab) | Event-study run (202+poll), trade ledger + metrics, snake_case→camelCase transform. Run inline per-symbol from the symbol drawer's Backtest tab (`components/domain/workspace/SymbolBacktestTab`, locked to the selected symbol); results render via `components/domain/backtest/BacktestResults`. No standalone page |
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
| `Tabs` | Underline-style tab strip driven by `tabs`/`active`/`onChange` props (no built-in keyboard navigation). First introduced Phase 1. Phase 2 consumers: `SymbolDrawer` (Overview / Fundamentals / Order / Backtest tabs) and `/symbol/:ticker` page. |
| `StatusDot` | Indicator dot for status states (`ok` / `warn` / `down` / `idle` tones). Compact visual for health/state signals in tables and pills. |
| `CollapsibleCard` | Compact disclosure card combining header + content; alternative to `CollapsibleSection` for card-based layouts. |
| `PageHeader` | Page top chrome: title, description, optional action buttons. Standardizes layout for System pages. |
| `Drawer` | Slide-out panel (typically from the right). Phase 2 consumer: `SymbolDrawer` (880px, mounted globally in `MainLayout`, driven by `workspaceStore.selectedTicker`; hardened focus/scroll-lock/topmost-Escape). |
| `StatsTable` | Presentational 5-column stats table (label + Trades/WinRate/AvgR/Expectancy). Backs `EdgeBreakdownTable` and `RegimeBreakdownTable`; takes translated headers + rows. |
| `RChip` | R-multiple readout: `formatR` + sign color (`getSignColorClass`) in tabular mono. |
| `Card` / `Button` / `Badge` / `ModalShell` / `TableShell` / `DataTable` | Layout and table chrome. |
| `lib/badgeMap` | Enum-to-badge specs mapper. Maps status/severity enums to `{ variant, labelKey }` for consistent visual communication (no icon field). |

Not every control fits a primitive: checkboxes, radios, range sliders, search boxes with custom layouts, and inline table-edit inputs stay hand-rolled.

## Typical Workflow

1. Start API and web UI.
2. **Today** — compute daily review and check pending orders (Today tab), run the screener and review candidates (Last Run tab), trigger symbol analysis, track the Watchlist tab.
3. Create orders via **Book**.
4. Next trading day: fill orders and update stops in **Book**.

Full timing guidance: `docs/product/DAILY_USAGE_GUIDE.md`.

## Testing

- Run `npx vitest run && npm run typecheck && npm run lint && npm run build` before any commit (full gate). `npm test` is watch mode for development.
- Use `renderWithProviders()` for component tests (wraps React Query + Zustand).
- Mock API calls with MSW handlers in `web-ui/src/test/mocks/handlers.ts`.
- Assert user-facing copy via i18n keys (`web-ui/src/i18n/`), not hardcoded strings.
- Coverage thresholds enforced: 80%+ lines, 75%+ branches.

## Phase 7: i18n Sweep (Stale Keys for Removal)

The following i18n key groups are no longer used after the Today Action Inbox rewrite and related banner removals. They are listed here for audit purposes **only** — do not prune until Phase 7 formal deprecation sweep:

- `todayPage.actionList.*` — old daily review action list
- `todayPage.pendingBadge.*` — old pending orders badge
- `todayPage.weeklyNudge.*` — old weekly review nudge banner
- `dailyReview.sections.*` — parts no longer rendered in the inbox (deprecation sweep will clarify which keys remain)
