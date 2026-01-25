# Frontend Implementation Plan (Next.js)

## Context
- New UI lives in `ui_next/` (do not modify existing Streamlit UI).
- Backend API is local-only; no auth; runs in Python project.
- User workflow:
  1) Run screening
  2) Add new orders if any
  3) Dashboard with open orders where user can edit
     - fill date
     - entry price
     - stop loss
     - lock/unlock
  4) Update positions (stop loss, status)
  5) Preview changes
  6) Apply explicitly

## UX goals
- Admin-style dashboard.
- Orders and positions in one place with easy edits.
- Clear separation between "preview" and "apply".
- Locking prevents edits (both orders + positions).

## Proposed app structure
- `ui_next/`
  - `app/`
    - `layout.tsx`
    - `page.tsx` (dashboard)
    - `components/`
      - `OrdersTable.tsx`
      - `PositionsTable.tsx`
      - `PreviewPanel.tsx`
      - `RoutinePanel.tsx` (screening + apply)
  - `lib/api.ts` (API client)
  - `lib/types.ts`
  - `tests/` (component tests)

## UI layout (dashboard)
- Top section: Daily Routine
  - Buttons: Run Screening, Preview Changes, Apply
  - Show last run timestamp
  - Show warnings from preview
- Middle section: Orders
  - Table with inline editable cells
  - Columns: ticker, status, order_type, limit_price, quantity, stop_price, order_date, filled_date, entry_price, notes, locked
  - Lock toggle; when locked, all row inputs are disabled
- Bottom section: Positions
  - Columns: ticker, status, entry_date, entry_price, stop_price, shares, notes, locked
  - Editable fields: stop_price, status (only)
  - Lock toggle disables edits

## Data flow
- On load:
  - `GET /orders`
  - `GET /positions`
- Edit in UI is staged in client state; no write until Apply.
- Preview:
  - `POST /preview` with staged changes
  - Show diff/warnings
- Apply:
  - `POST /apply`
  - On success, refetch orders + positions

## API schemas used by UI (must match backend)

### Order (UI expects full objects)
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

### Position
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

### Preview request/response
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

## Component tests (React Testing Library)
- OrdersTable renders rows and disables inputs when locked.
- PositionsTable allows only stop/status edits.
- PreviewPanel shows diff and warnings.

## E2E tests (Playwright)
- Load dashboard; verify orders/positions present.
- Edit an order + position; preview shows diff.
- Apply writes changes (verify via refreshed data).
- Lock row and confirm inputs disabled.

## Open questions / decisions to confirm
- Should lock be displayed as a per-order field or combined lock for order+position by ticker?
- Should screening results be shown in the dashboard or a separate view/accordion?
- Should preview show diffs inline in tables or only in a panel?

## Assumptions
- Next.js with TypeScript and App Router.
- Local API base URL provided via env (e.g., `NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000`).
- Styling can be simple but clean; no design system required.
