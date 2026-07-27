# Web UI Guide

> Status: current.  
> Last reviewed: 2026-07-03.

## Purpose

Daily trading workflow through the Swing Screener web interface.

## Pages

| Page | Route | Purpose |
|------|-------|---------|
| Today | `/today` | Left panel with three tabs — Today (all open positions, pending orders, watchlist-near-trigger items, and a subset of one pinned screener run), Last Run (the latest screener result), Watchlist — plus the symbol analysis canvas on the right. Selecting a symbol expands the canvas and collapses the list into a desktop rail; the sticky workspace header provides close, collapse, and full-screen controls, while mobile uses a back-to-list control. Closing preserves the active left tab, filters, sorting, and scroll context. A source status bar reports each workspace input's phase, provider, and timestamp, and retryable failures remain in the activity drawer until recovery or dismissal. Last Run groups candidates in this order: **Pronti per revisione ordine**, **In attesa del trigger**, **Richiede verifica**, and **Interessanti, nessun setup**. Each row shows one concrete next action from the canonical workflow state; the no-setup group is visually secondary and collapsed initially, and only ready candidates expose the manual **Rivedi ordine** action. A completed scan becomes Today's source only when **Use this run for Today's review** is selected; exploration scans leave the pinned source unchanged. For a held symbol the Order tab is hidden unless a fresh, canonically ready add-on signal exists, and position management is folded into Overview. Its advisory live preview is explicitly read-only and separated from stop, scale-out, and exit mutations. Failed order and position mutations keep the entered form values available for correction or retry |
| Calendar | `/calendar` | Earnings calendar, upcoming catalyst events |
| Book | `/book` | Open positions: stop updates, partial close, trail config; order management: create, fill, cancel; trade journal; performance analytics; weekly review |
| Universes | `/universes` | Universe management, manual refresh, benchmark, symbol discovery with ad-hoc screener run (row click opens symbol detail modal). **Pool tab**: refresh-all-universes, rebuild symbol pool, and enrich taxonomy — each with a field-level diff table (`PoolTab` / `PoolDiffTable` / `UniverseRefreshSummary`) |
| Strategy | `/strategy` | Strategy CRUD, activation, and validation |
| Onboarding | `/onboarding` | Setup guide for new users |
| Data Sources | `/datasources` | Data source diagnostics: inventory of all sources with configured/probeable status, per-source Test button (fires a live canary probe), Test All (concurrent probe of all probeable sources), and a fallback event feed. One intelligence source is probeable: `sec_edgar_catalysts`. |

## Feature Directory Map

Each domain has a directory under `web-ui/src/features/<domain>/` with `api.ts` (fetch functions), `hooks.ts` (React Query hooks), and types.

| Feature dir | Feeds page(s) | Domain |
|---|---|---|
| `features/portfolio` | Book | Positions: CRUD, stop updates, partial close, trail method |
| `features/orders` | Book, Today | Order lifecycle: create, fill, cancel |
| `features/screener` | Today | Screener run, candidates, recurrence state. The screener filters the unified symbol pool by taxonomy (`taxonomyFilter` + `preset`) via `QuickFilterBar` (region/cap/type/sector/index) above the table; currency/exchange/OTC/price stay in the collapsible panel. The `universe` field is a deprecated index-membership alias. |
| `features/pool` | Today (filter bar), Header (review queue), Universes (Pool tab) | Taxonomy presets, pool browse, and review-queue health. `QuickFilterBar` consumes presets; `components/domain/pool/ReviewQueueDrawer` + the Header badge surface symbols that repeatedly failed OHLCV fetch (Keep restores, Remove drops the queue entry). `admin.ts` + `adminHooks.ts` drive the Pool tab's rebuild/enrich/refresh-all operations. |
| `features/intelligence` | Today | Symbol analysis (LLM), cached results, sweep, pre-open gap outlook, thesis-delta, analysis-history timeline |
| `features/watchlist` | Today | Watchlist CRUD (Watchlist tab) |
| `features/dailyReview` | Today | Portfolio/watchlist review compute and structured result. Candidate opportunities are derived from the persisted pinned screener snapshot, not from this endpoint. |
| `features/analytics` | Analytics | Regime breakdown, performance stats |
| `features/fundamentals` | Today (symbol analysis) | One canonical fundamental snapshot, owned by `useSymbolWorkspaceData`, feeds Overview and the decision-first Fundamentals tab. Refresh updates that query without rewriting historical screener inputs; a newer snapshot marks intelligence outdated but does not regenerate it. The standalone Research/Fundamentals comparison page was removed; the `compare`/`warmup` hooks are now unused and pending cleanup. |
| `features/calendar` | Calendar | Calendar events |
| `features/weeklyReview` | Book | Weekly review CRUD |
| `features/strategy` | Strategy | Strategy CRUD and activation |
| `features/universes` | Universes | Universe list, detail, refresh, benchmark |
| `features/backtest` | Today (canvas Backtest tab) | Event-study run (202+poll), trade ledger + metrics, snake_case→camelCase transform. Run inline per-symbol from the analysis canvas Backtest tab (`components/domain/workspace/SymbolBacktestTab`, locked to the selected symbol); results render via `components/domain/backtest/BacktestResults`. No standalone page |
| `features/volumeZones` | Today (canvas Volume Zones tab) | Read-only volume-zone analysis fetch/hook and snake_case→camelCase transform for advisory POC/HVN/LVN context. Analysis and candle sources render independently with normalized ticker/request identity checks and scoped retries; partial failures preserve the available summary or chart, and the bar-profile approximation is explicit |
| `features/datasources` | Data Sources | Source inventory, per-source and bulk probe, fallback event feed |
| `features/config` | (cross-cutting) | App config read/write |
| `features/persistence` | (cross-cutting) | API vs localStorage mode toggle |
| `features/workspaceData` | Today | Canonical symbol-workspace composition through `useSymbolWorkspaceData`: ticker/session-safe React Query data, source health and freshness aggregation, per-source refresh, non-intelligence bulk refresh, and intelligence dependency invalidation contracts |

