# Pending Orders Visibility + DeGiro Fill Linking — Design Spec

## Goal

Make locally-created pending orders visible in the UI and provide a "Fill via DeGiro" workflow that links a local pending order to its actual DeGiro fill, pulling real fill price and fees, then creates an open position so the screener and daily review can suggest stop adjustments and operations.

## Background / Problem

When a user creates a pending entry order in the app (e.g. SBMO) and then places it manually in DeGiro, two problems occur:

1. The pending order is invisible after creation — there is no orders tab or list anywhere in the UI. The user cannot see it, act on it, or fill it.
2. Because no fill workflow exists, no open position is ever created from the order. The screener and daily review never surface stop-loss suggestions or add-on candidates for that symbol.

The DeGiro sync `apply` endpoint only processes position updates — it has never processed order creation or fills. This design adds the missing workflow without touching the sync flow.

## Architecture

### What gets built

1. **Orders tab in Book page** — lists all `pending` entry orders; the entry point for the fill workflow.
2. **"Fill via DeGiro" modal** — fetches DeGiro order history, user picks the matching order, app writes fill data and creates the position.
3. **"Fill manually" fallback** — inline form for fill price + date + fee when DeGiro is not connected.
4. **Backend: broker fields on Order model** — `broker_order_id`, `broker`, `broker_synced_at`, `fill_price`, `fill_date` added as optional nullable fields.
5. **New endpoint: `POST /api/portfolio/orders/{order_id}/fill-from-degiro`** — accepts a `degiro_order_id`, fetches from DeGiro, fills the local order, creates the position.
6. **New endpoint: `GET /api/portfolio/degiro/order-history`** — returns recently filled DeGiro orders (separate from the existing pending-orders endpoint).
7. **Today page: pending orders count badge** — small "N pending" indicator so the user is reminded without navigating to Book.

### What does NOT change

- The existing order creation flow (`POST /api/portfolio/orders`) is unchanged.
- The DeGiro sync preview/apply flow is unchanged.
- The position creation logic on fill is unchanged — the new endpoint reuses the existing `fill_order` service method, passing DeGiro data as the fill source.

---

## Data Model

### Order — new fields

All fields are optional with `null` defaults. No migration needed; existing `orders.json` records are valid as-is.

```python
broker_order_id: str | None = None    # DeGiro's order ID once linked
broker: str | None = None             # "degiro" (extensible for other brokers)
broker_synced_at: str | None = None   # ISO-8601 timestamp when linked
fill_price: float | None = None       # actual fill price (may differ from limit_price)
fill_date: str | None = None          # actual fill date (YYYY-MM-DD)
# fee_eur already exists — populated on fill from DeGiro transaction data
```

### Position creation on fill

When `fill-from-degiro` is called:
- `entry_price` = fill price from DeGiro
- `entry_date` = fill date from DeGiro
- `source_order_id` = local order ID
- `broker` = "degiro"
- `broker_product_id` = DeGiro product ID
- `isin` = ISIN from DeGiro order
- `broker_synced_at` = now (ISO timestamp)
- `initial_risk` = `(fill_price - stop_price) * shares`

---

## API

### `GET /api/portfolio/degiro/order-history`

Returns recently filled/cancelled DeGiro orders. Uses the existing `DegiroClient` — calls the order history endpoint (separate from pending orders).

Response:
```json
{
  "orders": [
    {
      "order_id": "abc123",
      "product_id": "789",
      "isin": "NL0010273215",
      "product_name": "SBMO Offshore",
      "status": "filled",
      "price": 12.34,
      "quantity": 200,
      "side": "buy",
      "created_at": "2026-04-25T09:14:00Z"
    }
  ],
  "asof": "2026-04-27"
}
```

### `POST /api/portfolio/orders/{order_id}/fill-from-degiro`

Request body:
```json
{ "degiro_order_id": "abc123" }
```

Business logic:
1. Load local order by `order_id` — 404 if not found, 409 if already `filled` or `cancelled`.
2. Fetch order detail from DeGiro by `degiro_order_id`.
3. Warn (but do not block) if DeGiro quantity ≠ local order quantity.
4. Call existing `fill_order(order_id, fill_price, fill_date, fee_eur)` service method.
5. Write `broker_order_id`, `broker`, `broker_synced_at`, `fill_price`, `fill_date` to the order record.
6. Return the created position.

