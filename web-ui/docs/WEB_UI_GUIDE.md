# Web UI Guide

> Status: current.  
> Last reviewed: 2026-10-02.

## Purpose

Daily trading workflow through the Swing Screener web interface.

### Cockpit review and exploration

The queue's **Review order** button and the detail panel's **Prepare order**
button open the existing signed-draft order ticket in a modal. Closing the ticket
preserves the selected symbol; submission remains manual and retains the existing
backend eligibility checks and error feedback.

`features/screener/useTodayRefresh` runs on Today entry/reload and its refresh
controls. It waits for persisted settings, force-fetches the latest daily
session, refetches portfolio/watchlist/orders and replaces the Today snapshot
plus selected scan row together. It keeps the saved scan's universe, preset,
filters and indicator overrides; Last Run stays available for exploration.
Completion includes a refresh time because a daily candle's date/prices may
remain unchanged. Errors keep the previous successful candidate snapshot.

Blocked candidates show the next step and reasons alongside **Save manual
draft** (`ManualOrderDraftForm`). The form saves quantity, quote currency,
entry, stop, target and notes under the non-actionable `draft` status. **Book
→ Orders → Drafts → Refresh and review** (`DraftOrderReview`) refreshes the
symbol; an eligible signed plan opens the existing order review with the saved
values and matching R:R. A changed order type/currency requires an explicit
switch to the current plan. **Approve draft** promotes the same record.
`PendingOrdersTab` also exposes Cancel for draft/pending/submitted records and
Cancelled/Filled history filters. Cancel marks an order as not filled without
discarding its history; submission, broker cancellation and fills stay manual.

The Universes **Screener run** section also renders the latest scan's candidate
table, with its saved display filters. Rows open the selected candidate snapshot
in the symbol modal. Unpinned scans can therefore be inspected without replacing
Today's pinned review source. The separate discovery screener remains independent.

The AI stale badge compares the displayed analysis generation time with newer
fundamentals, the selected daily bar, and the workspace's fetched price data.
Fresh analysis clears the badge only when it postdates those dependencies.

## Pages

