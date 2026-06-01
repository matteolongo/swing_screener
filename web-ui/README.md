# Swing Screener Web UI

React + TypeScript frontend for Swing Screener.

## Pages

| Page | Route | Purpose |
|------|-------|---------|
| Today | `/today` | Daily review compute, pending orders, open risk summary |
| Calendar | `/calendar` | Earnings calendar and catalyst events |
| Book | `/book` | Open positions and order management |
| Research | `/research` | Screener candidates, symbol intelligence, watchlist |
| Universes | `/universes` | Universe management and refresh |
| Strategy | `/strategy` | Strategy config and activation |
| Journal | `/journal` | Weekly reviews and trade log |
| Onboarding | `/onboarding` | Setup guide |
| Analytics | `/analytics` | Regime breakdown and performance analytics |
| Fundamentals | `/fundamentals` | Fundamental data browser |

## Docs
- `web-ui/docs/WEB_UI_GUIDE.md` — pages, feature map, testing patterns
- `web-ui/docs/WEB_UI_ARCHITECTURE.md` — component and state architecture
- `docs/overview/INDEX.md` — full documentation index

## Development
```bash
cd web-ui
npm install
npm run dev
```

## Persistence Mode
- `VITE_PERSISTENCE_MODE=api` (default) — uses backend API and file storage.
- `VITE_PERSISTENCE_MODE=local` — activates browser localStorage (only when `VITE_ENABLE_LOCAL_PERSISTENCE=true`).