Charts (`components/domain/market/`): `CandleChart` is a responsive hand-rolled SVG candlestick chart (bodies + wicks + volume bars + pattern markers with i18n tooltips + a rebased benchmark comparison line). It also accepts optional `volumeZones` / `showVolumeZones` props for POC, HVN, and LVN price-line overlays. `CachedSymbolCandleChart` wraps it, sourcing OHLCV bars, detected patterns, and the benchmark series from the cached screener result by ticker, and adds a time-range selector (`1W`/`1M`/`3M`/`6M`/`1Y`/`MAX`, default `MAX`) plus a fullscreen overlay. It is used in the full symbol views (`SymbolViewModal`, `SymbolAnalysisContent`); range slicing reuses `features/screener/priceHistory.ts`. The older close-only `CachedSymbolPriceChart` was removed.

Symbol analysis overview (`components/domain/workspace/SymbolOverviewTab.tsx`): one decision-first view owns the screener action and next step, discursive rationale, table-based trade plan and invalidation, capped supporting/opposing evidence, compact fundamentals/catalyst summaries, and the chart plus technical detail. Partial source failures name the unavailable dependency while preserving available content, and stale intelligence is explicit. For a held symbol `ManagePositionPanel` remains folded into Overview and the trade plan uses the real position entry/stop/target. Watch/unwatch and server-authoritative order review remain available here; the decision strip is not repeated above the other tabs.

Symbol intelligence tab (`components/domain/workspace/SymbolIntelligenceTab.tsx`): follows an explicit evidence-first flow. It shows the current source manifest and enrichment diagnostics before any generation action. **Refresh evidence sources** calls the dedicated read-only `POST /api/intelligence/{ticker}/evidence/refresh` collector endpoint and updates the per-provider manifest without invoking analysis; **Generate analysis** and **Force-refresh analysis** remain separate actions, and selection never generates automatically. Active and failed pipeline stages are derived from the mutation and the exact ticker-run trace started by that request, including failures where no prior analysis exists; a retry preserves whether the failed request was normal or forced. Current, partial, and outdated results remain readable as a discursive recap followed by structured evidence. Position review and strategic context remain optional collapsed advisory actions even before narrative generation; chat is available once analysis context exists. History and the technical trace are collapsed separately. All mutation-local results, including evidence refreshes, are scoped to the normalized ticker and workspace selection version, so late responses from a previous symbol/session are ignored. Position review remains read-only and calls `POST /api/intelligence/position-review/{position_id}` for held positions or `POST /api/intelligence/{ticker}/position-review` for symbol-only review. `NarrativeAnalysisCard` retains pre-open outlook, thesis delta, evidence balance, dated events/news, and analysis history. Chat remains persisted per ticker/day and advisory-only.

Generation attempts carry a stable client attempt ID persisted in both the run
trace and ticker index. The tab therefore selects the exact success or failure
without clock correlation. An untraced preflight failure never falls back to an
older trace; after reload, attempt-aware runs take precedence over the cached
result and legacy history. Retry uses the persisted normal/force mode. Refreshed evidence providers render
as distinct rows and do not inherit aggregate evidence diagnostics.

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
2. **Today** — check all open positions and pending orders, then review candidates from the explicitly pinned screener run. Use the Last Run checkbox to update Today's source, or clear it to explore another universe without changing the review. Last Run uses the server-authoritative workflow state: resolve candidates in the ordered **Pronti per revisione ordine**, **In attesa del trigger**, **Richiede verifica**, and collapsed **Interessanti, nessun setup** groups. Follow the localized concrete next action shown for each candidate; only **Pronti per revisione ordine** exposes the manual **Rivedi ordine** action. Track the Watchlist and trigger symbol analysis as needed.
3. Create orders via **Book**.
4. Next trading day: fill orders and update stops in **Book**.

Full timing guidance: `docs/product/DAILY_USAGE_GUIDE.md`.

## Testing

- Run `npm test` before and after any change.
- Use `renderWithProviders()` for component tests (wraps React Query + Zustand).
- Mock API calls with MSW handlers in `web-ui/src/test/mocks/handlers.ts`.
- Assert user-facing copy via i18n keys (`web-ui/src/i18n/`), not hardcoded strings.
- Coverage thresholds enforced: 80%+ lines, 75%+ branches.
