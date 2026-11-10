# Web UI Guide

> Status: current.  
> Last reviewed: 2026-11-10.

## Purpose

Daily trading workflow through the Swing Screener web interface.

### Daily review and exploration

**Daily review** (`/today`) opens with the scan's market-data status and the
portfolio's current risk. The scan summary labels final close, intraday, stale,
or unknown data separately from coverage. Open **Scan details and data quality**
to see requested, evaluated, and matched counts, candle dates, request completion
time, and provider warnings. A failed refresh keeps the previous result visible
and labels it as cached.

Use the risk, positions, and pending-orders cards to open the corresponding
Trading book views. **Portfolio attention** places stop and exit reviews before
pending entries, watchlist triggers, and routine position monitoring. Each
source can load or fail independently. **Candidate review** is the ranked queue
for setups and has its own search, Ready / All from run filters, and no-setup
toggle. The queue's filters apply to the pinned run's display.

The selected symbol has three levels:

1. **Decision & next step** shows the workflow verdict, short reasoning, manual
   actions, and an expandable trade plan.
2. **Price, technicals & fundamentals** opens the chart, scan reasoning,
   technical metrics, and the fundamentals strip.
3. **Sources, freshness & research** exposes source status, observed and retrieval
   dates, available AI analysis, and the Intelligence, Backtest, and Volume
   Zones tools. Opening the inspector alone does not run those tools.

The queues stay available alongside the inspector on wide displays and above
it on narrow displays. Closing the inspector returns focus to the selected
row. The shared navigation keeps Daily review, Trading book, Scan & universes,
and Calendar visible, with Strategy, Data Sources, and Onboarding grouped under
Setup & diagnostics. The global header keeps strategy selection accessible
and offers a separate Risk policy disclosure for the capital/risk breakdown.

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
The nearby **Scan quality** summary retains coverage counts and provider/symbol
warnings. Requested session, observed candle date(s), market freshness and last
successful request completion are separate facts. Missing legacy metadata stays
unknown rather than being inferred from the request time. Failed refreshes show
**Retry scan** and explicitly label retained data. A completed no-candidate scan
is distinct from a search/hidden-group mismatch, which exposes **Clear candidate
filters**. `ResultQualitySummary` and `features/screener/resultQuality.ts` own this
presentation; screening decisions remain backend-owned.

`TodayActionList` owns the position and order actions and watchlist attention
items. `CandidateQueue` owns scan filters and selection from the run.

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

Book Orders groups entry plans separately from local protective stop/target
records. Each record shows its kind and linked position; cancelled/filled
protection remains discoverable through the matching history filter. Successful
stop updates, scale-outs and final exits show the changed local record IDs and
the required manual broker adjustment/cancellation. Failed mutations keep the
form available and do not show that success reminder.

The Universes **Screener run** section also renders the latest scan's candidate
table, with its saved display filters. Rows open the selected candidate snapshot
in the symbol modal. Unpinned scans can therefore be inspected without replacing
Today's pinned review source. The separate discovery screener remains independent.

The AI stale badge compares the displayed analysis generation time with newer
fundamentals, the selected daily bar, and the workspace's fetched price data.
Fresh analysis clears the badge only when it postdates those dependencies.

## Pages

Book Details keeps the selected position ID and resolves current query data.
After a scale-out, reopened management shows the remaining shares without
closing Details first. Closed/removed positions no longer expose management.
Stop/scale-out/exit forms preserve typed values on a version conflict, refresh
the position, and require **I reviewed the current position** before resubmission.
That review accepts the displayed current shares/stop, not an automatic trade.
Today management also resolves position IDs from current queries. If the current
position cannot be refreshed, forms keep the draft, block submission and offer
**Refresh current position** before the deliberate review step.

| Page | Route | Purpose |
|------|-------|---------|
| Daily review | `/today` | Scan status and coverage, backend portfolio heat, position and order counts, portfolio attention, and the ranked candidate queue. See Daily review and exploration above for the inspector levels. |
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

