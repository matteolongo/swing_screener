# Swing Screener Web UI

React 18 + TypeScript frontend for Swing Screener.

## Pages

| Page | Route | Purpose |
| --- | --- | --- |
| Today | `/today` | Screener candidates (Last Run tab), open positions and daily review (Today tab), Watchlist tab; symbol analysis canvas on the right |
| Calendar | `/calendar` | Earnings calendar and upcoming catalyst events |
| Book | `/book` | Open positions: stop updates, partial close, trail config; order management; trade journal; performance analytics; weekly review |
| Universes | `/universes` | Universe management, manual refresh, benchmark, symbol discovery |
| Strategy | `/strategy` | Strategy CRUD, activation, and validation |
| Data Sources | `/datasources` | Data source diagnostics: per-source health, live probe, fallback event feed |

## Development

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
