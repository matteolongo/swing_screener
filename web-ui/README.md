# Swing Screener Web UI

React 18 + TypeScript frontend for Swing Screener.

## Pages

| Page | Route | Purpose |
| --- | --- | --- |
| Today | `/today` | Automatically refreshed candidate queue, portfolio review, symbol detail, signed order review and manual drafts. Uses the saved scan settings; unpinned exploration stays in Universes. |
| Calendar | `/calendar` | Earnings calendar and upcoming catalyst events |
| Book | `/book` | Open positions: stop updates, partial close, trail config; order management; trade journal; performance analytics; weekly review |
| Universes | `/universes` | Full screener run and latest results, explicit pinning for Today, universe management, manual refresh, benchmark, and symbol discovery |
| Strategy | `/strategy` | Strategy CRUD, activation, and validation |
| Data Sources | `/datasources` | Data source diagnostics: per-source health, live probe, fallback event feed |
| Onboarding | `/onboarding` | Setup guide |

## Candidate review

Today force-refreshes its scan on entry/reload and through **Refresh Today**.
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

Held-position metrics use the actual position entry and initial per-share risk
for 1R, R:R, and risk percentage. **Check live** fetches a new read-only stop
preview on every click and exposes failures for retry. The scan waiting panel
lists its operations without claiming timed completion of individual stages.

## Development

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
