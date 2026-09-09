# Swing Screener Web UI

React 18 + TypeScript frontend for Swing Screener.

## Pages

| Page | Route | Purpose |
| --- | --- | --- |
| Today | `/today` | A pinned screener-run subset, open-position review, watchlist, and symbol-analysis canvas. Exploratory scans stay in Last Run until explicitly used for Today. |
| Calendar | `/calendar` | Earnings calendar and upcoming catalyst events |
| Book | `/book` | Open positions: stop updates, partial close, trail config; order management; trade journal; performance analytics; weekly review |
| Universes | `/universes` | Universe management, manual refresh, benchmark, symbol discovery |
| Strategy | `/strategy` | Strategy CRUD, activation, and validation |
| Data Sources | `/datasources` | Data source diagnostics: per-source health, live probe, fallback event feed |
| Onboarding | `/onboarding` | Setup guide |

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
