# Swing Screener — Agent Handover Context

Read this before picking up any feature plan. It describes the codebase conventions every agent must follow.

---

## Current implementation status - 2026-05-07

Tier 1 (F1-F5) merged to main. Tier 2 (F6-F8) implemented locally, PRs pending.

| Feature | Branch | Base | PR | Status |
|---|---|---|---|---|
| Feature 1 - Trade tagging | `codex/trade-tagging` | `main` | https://github.com/matteolongo/swing_screener/pull/232 | Merged to main |
| Feature 2 - Edge breakdown | `codex/edge-breakdown` | `main` | https://github.com/matteolongo/swing_screener/pull/233 | Merged to main |
| Feature 3 - Account equity auto-update | `codex/account-equity` | `main` | https://github.com/matteolongo/swing_screener/pull/234 | Merged to main |
| Feature 4 - Earnings proximity warning | `codex/earnings-warning` | `main` | https://github.com/matteolongo/swing_screener/pull/235 | Merged to main |
| Feature 5 - Concentration warning | `codex/concentration-warning` | `main` | https://github.com/matteolongo/swing_screener/pull/236 | Merged to main |
| Feature 6 - Time stop nudge | `codex/time-stop-nudge` | `main` | pending | Squashed into main via #232; no standalone PR |
| Feature 7 - Watchlist pipeline | `codex/watchlist-pipeline-v2` | `main` | pending | PR pending |
| Feature 8 - Volume quality signal | `codex/volume-quality` | `main` | pending | PR pending |

All branches now base off `main` (F1-F5 merged). Review each PR diff against `main`.

Known local files to exclude from commits:

- `data/screener_history.json`

Validation already run during implementation:

- Feature 1: backend trade tagging test, frontend typecheck, focused modal/journal tests, frontend suite during the feature work.
- Feature 2: focused `EdgeBreakdownTable` test and frontend suite during the feature work.
- Feature 3: `pytest tests/api/test_account_equity.py -v`, `pytest -q`, `cd web-ui && npm run typecheck`, `cd web-ui && npx vitest run src/components/domain/strategy/EnhancedRiskCard.test.tsx`, `cd web-ui && npx vitest run`.
- Feature 4: `pytest tests/api/test_earnings_proximity.py -v` (includes cache-hit coverage), `pytest -q`, `cd web-ui && npm run typecheck`, `cd web-ui && npx vitest run`.
- Feature 5: `pytest tests/api/test_concentration.py -v`, `cd web-ui && npx vitest run src/components/domain/portfolio/ConcentrationBar.test.tsx`, focused order review frontend tests, `pytest -q`, `cd web-ui && npm run typecheck`, `cd web-ui && npx vitest run`.
- Feature 6: `pytest tests/api/test_time_stop_nudge.py -v`, `cd web-ui && npx vitest run src/components/domain/workspace/PortfolioTable.test.tsx`, `cd web-ui && npm run typecheck`.
- Feature 7: `pytest tests/api/test_watchlist_service.py tests/api/test_daily_review_service.py tests/api/test_watchlist_endpoints.py`, `cd web-ui && npm test -- --run src/components/domain/watchlist/WatchlistPipelinePanel.test.tsx src/features/dailyReview/types.test.ts src/pages/Today.test.tsx src/features/watchlist/hooks.test.tsx`, `cd web-ui && npm run typecheck`.

## What this app is

A deterministic, risk-first swing-trading framework. It screens stocks post-market-close, sizes positions using R-multiples (`1R = entry_price - stop_price`), and keeps all execution manual. No live trading, no auto-execution.

## Stack

- **Backend:** Python 3.11+, FastAPI, Pydantic v2, `uv` package manager
- **Frontend:** React 18, TypeScript, Vite, Zustand, React Query (TanStack Query v5), Tailwind CSS
- **Data:** JSON files (`data/positions.json`, `data/orders.json`) — not a database
- **Tests backend:** `pytest` — run with `pytest -q` from repo root
- **Tests frontend:** Vitest + Testing Library + MSW — run with `npx vitest run` from `web-ui/`

## Layer map

