# Backend Implementation Plan (API)

## Context
- Project: Swing Screener (Python 3.11+)
- Current UI: Streamlit app in `ui/app.py`
- New UI: Next.js app in `ui_next/` (separate)
- Local-only usage; no auth; localhost only.
- Source of truth: `positions.json` for open trades. `orders.json` is also edited and kept consistent.
- Locking: lock applies to both order + position; prevents edits if locked.
- Apply flow: preview changes first; apply only when explicitly requested.

## Files and existing helpers
- `ui/helpers.py` includes order helpers: `load_orders`, `save_orders`, `orders_to_dataframe`, `make_order_entry`.
- `swing_screener/portfolio/state.py` manages positions: `load_positions`, `save_positions`, `evaluate_positions`, etc.
- Streamlit flow has:
  - screening report creation
  - manage positions
  - write reports/CSV/MD

## Goals
- Add a local API inside the Python project (FastAPI recommended).
- Provide endpoints for screening preview, orders/positions fetch/update, preview changes, and apply.
- Keep deterministic logic and align with R-based rules; no hidden automation.
- Apply must be explicit; preview shows diff before writing files.

## Proposed module layout
- Add `src/swing_screener/api/` with:
  - `__init__.py`
  - `app.py` (FastAPI instance)
  - `models.py` (Pydantic models)
  - `service.py` (business logic; pure-ish functions)
  - `routes.py` (API routes)
- Add tests in `tests/api/`.

## API contract (proposed)

### Health
- `GET /health`
  - Response: `{ "status": "ok" }`

### Orders
- `GET /orders`
  - Response: `{ "orders": [Order], "asof": "YYYY-MM-DD" }`

- `PATCH /orders/{order_id}`
  - Body: partial Order fields (e.g., `filled_date`, `entry_price`, `stop_price`, `status`, `notes`, `locked`)
  - Validation: if locked, reject; status in {pending, filled, cancelled}
  - Response: updated Order

### Positions
- `GET /positions`
  - Response: `{ "positions": [Position], "asof": "YYYY-MM-DD" }`

- `PATCH /positions/{ticker}`
  - Allowed fields: `stop_price`, `status`
  - Validation: if locked, reject; status in {open, closed}
  - Response: updated Position

### Screening (preview only)
- `POST /screening/run`
  - Body: minimal run config (reuse existing config defaults)
  - Response: preview report rows + suggested orders (no file write) or write only to temp/preview

### Preview and Apply
- `POST /preview`
  - Body: `{ orders: [Order], positions: [Position] }` or patch list
  - Response: `{ diff: {...}, warnings: [...] }`

- `POST /apply`
  - Body: same as preview or references to staged edits
  - Behavior: writes to `orders.json` and `positions.json` only if user explicitly calls apply.
  - Response: `{ success: true, asof: "YYYY-MM-DD" }`

## API schemas (consistent, required fields)

### Order (returned by API)
```json
{
  "order_id": "VALE-20260115223637",
  "ticker": "VALE",
  "status": "pending",
  "order_type": "BUY_LIMIT",
  "limit_price": 14.6,
  "quantity": 1,
  "stop_price": 14.02,
  "order_date": "2026-01-15",
  "filled_date": "2026-01-16",
  "entry_price": 14.6,
  "notes": "",
  "locked": false
}
```
- `status`: `pending | filled | cancelled`
- `order_type`: `BUY_LIMIT | BUY_STOP | SKIP`
- `filled_date` empty string when not filled.

### Position (returned by API)
```json
{
  "ticker": "VALE",
  "status": "open",
  "entry_date": "2026-01-16",
  "entry_price": 14.6,
  "stop_price": 14.02,
  "shares": 1,
  "notes": "",
  "locked": false
}
```
- `status`: `open | closed`
- `locked` prevents edits from both Orders and Positions endpoints.

### GET /orders response
```json
{
  "asof": "2026-01-21",
  "orders": [ { "order_id": "..." } ]
}
```

### GET /positions response
```json
{
  "asof": "2026-01-21",
  "positions": [ { "ticker": "..." } ]
}
```

### PATCH /orders/{order_id} request/response
Request body (partial):
```json
{
  "filled_date": "2026-01-16",
  "entry_price": 14.6,
  "stop_price": 14.02,
  "status": "filled",
  "locked": true
}
```
Response: full Order object.

### PATCH /positions/{ticker} request/response
Request body (partial, only allowed fields):
```json
{
  "stop_price": 13.85,
  "status": "open",
  "locked": false
}
```
Response: full Position object.

### POST /preview request/response
Request:
```json
{
  "orders": [ { "order_id": "VALE-20260115223637", "locked": true } ],
  "positions": [ { "ticker": "VALE", "stop_price": 13.85 } ]
}
```
Response:
```json
{
  "diff": {
    "orders": [ { "order_id": "VALE-20260115223637", "changes": { "locked": [false, true] } } ],
    "positions": [ { "ticker": "VALE", "changes": { "stop_price": [14.02, 13.85] } } ]
  },
  "warnings": []
}
```

### POST /apply request/response
Request: same as preview request.
Response:
```json
{
  "success": true,
  "asof": "2026-01-21"
}
```

## Data model updates
- Extend Order with `locked: bool` (default false).
- Optionally extend Position with `locked: bool` or store lock in orders with a mapping by ticker.
- Lock should prevent edits on both sides; if stored on order only, check lock by ticker when patching position.

## Implementation details
- Use Pydantic models with type hints.
- Keep pure functions in `service.py` for:
  - load/save orders
  - load/save positions
  - compute diffs for preview
  - apply edits with validation
- Avoid changing CLI behavior unless needed.

## Tests (pytest)
- `tests/api/test_orders.py`
  - load orders
  - patch order
  - lock prevents edits
- `tests/api/test_positions.py`
  - patch stop/status only
  - lock prevents edits
- `tests/api/test_preview_apply.py`
  - preview returns diff
  - apply writes files
- Use temp directories/fixtures; avoid touching real `orders.json` / `positions.json`.

## Open questions / decisions to confirm
- Should lock be stored on Order only or also Position? (If only on Order, check by ticker.)
- How strict should validation be for entry/fill dates and prices?
- Should apply also update positions based on filled orders automatically, or only persist edits?
- How to compute diff: simple field-level compare or include derived warnings?

## Assumptions
- FastAPI is acceptable as a dependency; if not, use Flask or internal CLI-run server.
- UI will handle staging edits and call preview/apply explicitly.
