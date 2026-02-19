# Swing Screener Web UI

React + TypeScript frontend for Swing Screener.

## Functional Areas
- Dashboard
- Screener
- Orders
- Positions
- Strategy
- Backtest
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

## Environment Variables

- `VITE_API_URL` (default: empty): base URL for API requests.
- `VITE_AUTH_MODE` (default: `csv`): auth mode (`csv` or `managed`).
- `VITE_AUTH_MANAGED_PROVIDER_LABEL` (default: `Identity Provider`): provider label shown on managed login screen.

Examples:
- local API: `VITE_API_URL=http://localhost:8000`
- deployed API: `VITE_API_URL=https://your-api-host.example.com`

See `web-ui/.env.example` for a ready-to-copy template.

## Auth Behavior

- When API auth is enabled (`API_AUTH_ENABLED=true`), the web app redirects unauthenticated users to `/login`.
- `VITE_AUTH_MODE=csv`: login calls `POST /api/auth/login`.
- `VITE_AUTH_MODE=managed`: login exchanges provider token via `POST /api/auth/exchange`.
- API requests automatically include `Authorization: Bearer <token>`.
