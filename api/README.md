# Swing Screener API

FastAPI REST API for the Swing Screener trading system.

## Quick Start

### Start the API Server

```bash
cd /Users/matteo.longo/projects/randomness/trading/swing_screener
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

Server will be available at:
- **API**: http://localhost:8000
- **Interactive docs**: http://localhost:8000/docs
- **OpenAPI schema**: http://localhost:8000/openapi.json

## API Endpoints

### Health & Info

#### `GET /`
Root endpoint - API information.

```bash
curl http://localhost:8000/
```

####` GET /health`
Health check.

```bash
curl http://localhost:8000/health
```

---

### Config Router (`/api/config`)

Manage application settings (risk, indicators, position management).

#### `GET /api/config`
Get current configuration.

```bash
curl http://localhost:8000/api/config
```

#### `PUT /api/config`
Update configuration.

```bash
curl -X PUT http://localhost:8000/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "risk": {
      "account_size": 100000,
      "risk_pct": 0.02,
      "max_position_pct": 0.60,
      "min_shares": 1,
      "k_atr": 2.0
    },
    "indicators": {
      "sma_fast": 20,
      "sma_mid": 50,
      "sma_long": 200,
      "atr_window": 14,
      "lookback_6m": 126,
      "lookback_12m": 252,
      "benchmark": "SPY",
      "breakout_lookback": 50,
      "pullback_ma": 20,
      "min_history": 260
    },
    "manage": {
      "breakeven_at_r": 1.0,
      "trail_after_r": 2.0,
      "trail_sma": 20,
      "sma_buffer_pct": 0.005,
      "max_holding_days": 20
    },
    "positions_file": "positions.json",
    "orders_file": "orders.json"
  }'
```

#### `POST /api/config/reset`
Reset configuration to defaults.

```bash
curl -X POST http://localhost:8000/api/config/reset
```

#### `GET /api/config/defaults`
Get default configuration.

```bash
curl http://localhost:8000/api/config/defaults
```

---

### Portfolio Router (`/api/portfolio`)

Manage positions and orders.

#### Positions

**`GET /api/portfolio/positions`**  
Get all positions, optionally filtered by status.

```bash
# Get all positions
curl http://localhost:8000/api/portfolio/positions

# Get only open positions
curl http://localhost:8000/api/portfolio/positions?status=open

# Get only closed positions
curl http://localhost:8000/api/portfolio/positions?status=closed
```

**`GET /api/portfolio/positions/{position_id}`**  
Get a specific position by ID.

```bash
curl http://localhost:8000/api/portfolio/positions/POS-VALE-20260116-01
```

**`PUT /api/portfolio/positions/{position_id}/stop`**  
Update stop price for a position (only moves UP).

```bash
curl -X PUT http://localhost:8000/api/portfolio/positions/POS-VALE-20260116-01/stop \
  -H "Content-Type: application/json" \
  -d '{
    "new_stop": 15.50,
    "reason": "trailing stop after +2R"
  }'
```

**`POST /api/portfolio/positions/{position_id}/close`**  
Close a position.

```bash
curl -X POST http://localhost:8000/api/portfolio/positions/POS-VALE-20260116-01/close \
  -H "Content-Type: application/json" \
  -d '{
    "exit_price": 17.25,
    "reason": "profit target reached"
  }'
```

#### Orders

**`GET /api/portfolio/orders`**  
Get all orders, optionally filtered.

```bash
# Get all orders
curl http://localhost:8000/api/portfolio/orders

# Get only pending orders
curl http://localhost:8000/api/portfolio/orders?status=pending

# Get orders for a ticker
curl http://localhost:8000/api/portfolio/orders?ticker=VALE
```

**`GET /api/portfolio/orders/{order_id}`**  
Get a specific order by ID.

```bash
curl http://localhost:8000/api/portfolio/orders/ORD-VALE-20260116-ENTRY
```

**`POST /api/portfolio/orders`**  
Create a new order.

```bash
curl -X POST http://localhost:8000/api/portfolio/orders \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "AAPL",
    "order_type": "BUY_LIMIT",
    "quantity": 10,
    "limit_price": 175.50,
    "stop_price": 170.00,
    "notes": "breakout entry",
    "order_kind": "entry"
  }'
```

**`POST /api/portfolio/orders/{order_id}/fill`**  
Fill an order.

```bash
curl -X POST http://localhost:8000/api/portfolio/orders/AAPL-20260205001815/fill \
  -H "Content-Type: application/json" \
  -d '{
    "filled_price": 175.45,
    "filled_date": "2026-02-05"
  }'