| Page | Route | Purpose |
|------|-------|---------|
| Today | `/today` | Cockpit composition: `TodayStatsStrip` header (open-position, pending-entry-order, and ready-candidate counts plus the pinned-run final-close/intraday data-state pill), `TodayActionList` attenzioni (open positions, pending entry orders, watchlist-near-trigger items), `CandidateQueue` (`onSelectTicker`, pinned screener run preferred with `lastResult` fallback, loading state via `ScreenerRunningPanel`, search box, no-setup show/hide toggle), and `SymbolDetailPanel` (`ticker`/`onClose`) with a header block (ticker, company, workflow badge, close), a decision block (`AnalysisDecisionStrip`, `DecisionWhyPanel`, `FundamentalsStrip`, plus `ManagePositionPanel` for held symbols), a chart block (`CachedSymbolCandleChart`), and an AI narrative block with collapsed Approfondisci tabs (intelligence, backtest, volume zones). Selection preserves its source, immutable run ID, candidate snapshot, and stable row ID, so the detail panel shows the selected pinned/last-run candidate even when runs diverge. Single-symbol research is workspace-local and does not rewrite either run. Closing the detail panel returns focus to the originating queue control. The queue groups candidates in this order: **Pronti per revisione ordine**, **In attesa del trigger**, **Richiede verifica**, and **Interessanti, nessun setup**. Each row shows one concrete next action from the canonical workflow state; the no-setup group is hidden behind a show/hide toggle, and only candidates with a signed canonical order draft expose the manual **Rivedi ordine** action. Candidate lists keep the server-provided `priorityRank`/`rank`. Today refreshes its current scan settings on entry/reload and on demand. An Advanced exploration scan replaces those settings only when **Use this run for Today's review** is selected in the Screener run section of the Universes page; exploration scans leave the pinned source unchanged. Position/order health follows the canonical open-position and order query lifecycle rather than symbol presence alone; the UI consumes server-derived ledger freshness from `app_config.portfolio_snapshot_stale_after_days` and never treats React Query refetch eligibility as domain staleness. Evidence health comes from structured refresh manifests or saved enrichment diagnostics, never from candidate-summary presence. For a held symbol the Order tab is hidden unless a fresh, canonically allowed add-on or scale-back draft exists, and position management is folded into Overview. Its advisory live preview is explicitly read-only and separated from stop, scale-out, and exit mutations. Failed order and position mutations keep the entered form values available for correction or retry |
| Calendar | `/calendar` | Earnings and catalyst calendar. Position, screener, economic, and IPO events have an explicit legend; date headings use the active `I18nProvider` locale. |
| Book | `/book` | Three keyboard-operable tabs persisted via `book.activeTab` with `location.state.tab` deep-links (legacy `review`/`performance` map to journal): positions (`PortfolioRiskSummary`, `ConcentrationBar`, `PortfolioPanel` — stop updates, partial close, trail config), orders (`PendingOrdersTab` — create, fill, cancel), and Journal & Performance (trade journal with backend-canonical R rows, aggregates, and insight codes; performance analytics; weekly review). Weekly Review stores ISO week-year IDs (`YYYY-Www`) and uses `Field`-associated textareas. |
| Universes | `/universes` | Universe management, manual refresh, benchmark, symbol discovery with ad-hoc screener run. Detail tabs are keyboard-operable; result rows expose native symbol buttons and preserve selected-row state. The clicked discovery candidate is passed intact into analysis and order review; it is never re-looked-up in the unrelated last-run store, so non-ready discovery rows cannot fall into the manual-symbol order path. The result table shows the canonical next action instead of `decisionSummary.action`. **Pool tab**: refresh-all-universes, rebuild symbol pool, and enrich taxonomy — each with a field-level diff table (`PoolTab` / `PoolDiffTable` / `UniverseRefreshSummary`) |
| Strategy | `/strategy` | Strategy CRUD, activation, and validation |
| Onboarding | `/onboarding` | Setup guide for new users |
| Data Sources | `/datasources` | Data source diagnostics: inventory of all sources with configured/probeable status, per-source Test button (fires a live canary probe), Test All (concurrent probe of all probeable sources), and a fallback event feed. One intelligence source is probeable: `sec_edgar_catalysts`. |

## Feature Directory Map

Each domain has a directory under `web-ui/src/features/<domain>/` with `api.ts` (fetch functions), `hooks.ts` (React Query hooks), and types. Cockpit containers (`TodayStatsStrip`, `CandidateQueue`, `SymbolDetailPanel`) live under `components/domain/cockpit/` and compose the hooks above; `features/` itself is unchanged by the cockpit redesign.