## Responsive application layout

`MainLayout` uses Tailwind's existing `lg` breakpoint (1024px): desktop keeps
the fixed-width sidebar; narrower screens expose the Header's **Show navigation**
button (`aria-expanded` / `aria-controls`). Only one shared `Sidebar` is mounted,
either in the desktop layout or in a `ModalShell` drawer. Navigation, Escape,
the close button and the backdrop close the drawer; the shell restores focus
and document scrolling. Crossing into desktop also closes an open drawer.

The header, account/risk summary and Book tabs wrap to the available width.
Main content and summary flex children retain `min-width: 0`; monetary values
remain visible. Today stacks its queue and detail panes below `xl`. Wide Book
tables keep their local horizontal scrolling, with a narrow-screen scroll hint;
the journal scroll region also supports keyboard focus.

## Shared primitives

Reusable building blocks live in `components/common/`. Prefer these over hand-rolling markup so styling and behavior stay in one place (colors come from the semantic tokens in `docs/DESIGN_TOKENS.md`, enforced by the ESLint token rule).

| Primitive | Use for |
|---|---|
| `Field` | Label + optional hint/error wrapper. Generates an id via `useId` and associates the label with a nested `Input`/`Select`/`Textarea`, so controls get a real accessible name instead of a loose `aria-label`. |
| `Input` / `Select` / `Textarea` | Form controls carrying the canonical `CONTROL_CLASS` (exported from `Input`). `forwardRef`, spread all native props, auto-wire `id` from the surrounding `Field`. Pass only deviations (width, alignment) via `className`. |
| `CollapsibleSection` | Progressive disclosure. Native `<details>` + chevron, token-styled; `title`, optional `meta`, `defaultOpen`. Used by the Strategy advanced panel and the Universes discovery filters. |
| `ActionMenu` | Labelled native row-action trigger and portalled button group. Positions from the trigger, flips above near the viewport bottom, clamps horizontal edges, and dismisses on Escape/outside press, focus leaving, scroll or resize. Keeps normal Tab navigation and restores the trigger before activating an action. |
| `StatsTable` | Presentational 5-column stats table (label + Trades/WinRate/AvgR/Expectancy). Backs `EdgeBreakdownTable` and `RegimeBreakdownTable`; takes translated headers + rows and displays nullable win rates as unavailable. Regime outcomes use canonical shares-weighted R and explain scratch/unknown-risk exclusions. |
| `RChip` | R-multiple readout: `formatR` + sign color (`getSignColorClass`) in tabular mono. |
| `Card` / `Button` / `Badge` / `ModalShell` / `TableShell` / `DataTable` | Layout and table chrome. |

Not every control fits a primitive: checkboxes, radios, range sliders, search boxes with custom layouts, and inline table-edit inputs stay hand-rolled.

## Typical Workflow

1. Start API and web UI.
2. **Daily review** loads the saved scan settings on entry. Check scan quality
   and portfolio attention first, then work through the ranked candidate groups.
   Each row displays the next step from the backend. **Review order** opens the
   signed plan for an eligible entry, including an eligible pending pullback
   when the backend issues that plan.
3. Use **Scan & universes** to explore other universes. Pin a scan when it
   should become the source for Daily review.
4. Use **Trading book** to review orders, record broker fills, and manage stops.

Full timing guidance: `docs/product/DAILY_USAGE_GUIDE.md`.

## Testing

- Run `npm test` before and after any change.
- Use `renderWithProviders()` for component tests (wraps React Query + Zustand).
- Mock API calls with MSW handlers in `web-ui/src/test/mocks/handlers.ts`.
- Assert user-facing copy via i18n keys (`web-ui/src/i18n/`), not hardcoded strings.
- Coverage thresholds enforced: 80%+ lines, 75%+ branches.
