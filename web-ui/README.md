# Swing Screener Web UI

React + TypeScript frontend for Swing Screener.

## Functional Areas
- Dashboard
- Screener
- Orders
- Positions
- Strategy
- Daily Review
- Settings

## Docs
- `web-ui/docs/WEB_UI_GUIDE.md`
- `web-ui/docs/WEB_UI_ARCHITECTURE.md`
- `docs/overview/INDEX.md`

## Development
```bash
cd web-ui
npm install
npm run dev
```

## Persistence Env
- `VITE_PERSISTENCE_MODE=api` (default behavior) uses backend API/file storage.
- `VITE_PERSISTENCE_MODE=local` only activates browser localStorage when `VITE_ENABLE_LOCAL_PERSISTENCE=true`.
- If `VITE_ENABLE_LOCAL_PERSISTENCE` is not truthy, mode falls back to `api`.