| Feature dir | Feeds page(s) | Domain |
|---|---|---|
| `features/portfolio` | Book | Positions: CRUD, stop updates, partial close, trail method |
| `features/orders` | Book, Today | Order lifecycle: create, fill, cancel |
| `features/screener` | Today | Screener run, candidates, recurrence state. The screener filters the unified symbol pool by taxonomy (`taxonomyFilter` + `preset`) via `QuickFilterBar` (region/cap/type/sector/index) above the table; currency/exchange/OTC/price stay in the collapsible panel. The `universe` field is a deprecated index-membership alias. |
| `features/pool` | Today (filter bar), Header (review queue), Universes (Pool tab) | Taxonomy presets, pool browse, and review-queue health. `QuickFilterBar` consumes presets; `components/domain/pool/ReviewQueueDrawer` + the Header badge surface symbols that repeatedly failed OHLCV fetch (Keep restores, Remove drops the queue entry). `admin.ts` + `adminHooks.ts` drive the Pool tab's rebuild/enrich/refresh-all operations. |
| `features/intelligence` | Today | Symbol analysis (LLM), cached results, sweep, pre-open gap outlook, thesis-delta, analysis-history timeline |
| `features/watchlist` | Today | Watchlist CRUD (Watchlist tab) |
| `features/dailyReview` | Today | Portfolio/watchlist review compute and structured result. Candidate opportunities are derived from the persisted pinned screener snapshot, not from this endpoint; Today loads the backend-filtered watchlist near-trigger slice independently through `GET /api/daily-review` in API mode or `/api/daily-review/compute` with the browser watchlist and strategy snapshot in local mode, and keeps other available sources visible when one refresh fails. |
| `features/analytics` | Analytics | Regime breakdown, performance stats |
| `features/fundamentals` | Today (symbol analysis) | One canonical fundamental snapshot, owned by `useSymbolWorkspaceData`, feeds Overview and the decision-first Fundamentals tab. Refresh updates that query without rewriting historical screener inputs; a newer snapshot marks intelligence outdated but does not regenerate it. The standalone Research/Fundamentals comparison page was removed; the `compare`/`warmup` hooks are now unused and pending cleanup. |
| `features/calendar` | Calendar | Calendar events |
| `features/weeklyReview` | Book | Weekly review CRUD |
| `features/strategy` | Strategy | Strategy CRUD and activation |
| `features/universes` | Universes | Universe list, detail, refresh, benchmark |
| `features/backtest` | Today (canvas Backtest tab) | Event-study run (202+poll), trade ledger + metrics, snake_case→camelCase transform. Run inline per-symbol from the analysis canvas Backtest tab (`components/domain/workspace/SymbolBacktestTab`, locked to the selected symbol); results render via `components/domain/backtest/BacktestResults`. No standalone page |
| `features/volumeZones` | Today (canvas Volume Zones tab) | Read-only volume-zone analysis fetch/hook and snake_case→camelCase transform for advisory POC/HVN/LVN context. Analysis and candle sources render independently with normalized ticker/request identity checks and scoped retries; analysis validates the echoed `(ticker, lookback, minRr)` tuple, while candles show their own provider, interval, latest content date, and API fetch time. Partial failures preserve the available summary or chart, and the bar-profile approximation is explicit |
| `features/datasources` | Data Sources | Source inventory, per-source and bulk probe, fallback event feed |
| `features/config` | (cross-cutting) | App config read/write |
| `features/persistence` | (cross-cutting) | API vs localStorage mode toggle |
| `features/workspaceData` | Today, symbol modals | Canonical symbol-workspace composition through `useSymbolWorkspaceData`: ticker/session-safe React Query data, source health and freshness aggregation, per-source refresh, non-intelligence bulk refresh, intelligence dependency invalidation contracts, and immutable request-ID activity transitions. `useCandidateAnalysis` recomputes or force-refreshes the selected candidate for the latest session with the originating scan's overrides, preserving saved runs and keeping the displayed chart, benchmark, and order draft together |

Charts (`components/domain/market/`): `CandleChart` uses TradingView Lightweight Charts for OHLC candles, volume, pattern markers with i18n tooltips, and a rebased benchmark comparison line. It also accepts optional `volumeZones` / `showVolumeZones` props for POC, HVN, and LVN price-line overlays. `CachedSymbolCandleChart` receives the displayed candidate and its benchmark context explicitly from `SymbolDetailPanel` or `SymbolOverviewTab`, so refreshing a review updates chart and plan together. It fetches direct candles when the candidate has no history and adds a time-range selector (`1W`/`1M`/`3M`/`6M`/`1Y`/`MAX`, default `MAX`) plus a fullscreen `ModalShell`. The shared shell handles Escape, focus trapping, and focus restoration; range slicing reuses `features/screener/priceHistory.ts`. The older close-only `CachedSymbolPriceChart` was removed.