```

---

### Backtest Router (`/api/backtest`)

Run backtests and manage saved simulations.

**`POST /api/backtest/quick`**  
Quick single‑ticker backtest (existing modal).

**`POST /api/backtest/run`**  
Full backtest for one or more tickers. Automatically saves the simulation to disk.

Key request fields:
- `tickers` (list of symbols)
- `start`, `end` (YYYY‑MM‑DD)
- `entry_type` (`auto`, `breakout`, `pullback`)
- Backtest params: `breakout_lookback`, `pullback_ma`, `min_history`, `atr_window`, `k_atr`,
  `breakeven_at_r`, `trail_after_r`, `trail_sma`, `sma_buffer_pct`, `max_holding_days`, `commission_pct`

**`GET /api/backtest/simulations`**  
List saved simulations (metadata only).

**`GET /api/backtest/simulations/{id}`**  
Load a saved simulation (params + results).

**`DELETE /api/backtest/simulations/{id}`**  
Delete a saved simulation.

**`DELETE /api/portfolio/orders/{order_id}`**  
Cancel an order.

```bash
curl -X DELETE http://localhost:8000/api/portfolio/orders/AAPL-20260205001815
```

---

### Screener Router (`/api/screener`)

Run the screener and preview orders.

#### `GET /api/screener/universes`
List available universe files.

```bash
curl http://localhost:8000/api/screener/universes
```

Response:
```json
{
  "universes": ["mega", "mega_defense", "mega_europe", "mega_healthcare_biotech"]
}
```

#### `POST /api/screener/run`
Run the screener on a universe.

```bash
# Using a named universe
curl -X POST http://localhost:8000/api/screener/run \
  -H "Content-Type: application/json" \
  -d '{
    "universe": "mega",
    "top": 20
  }'

# Using explicit tickers
curl -X POST http://localhost:8000/api/screener/run \
  -H "Content-Type: application/json" \
  -d '{
    "tickers": ["AAPL", "MSFT", "GOOGL"],
    "top": 10
  }'

# With specific date
curl -X POST http://localhost:8000/api/screener/run \
  -H "Content-Type: application/json" \
  -d '{
    "universe": "mega",
    "top": 20,
    "asof_date": "2026-02-03"
  }'
```

Response:
```json
{
  "candidates": [
    {
      "ticker": "NVDA",
      "close": 750.25,
      "sma_20": 735.50,
      "sma_50": 720.00,
      "sma_200": 650.00,
      "atr": 15.75,
      "momentum_6m": 0.45,
      "momentum_12m": 1.25,
      "rel_strength": 0.35,
      "score": 0.92,
      "rank": 1
    }
  ],
  "asof_date": "2026-02-05",
  "total_screened": 50
}
```

#### `POST /api/screener/preview-order`
Preview order calculations (shares, position size, risk).

```bash
curl -X POST "http://localhost:8000/api/screener/preview-order?ticker=NVDA&entry_price=750.25&stop_price=735.00&account_size=50000&risk_pct=0.01"
```

Response:
```json
{
  "ticker": "NVDA",
  "entry_price": 750.25,
  "stop_price": 735.00,
  "atr": 15.25,
  "shares": 32,
  "position_size_usd": 24008.00,
  "risk_usd": 488.00,
  "risk_pct": 0.00976
}
```

---

## CORS Configuration

The API allows requests from:
- `http://localhost:5173` (Vite dev server)
- `http://localhost:5174` (Vite dev server alternate)

To add more origins, edit `api/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://your-domain.com",  # Add your domain
    ],
    ...
)
```

---

## Data Files

The API reads/writes to:
- `positions.json` - Open and closed positions
- `orders.json` - Pending, filled, and cancelled orders

These files are at the repository root.

---

## Error Handling

All endpoints return standard HTTP status codes:

- **200 OK** - Success
- **400 Bad Request** - Validation error
- **404 Not Found** - Resource not found
- **500 Internal Server Error** - Server error

Error response format:
```json
{
  "detail": "Error message",
  "error_type": "ValueError"
}
```

---

## Development

### Run in development mode (auto-reload)

```bash
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

### Run in production mode

```bash
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## Testing

### Quick health check

```bash
curl http://localhost:8000/health
```

### Test all endpoints

```bash
# Config
curl http://localhost:8000/api/config

# Positions
curl http://localhost:8000/api/portfolio/positions?status=open

# Orders
curl http://localhost:8000/api/portfolio/orders?status=pending

# Universes
curl http://localhost:8000/api/screener/universes
```

---

## Architecture

```
api/
├── main.py              # FastAPI app, CORS, lifespan
├── models.py            # Pydantic models (request/response)
├── dependencies.py      # Shared helpers (JSON I/O)
└── routers/
    ├── config.py        # Config endpoints
    ├── screener.py      # Screener endpoints
    └── portfolio.py     # Positions & orders endpoints
```

---

## Notes

### Risk-First Principles

- **Stop updates**: Can only move stops UP (never down)
- **R-multiples**: All position management based on R
- **No auto-execution**: All orders require manual action
- **Transparent**: No hidden state or magic

### State Management

- **Filesystem-based**: JSON files are single source of truth
- **No caching**: Every request reads fresh data
- **Atomic writes**: Changes written immediately

### Integration with CLI

The API uses the same Python modules as the CLI:
- `swing_screener.data.*` - Market data & universes
- `swing_screener.portfolio.*` - Position management
- `swing_screener.execution.*` - Order handling
- `swing_screener.reporting.*` - Screener logic

No duplication of business logic.

---

## Next Steps

To connect the web UI:
1. Start the API server
2. Start the web UI: `cd web-ui && npm run dev`
3. Web UI will connect to `http://localhost:8000`

---

_End of API README_
