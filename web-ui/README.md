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

Examples:
- local API: `VITE_API_URL=http://localhost:8000`
- deployed API: `VITE_API_URL=https://your-api-host.example.com`

See `web-ui/.env.example` for a ready-to-copy template.
