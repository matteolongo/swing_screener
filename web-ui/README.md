# Swing Screener Web UI

Position management keeps current query-owned position versions. A stale edit
refreshes position data while preserving entered form values and requires an
explicit review before resubmission. Book and Today selection store IDs, not
snapshots. Failed refreshes preserve drafts but block writes until recovery.

React 18 + TypeScript frontend for Swing Screener.

Daily review shows market status and coverage beside portfolio risk. **Scan
details and data quality** expands the requested, evaluated, and returned
counts, candle dates, completion time, and provider warnings for the saved scan.
Refresh failures keep the previous result labelled as cached and offer Retry.
The header market-data badge opens and focuses those details. Stale results
identify affected candidate/benchmark candle dates when available, distinguish
the requested session from input freshness, and offer the shared refresh action.
Run-level stale flags without affected-input details are labelled explicitly.
Regime performance consumes the same shares-weighted trade R as Journal and
Performance. Scratch-only win rates display as unavailable; unknown-risk trades
are excluded. A benchmark outage displays the regime error state, not no trades.

## Pages

| Page | Route | Purpose |
| --- | --- | --- |
| Daily review | `/today` | Scan quality, portfolio attention, and a ranked candidate queue with expandable symbol research and signed order review |
| Calendar | `/calendar` | Earnings calendar and upcoming catalyst events |
| Trading book | `/book` | Open positions, order management, trade journal, performance analytics, and weekly review |
| Scan & universes | `/universes` | Run and pin scans, manage universes, inspect benchmarks, and discover symbols |
| Strategy | `/strategy` | Strategy CRUD, activation, and validation |
| Data Sources | `/datasources` | Data source diagnostics: per-source health, live probe, fallback event feed |
| Onboarding | `/onboarding` | Setup guide |

## Candidate review

Daily review force-refreshes its scan on entry/reload and through **Refresh review**.
It reuses the pinned settings (or the last scan/defaults when none are pinned),
requests the latest daily session, and reloads portfolio, order and watchlist
queries. A successful run replaces Today's snapshot and its selected candidate
together while preserving Last Run. Completion shows the refresh time; the
market date and prices may remain unchanged until a new daily candle exists.
Errors keep the previous successful data visible with a retry action. Strategy
changes trigger a new run; late responses cannot replace a newer pin or policy.

**Refresh the candidate data** uses the same full refresh for Today scan rows.
Watchlist/position rows and Universes reviews retain single-symbol refresh with
the originating filter and indicator settings. Their candidate, chart, benchmark
and signed order draft stay together without replacing saved runs. Wrong-ticker
or empty single-symbol responses retain the prior review with an error. Intraday
results remain explicitly labelled.

**Candidate review** owns the **Ready / All from run** filters, company or ticker
search, and **Show no-setup** toggle. Open a candidate to see its next step and
expand the trade plan, chart and metrics, or source evidence as needed. The
portfolio and candidate queues stay mounted during symbol review.

**Needs review** means follow the displayed next step and reason: refresh stale
data, fix an invalid stop, or define a valid target. Prices alone do not approve
an entry signal. **Save manual draft** keeps a proposed entry, stop, target,
quantity, currency and notes with the warning visible. In **Book → Orders →
Drafts**, **Refresh and review** checks current eligibility; **Approve draft**
promotes the same record only after signed approval and risk checks pass. Saved
prices and notes remain available for review; switching to a different approved
order type/currency explicitly replaces the plan while retaining notes. Drafts
cannot be submitted or filled. **Cancel order** marks an unfilled draft, pending
or submitted order as not filled and retains it under **Cancelled**. All broker
actions remain manual.

Book Orders also lists linked local protective stops and targets, separately
from entry plans. Position exits reconcile these local records atomically;
successful changes show the affected IDs and a reminder to adjust/cancel the
matching broker protection manually. Cancelled and filled protection remains in
the corresponding history filter.

Held-position metrics use the actual position entry and initial per-share risk
for 1R, R:R, and risk percentage. **Check live** fetches a new read-only stop
preview on every click and exposes failures for retry. The scan waiting panel
lists its operations without claiming timed completion of individual stages.

Order-review and fullscreen dialogs include native disclosure summaries in their
keyboard focus cycle. Closed disclosures keep their controls out of the cycle;
Escape closes the dialog and restores focus to its opening control.

Book row actions stay visible outside the scrolling positions table. Their
labelled button opens a popup that supports Tab, Escape and focus return.
Enter and Space on a row's action buttons activate that action directly,
including signed order review from the screener.

Journal trade details use a visible Expand/Collapse button with its expanded
state and a link to the controlled history row. Enter and Space toggle details
while keyboard focus stays on the button.

## Development

At widths below 1024px, **Show navigation** in the header opens the same
navigation in a modal drawer with Escape, focus restoration and scroll locking.
Header controls and Trading book tabs wrap. The **Risk policy** disclosure
shows account and strategy risk figures on demand. Wide tables scroll within
their panels, and the review queues and inspector stack below `xl` (1280px).

Local persistence keeps the portfolio ledger in browser storage, but trading
mutations and portfolio metrics require the API. Order creation, submission,
cancellation, fills, stop updates, partial closes and final closes use canonical
stateless commands. The browser only serializes input and stores a successful
returned snapshot. Mutations require Web Locks support on a secure origin
(`localhost` is supported), and stop updates require an explicitly timestamped
current price observation. A stored `currentPrice` is not treated as a fresh quote.

Existing browser schema-v3 stores need no destructive migration: an absent
`revision` starts at zero, and `appliedCommands` is initialized on the first
successful command. Both are written with orders, positions and the returned
active strategy in one localStorage update. Failed requests and stale responses
leave the stored ledger unchanged. Metrics come from `/api/portfolio/state/metrics`
and are never written back as trading state. Browser-ID DeGiro lookup and trail
configuration remain unavailable locally; manually supplied DeGiro fee/FX values
travel with the ordinary fill command.

```bash
cd web-ui
npm install
npm run dev       # dev server (Vite, http://localhost:5173)
npm run build     # production build
npm test          # Vitest
npm run typecheck # tsc --noEmit
npm run lint      # ESLint strict, zero warnings allowed
```

## Docs

- [`web-ui/docs/WEB_UI_GUIDE.md`](docs/WEB_UI_GUIDE.md) — full feature directory map, shared primitives, typical workflow, testing patterns
- [`web-ui/docs/WEB_UI_ARCHITECTURE.md`](docs/WEB_UI_ARCHITECTURE.md) — directory structure, API contract rules, state management
- [`web-ui/docs/DESIGN_TOKENS.md`](docs/DESIGN_TOKENS.md) — dark-theme semantic token system, ESLint enforcement