Symbol analysis overview (`components/domain/workspace/SymbolAnalysisContent.tsx`, overview tab): one screener-owned workflow verdict at the top (`AnalysisDecisionStrip` — workflow state, canonical next step, conviction, trade plan), then a unified `DecisionWhyPanel` ("What to do / Why now / Watch for") whose operational row comes from `recommendation.nextStep`, and a compact `FundamentalsStrip` (P/E, revenue growth, gross margin, valuation). For a held symbol a `ManagePositionPanel` is folded in here (Update stop / Scale out / Exit / Check live, reusing the existing position hooks/modals; Add-to-position only when the backend returns a live-stop-adjusted `ADD_ON`/`SCALE_BACK` recommendation with `workflowStatus === 'ready'`, which routes to the Order tab) and `AnalysisDecisionStrip` shows the real position entry/stop/target rather than the fresh-setup close. Technical detail (chart + `CatalystContextCard` + `TechnicalMetricsGrid`) follows underneath. If no cached narrative exists yet, Overview shows only a compact "Analyze with AI" CTA that generates the intelligence payload.

Symbol intelligence tab (`components/domain/workspace/SymbolAnalysisContent.tsx`, intelligence tab): starts with the manual **Position Review** panel (`PositionReviewPanel`) for held and ad-hoc symbols. It calls `POST /api/intelligence/position-review/{position_id}` for held positions or `POST /api/intelligence/{ticker}/position-review` for symbol-only review, and renders structured cards for **Why it moved**, **Protect profit**, **Stop advice**, **Macro/geopolitical overlay**, and **Evidence used**. This review is advisory-only and does not mutate positions or orders. Below it, the tab contains the full narrative analysis (`NarrativeAnalysisCard`), the Analyze/Refresh controls, and a compact follow-up chat (`IntelligenceChatPanel`) at the bottom. The intelligence decision brief and `NarrativeAnalysisCard` use the canonical workflow badge and next-step copy for operational guidance. When the AI's analytical action differs from the screener's compatibility action, the card renders a neutral second-opinion note without echoing either legacy action label (suppressed in position/manage-only mode). The card also renders a prominent **pre-open outlook** card (gap direction + magnitude + overnight driver + at-open/stop-gap actions, only when the US market is pre-open), a **thesis-delta** badge in the decision-focus block ("since last analysis": confirmed/weakening/invalidated), an **Evidence balance** panel from `intelligence.evidenceLedger` (qualitative net bullish/bearish/mixed chip, bull/bear bar, and collapsed weighted-signal details), dated **what-to-expect** and **news** rows, and a collapsible **analysis-history timeline** fed by `useIntelligenceHistoryQuery` (`GET /api/intelligence/{ticker}/history`). Timeline rows can show prediction-outcome badges (`Confirmed`, `Contradicted`, `Unresolved`) when later analyses have annotated prior predictions. The chat is persisted per ticker/day, stays advisory-only, and shows an **Evidence used** disclosure only for replies where the user explicitly enabled source refresh through app-configured evidence collectors.

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
2. **Today** — wait for its automatic refresh, check open positions and unfilled orders, then review candidates using the saved scan settings. Refresh Today reruns those settings without visiting Advanced. Use the Last Run checkbox to update Today's source, or clear it to explore another universe without changing the review. Last Run uses the server-authoritative workflow state: resolve candidates in the ordered **Pronti per revisione ordine**, **In attesa del trigger**, **Richiede verifica**, and collapsed **Interessanti, nessun setup** groups. Follow the localized concrete next action shown for each candidate. **Pronti per revisione ordine** exposes manual **Rivedi ordine**; **In attesa del trigger** exposes it only for the backend-authorized, token-gated pending `BUY_LIMIT` pullback exception. Track the Watchlist and trigger symbol analysis as needed.
3. Create orders via **Book**.
4. Next trading day: fill orders and update stops in **Book**.

Full timing guidance: `docs/product/DAILY_USAGE_GUIDE.md`.

## Testing

- Run `npm test` before and after any change.
- Use `renderWithProviders()` for component tests (wraps React Query + Zustand).
- Mock API calls with MSW handlers in `web-ui/src/test/mocks/handlers.ts`.
- Assert user-facing copy via i18n keys (`web-ui/src/i18n/`), not hardcoded strings.
- Coverage thresholds enforced: 80%+ lines, 75%+ branches.
