# Swing Screener API

FastAPI service that exposes the Swing Screener backend as a REST API.

## Run
```bash
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

Docs:
- `http://localhost:8000/docs`
- `http://localhost:8000/openapi.json`

## Data + Concurrency
- Primary persistence: JSON files in `data/` (orders, positions, strategies, config).
- File access is guarded by `api/utils/file_lock.py` to avoid concurrent write races.
- Database module exists but is not wired by default (see `docs/engineering/DATABASE_MIGRATION.md`).

## API Surface (by router)
Health:
- `GET /`
- `GET /health`
- `GET /metrics`

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