```
web-ui/src/
  pages/             # Route-level page components (Book.tsx, Today.tsx, etc.)
  components/domain/ # Feature-specific components (portfolio/, orders/, screener/, etc.)
  features/portfolio/
    api.ts           # All fetch functions — add new API calls here
    hooks.ts         # All React Query hooks — add useXxx hooks here
    types.ts         # Re-exports from types/*
  types/
    position.ts      # Position, PositionApiResponse, transformPosition()
    order.ts         # Order, OrderApiResponse, transformOrder()
  i18n/messages.en.ts  # ALL user-facing strings live here — no hardcoded strings in components
  lib/api.ts         # API_ENDPOINTS constant — all endpoint paths defined here

api/
  routers/portfolio.py   # FastAPI router — all portfolio endpoints
  services/portfolio_service.py  # Business logic
  models/portfolio.py    # Pydantic request/response models
  repositories/
    positions_repo.py    # positions.json read/write
    orders_repo.py       # orders.json read/write
  dependencies.py        # FastAPI Depends factories
```

## Critical conventions

### snake_case ↔ camelCase
Backend uses `snake_case`. Frontend uses `camelCase`. Transform **only** at the API boundary using `transformPosition()`, `transformOrder()` in `web-ui/src/types/`. Never use snake_case in React components.

### i18n
Every user-visible string must use `t('key')` from `web-ui/src/i18n/t.ts`. Add keys to `web-ui/src/i18n/messages.en.ts`. Never hardcode English strings in components or test assertions — use `t('key')` in tests too.

### R-multiples
All risk is measured in R. `1R = entry_price - stop_price`. Never use fixed-dollar or percentage alternatives for risk logic.

### JSON file I/O
Use `locked_read_json` / `locked_write_json` from `api/utils/file_lock.py` — never `json.load` directly. These handle concurrent access.

### Config
- `config/defaults.yaml` — system defaults
- `config/user.yaml` — user overrides (may not exist)
- `config/strategies.yaml` — strategy-specific config
- Read via `get_settings_manager()` from `swing_screener.settings`

### Adding a backend endpoint
1. Add Pydantic model to `api/models/portfolio.py`
2. Add service method to `api/services/portfolio_service.py`
3. Add route to `api/routers/portfolio.py`

### Adding a frontend API call
1. Add endpoint path to `API_ENDPOINTS` in `web-ui/src/lib/api.ts`
2. Add fetch function to `web-ui/src/features/portfolio/api.ts`
3. Add React Query hook to `web-ui/src/features/portfolio/hooks.ts`

### Testing (backend)
- Test files in `tests/api/` or `tests/` matching module structure
- Use `pytest` fixtures for shared state
- Use `monkeypatch` to override `api.dependencies._positions_path` and `api.dependencies._orders_path` with tmp files
- Never test with real `data/positions.json` — always use tmp files

### Testing (frontend)
- Use `renderWithProviders()` from `web-ui/src/test/utils.tsx`
- Mock API calls with MSW: `server.use(http.get('*/api/...', () => HttpResponse.json({...})))` 
- Import server from `@/test/mocks/server`
- Use `screen.findByText(t('i18n.key'))` — never hardcode strings in assertions

### Committing
- `feat:` for new features, `fix:` for bugs, `chore:` for plumbing
- Each task ends with a commit
- Full test suite before pushing: `pytest -q && cd web-ui && npx vitest run`

## Key files to read before each plan

| Feature area | Files to read |
|---|---|
| Position model | `api/models/portfolio.py` lines 14–38, `web-ui/src/types/position.ts` |
| Service pattern | `api/services/portfolio_service.py` — `close_position()` at line 759 |
| Config/manage | `config/defaults.yaml` lines 20–27 |
| Analytics page | `web-ui/src/pages/Analytics.tsx` (top ~100 lines for pattern) |
| Journal page | `web-ui/src/pages/Journal.tsx` (top ~60 lines for pattern) |
| Frontend hooks | `web-ui/src/features/portfolio/hooks.ts` |
| i18n | `web-ui/src/i18n/messages.en.ts` |
| Test pattern | `web-ui/src/components/domain/orders/PendingOrdersTab.test.tsx` |

## Active branch

F6-F8 are implemented. PRs pending for F7 (`codex/watchlist-pipeline-v2`) and F8 (`codex/volume-quality`).

Next work should continue Tier 2 with Feature 9 — Liquidity filter (or Feature 10 — Partial exits). Start new branches from `main`.