Response: the new `Position` object (same shape as `GET /api/portfolio/positions/{id}`).

Error cases:
- `404` — order not found
- `409` — order already filled
- `422` — DeGiro order ID not found in DeGiro history
- `503` — DeGiro credentials not configured

---

## UI

### Book page — Orders tab

New tab added between "Positions" and "Journal":

```
[ Positions ] [ Orders ] [ Journal ] [ Performance ] [ Review ]
```

Tab content — pending entry orders table:

| Ticker | Shares | Limit price | Created | Thesis | Actions |
|--------|--------|-------------|---------|--------|---------|
| SBMO   | 200    | €12.50      | Apr 25  | ...    | [Fill via DeGiro] [Fill manually] |

- Only `pending` orders with `order_kind = "entry"` shown (stop/take-profit orders are position-managed, not user-facing here).
- Empty state: "No pending orders — create one from the Today page when a candidate is ready."
- "Fill via DeGiro" button disabled + tooltip "DeGiro not connected" when credentials are missing.

### "Fill via DeGiro" modal

1. Opens → spinner while `GET /api/portfolio/degiro/order-history` loads.
2. Order list rendered, filtered to same ticker if ISIN/ticker matches (others shown below a divider "Other recent orders").
3. Each row: product name, fill price, quantity, date.
4. Selecting a row shows a confirmation preview:
   - Fill price: €12.34
   - Shares: 200
   - Fee: €2.10
   - Stop: €11.20 (from local order)
   - 1R: €228 (calculated)
   - Warning if quantity mismatch.
5. "Confirm Fill" button → `POST /orders/{id}/fill-from-degiro` → success toast "Position created for SBMO" → modal closes, order removed from list.
6. On API error → inline error message, modal stays open.

### "Fill manually" modal

Inline form fields:
- Fill price (required, number)
- Fill date (required, date picker, defaults to today)
- Fee in EUR (optional, number)

Submits to existing `POST /api/portfolio/orders/{order_id}/fill` (already exists or created as part of this work — see Tasks).

### Today page — pending orders badge

Small section above or below the daily review candidates:

```
⏳ 1 pending order  →  SBMO · 200 shares · €12.50 limit  [Go to Orders]
```

Only shown when `pendingOrders.length > 0`. Link navigates to Book → Orders tab.

---

## Error Handling

| Situation | Behaviour |
|-----------|-----------|
| DeGiro not configured | "Fill via DeGiro" disabled with tooltip |
| DeGiro API call fails | Modal shows error + offers "Fill manually" link |
| Quantity mismatch | Warning shown in confirmation step; user can still confirm |
| Order already filled | Button hidden; row not shown |
| Open position already exists for ticker | Fill blocked with message "Open position already exists for {ticker}" |

---

## Testing

### Backend

- `test_fill_from_degiro_creates_position` — mock DeGiro client returning one filled order; assert order status → `filled`, position created with correct `entry_price`, `broker_order_id`, `broker_synced_at`.
- `test_fill_from_degiro_quantity_mismatch_warns` — DeGiro quantity ≠ local; assert 200 response with `quantity_mismatch: true`, position still created.
- `test_fill_from_degiro_already_filled_returns_409` — call endpoint twice; second call → 409.
- `test_fill_from_degiro_no_credentials_returns_503` — no DeGiro config; assert 503.
- `test_get_degiro_order_history` — mock client; assert normalized response shape.

### Frontend

- `OrdersTab` renders pending orders list (MSW handler returning one order).
- `OrdersTab` renders empty state when no pending orders.
- `FillViaDegiroModal` renders DeGiro order list; selecting a row shows preview with fill price + 1R.
- `FillViaDegiroModal` shows quantity mismatch warning.
- `FillViaDegiroModal` calls confirm → order removed from list.
- `FillViaDegiroModal` shows error state on API failure.
- Today page pending badge renders when pending orders exist; hidden when empty.

---

## Out of scope

- Automatic matching (user-driven only).
- Stop and take-profit order fills (handled by position management, not this flow).
- Multiple partial fills from DeGiro (single fill per local order for now).
- Editing or cancelling a pending order from the Orders tab (future).
