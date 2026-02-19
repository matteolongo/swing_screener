# Swing Screener API

FastAPI service that exposes the Swing Screener backend as a REST API.

## Run
```bash
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

Production-style run (platform injects `PORT`):
```bash
PORT=8000 API_RELOAD=false python -m uvicorn api.main:app --host 0.0.0.0 --port "${PORT}"
```

## Environment Variables

- `PORT` (default: `8000`): API bind port.
- `API_HOST` (default: `0.0.0.0`): API bind host.
- `API_RELOAD` (default: `true`): enable/disable uvicorn reload.
- `API_CORS_ALLOWED_ORIGINS` (default: `http://localhost:5173,http://localhost:5174`): comma-separated origin allowlist.
- `API_CORS_ALLOWED_METHODS` (default: `GET,POST,PUT,DELETE,PATCH`): comma-separated CORS methods.
- `API_CORS_ALLOWED_HEADERS` (default: `Content-Type,Authorization,Accept,Origin,User-Agent,X-Requested-With`): comma-separated CORS headers.
- `API_AUTH_ENABLED` (default: `false`): enable temporary CSV authentication.
- `API_AUTH_USERS_CSV_PATH` (default: `data/users.csv`): path to CSV users file.
- `API_AUTH_JWT_SECRET` (default: `dev-only-insecure-secret`): JWT signing secret (must be replaced in non-local envs).
- `API_AUTH_JWT_EXPIRE_MINUTES` (default: `480`): bearer token validity in minutes.

See `api/.env.example` for a ready-to-copy template.

Docs:
- `http://localhost:8000/docs`
- `http://localhost:8000/openapi.json`

## Data + Concurrency
- Primary persistence: JSON files in `data/` (orders, positions, strategies, config).
- File access is guarded by `api/utils/file_lock.py` to avoid concurrent write races.
- Database module exists but is not wired by default (see `docs/engineering/DATABASE_MIGRATION.md`).

### Tenant file mode

When `API_AUTH_ENABLED=true`, file-backed state is tenant-scoped under:

- `data/tenants/<tenant_id>/orders.json`
- `data/tenants/<tenant_id>/positions.json`
- `data/tenants/<tenant_id>/strategies.json`
- `data/tenants/<tenant_id>/active_strategy.json`
- `data/tenants/<tenant_id>/config.json`
- `data/tenants/<tenant_id>/intelligence/*`

## API Surface (by router)
Health:
- `GET /`
- `GET /health`
- `GET /metrics`

Auth (`/api/auth`):
- `POST /api/auth/login`
- `GET /api/auth/me`

When `API_AUTH_ENABLED=true`, these router groups require bearer auth:
- `/api/config`
- `/api/strategy`
- `/api/portfolio`
- `/api/backtest`
- `/api/social`
- `/api/intelligence`
- `/api/daily-review`

Config (`/api/config`):
- `GET /api/config`
- `PUT /api/config`
- `POST /api/config/reset`
- `GET /api/config/defaults`

Strategy (`/api/strategy`):
- `GET /api/strategy`
- `GET /api/strategy/active`
- `POST /api/strategy/active`
- `POST /api/strategy/validate`
- `GET /api/strategy/{strategy_id}`
- `POST /api/strategy`
- `PUT /api/strategy/{strategy_id}`
- `DELETE /api/strategy/{strategy_id}`

Screener (`/api/screener`):
- `GET /api/screener/universes`
- `POST /api/screener/run`
- `POST /api/screener/preview-order`

Portfolio (`/api/portfolio`):
- `GET /api/portfolio/positions`
- `GET /api/portfolio/positions/{position_id}`
- `GET /api/portfolio/positions/{position_id}/metrics`
- `PUT /api/portfolio/positions/{position_id}/stop`
- `GET /api/portfolio/positions/{position_id}/stop-suggestion`
- `POST /api/portfolio/positions/{position_id}/close`
- `GET /api/portfolio/summary`
- `GET /api/portfolio/orders`
- `GET /api/portfolio/orders/snapshot`
- `GET /api/portfolio/orders/{order_id}`
- `POST /api/portfolio/orders`
- `POST /api/portfolio/orders/{order_id}/fill`
- `DELETE /api/portfolio/orders/{order_id}`

Backtest (`/api/backtest`):
- `POST /api/backtest/quick`
- `POST /api/backtest/run`
- `GET /api/backtest/simulations`
- `GET /api/backtest/simulations/{sim_id}`
- `DELETE /api/backtest/simulations/{sim_id}`

Daily Review (`/api/daily-review`):
- `GET /api/daily-review`

Intelligence (`/api/intelligence`):
- `POST /api/intelligence/run`
- `GET /api/intelligence/run/{job_id}`
- `GET /api/intelligence/opportunities`
- `POST /api/intelligence/classify`

Social (`/api/social`):
- `GET /api/social/providers`
- `POST /api/social/analyze`
- `GET /api/social/warmup/{job_id}`

## Ownership
Routers live in `api/routers/` and call services in `api/services/`.
