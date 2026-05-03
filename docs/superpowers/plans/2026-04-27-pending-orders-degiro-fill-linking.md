# Pending Orders Visibility + DeGiro Fill Linking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make locally-created pending orders visible in the Book page and add a "Fill via DeGiro" workflow that links a pending order to its DeGiro fill, creating an open position so the screener/daily review can suggest stop adjustments.

**Architecture:** The backend gains three new endpoints: restore `GET /api/portfolio/orders` to return local orders, add `POST /api/portfolio/orders/{id}/fill` for manual fills, add `POST /api/portfolio/orders/{id}/fill-from-degiro` that fetches DeGiro order history and creates the position. The frontend adds an Orders tab in the Book page, a `FillViaDegiroModal`, and a pending badge on the Today page.

**Tech Stack:** Python/FastAPI, Pydantic, pytest · React 18, TypeScript, React Query, MSW, Vitest

---

## File Map

**Backend — modify:**
- `api/models/portfolio.py` — add `FillOrderRequest`, `FillFromDegiroRequest`, `FillFromDegiroResponse`, broker fields to stored order dicts
- `api/repositories/orders_repo.py` — add `update_order()` method
- `api/services/portfolio_service.py` — add `list_local_orders()`, `fill_order()`, `list_degiro_order_history()`, `fill_order_from_degiro()`
- `api/routers/portfolio.py` — change `GET /orders` to return local orders; add `POST /orders/{id}/fill`; add `GET /degiro/order-history`; add `POST /orders/{id}/fill-from-degiro`
- `src/swing_screener/integrations/degiro/client.py` — add `get_order_history(from_date, to_date)`

**Backend — create:**
- `tests/api/test_order_fill.py`

**Frontend — modify:**
- `web-ui/src/lib/api.ts` — add `degiroOrderHistory`, `orderFillFromDegiro` endpoints
- `web-ui/src/types/order.ts` — add `brokerOrderId`, `broker`, `brokerSyncedAt` to `Order`; add `FillFromDegiroRequest`
- `web-ui/src/features/portfolio/api.ts` — fix `fetchOrders()` to call backend; add `fetchDegiroOrderHistory()`, `fillOrderFromDegiro()`
- `web-ui/src/features/portfolio/hooks.ts` — add `useDegiroOrderHistory()`, `useFillFromDegiroMutation()`
- `web-ui/src/i18n/messages.en.ts` — add `pendingOrdersTab.*`, `fillViaDegiroModal.*`, `todayPage.pendingBadge.*`
- `web-ui/src/pages/Book.tsx` — add Orders tab
- `web-ui/src/pages/Today.tsx` — add pending orders badge

**Frontend — create:**
- `web-ui/src/components/domain/orders/PendingOrdersTab.tsx`
- `web-ui/src/components/domain/orders/PendingOrdersTab.test.tsx`
- `web-ui/src/components/domain/orders/FillViaDegiroModal.tsx`
- `web-ui/src/components/domain/orders/FillViaDegiroModal.test.tsx`
- `web-ui/src/test/mocks/degiroOrderHistory.ts` — shared MSW fixture

---

## Task 1: Backend — Order repo update + service fill_order

**Files:**
- Modify: `api/repositories/orders_repo.py`
- Modify: `api/services/portfolio_service.py`
- Modify: `api/models/portfolio.py`
- Create: `tests/api/test_order_fill.py`

- [ ] **Step 1: Write failing test for fill_order**

```python
# tests/api/test_order_fill.py
from __future__ import annotations
import json
import pytest
from fastapi.testclient import TestClient
from api.main import app

@pytest.fixture()
def client_with_pending_order(tmp_path, monkeypatch):
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"
    orders_path.write_text(json.dumps({
        "orders": [{
            "order_id": "ORD-SBMO-001",
            "ticker": "SBMO",
            "status": "pending",
            "order_kind": "entry",
            "order_type": "LIMIT",
            "quantity": 200,
            "limit_price": 12.50,
            "stop_price": 11.20,
            "order_date": "2026-04-25",
            "filled_date": None,
            "entry_price": None,
            "notes": "",
            "parent_order_id": None,
            "position_id": None,
            "tif": "GTC",
            "fee_eur": None,
            "fill_fx_rate": None,
            "isin": "NL0010273215",
            "thesis": None,
        }],
        "asof": "2026-04-25",
    }))
    positions_path.write_text(json.dumps({"positions": [], "asof": "2026-04-25"}))
    import api.dependencies as deps
    from api.repositories.orders_repo import OrdersRepository
    from api.repositories.positions_repo import PositionsRepository
    monkeypatch.setattr(deps, "_orders_path", orders_path)
    monkeypatch.setattr(deps, "_positions_path", positions_path)
    return TestClient(app)


def test_fill_order_creates_position(client_with_pending_order):
    resp = client_with_pending_order.post(
        "/api/portfolio/orders/ORD-SBMO-001/fill",
        json={"filled_price": 12.34, "filled_date": "2026-04-26", "fee_eur": 2.10},
    )
    assert resp.status_code == 201
    pos = resp.json()["position"]
    assert pos["ticker"] == "SBMO"
    assert pos["entry_price"] == 12.34
    assert pos["entry_date"] == "2026-04-26"
    assert pos["stop_price"] == 11.20
    assert pos["status"] == "open"


def test_fill_order_already_filled_returns_409(client_with_pending_order):
    client_with_pending_order.post(
        "/api/portfolio/orders/ORD-SBMO-001/fill",
        json={"filled_price": 12.34, "filled_date": "2026-04-26"},
    )
    resp = client_with_pending_order.post(
        "/api/portfolio/orders/ORD-SBMO-001/fill",
        json={"filled_price": 12.34, "filled_date": "2026-04-26"},
    )
    assert resp.status_code == 409


def test_fill_order_not_found_returns_404(client_with_pending_order):
    resp = client_with_pending_order.post(
        "/api/portfolio/orders/ORD-MISSING-001/fill",
        json={"filled_price": 12.34, "filled_date": "2026-04-26"},
    )
    assert resp.status_code == 404


def test_list_local_orders_returns_pending(client_with_pending_order):
    resp = client_with_pending_order.get("/api/portfolio/orders/local")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["orders"]) == 1
    assert data["orders"][0]["order_id"] == "ORD-SBMO-001"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /path/to/repo && pytest tests/api/test_order_fill.py -v
```
Expected: FAIL (endpoints don't exist yet)

- [ ] **Step 3: Add `FillOrderRequest` and `FillOrderResponse` models to `api/models/portfolio.py`**

Add after the `CreateOrderRequest` class (after line 181):

```python
class FillOrderRequest(BaseModel):
    """Request to manually mark a pending order as filled."""
    filled_price: float = Field(gt=0, description="Actual fill price")
    filled_date: str = Field(description="Fill date (YYYY-MM-DD)")
    stop_price: Optional[float] = Field(default=None, gt=0, description="Override stop price from order")
    fee_eur: Optional[float] = Field(default=None, ge=0, description="Execution fee in EUR")
    fill_fx_rate: Optional[float] = Field(default=None, gt=0, description="FX rate at fill (e.g. EUR/USD)")

    @field_validator("filled_price")
    @classmethod
    def validate_filled_price(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("Filled price must be finite")
        return v


class FillOrderResponse(BaseModel):
    order_id: str
    position: Position
```

- [ ] **Step 4: Add `update_order()` to `api/repositories/orders_repo.py`**

Add after the `append_order` method (after line 42):

```python
def update_order(self, order_id: str, updates: dict) -> dict | None:
    """Update fields on an existing order. Returns updated order or None if not found."""
    data = self.read()
    orders = data.get("orders", [])
    for order in orders:
        if order.get("order_id") == order_id:
            order.update(updates)
            data["orders"] = orders
            data["asof"] = get_today_str()
            self.write(data)
            return order
    return None
```

- [ ] **Step 5: Add `list_local_orders()` and `fill_order()` to `api/services/portfolio_service.py`**

Add after the `create_order` method (after line 513). Add this import at the top of the file if not present: `from datetime import datetime` and check `from api.utils.files import get_today_str` exists.

```python
def list_local_orders(self, status: Optional[str] = None) -> dict:
    """List locally stored orders from orders.json."""
    if self._orders_repo is None:
        raise HTTPException(status_code=503, detail="Orders repository not configured")
    orders, asof = self._orders_repo.list_orders(status=status)
    return {"orders": orders, "asof": asof}

def fill_order(self, order_id: str, request: "FillOrderRequest") -> "FillOrderResponse":
    """Mark a pending order as filled and create the open position."""
    from api.models.portfolio import FillOrderRequest, FillOrderResponse
    if self._orders_repo is None:
        raise HTTPException(status_code=503, detail="Orders repository not configured")

    order = self._orders_repo.get_order(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    if order.get("status") != "pending":
        raise HTTPException(status_code=409, detail=f"Order {order_id} is already {order.get('status')}")

    ticker = order["ticker"]
    stop_price = request.stop_price or order.get("stop_price")
    if not stop_price:
        raise HTTPException(status_code=422, detail=f"No stop price available for order {order_id}")
    if stop_price >= request.filled_price:
        raise HTTPException(status_code=422, detail="stop_price must be below filled_price")

    # Update the order record
    updates = {
        "status": "filled",
        "entry_price": request.filled_price,
        "filled_date": request.filled_date,
        "fee_eur": request.fee_eur,
        "fill_fx_rate": request.fill_fx_rate,
        "stop_price": stop_price,
    }
    self._orders_repo.update_order(order_id, updates)

    # Create the open position
    import uuid
    isin = order.get("isin") or _resolve_isin(ticker)
    position_id = f"POS-{uuid.uuid4().hex[:8].upper()}"
    initial_risk = (request.filled_price - stop_price) * order["quantity"]

    new_position: dict = {
        "position_id": position_id,
        "ticker": ticker,
        "status": "open",
        "entry_date": request.filled_date,
        "entry_price": request.filled_price,
        "stop_price": stop_price,
        "shares": order["quantity"],
        "initial_risk": initial_risk,
        "source_order_id": order_id,
        "isin": isin,
        "thesis": order.get("thesis"),
        "notes": order.get("notes", ""),
        "entry_fee_eur": request.fee_eur,
    }

    data = self._positions_repo.read()
    positions = data.get("positions", [])
    positions.append(new_position)
    data["positions"] = positions
    data["asof"] = get_today_str()
    self._positions_repo.write(data)

    from api.models.portfolio import FillOrderResponse, Position
    return FillOrderResponse(order_id=order_id, position=Position(**new_position))
```

- [ ] **Step 6: Add `GET /api/portfolio/orders/local` and `POST /api/portfolio/orders/{order_id}/fill` to `api/routers/portfolio.py`**

Add after the existing `POST /orders` handler (after line 145):

```python
@router.get("/orders/local")
async def list_local_orders(
    status: Optional[str] = None,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """List locally stored pending/filled orders from orders.json."""
    return service.list_local_orders(status=status)


@router.post("/orders/{order_id}/fill", status_code=201, response_model=FillOrderResponse)
async def fill_order(
    order_id: str,
    request: FillOrderRequest,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Mark a pending order as filled and create an open position."""
    return service.fill_order(order_id, request)
```

Add `FillOrderRequest, FillOrderResponse` to the import from `api.models.portfolio` at the top of `portfolio.py`.

Also add `Optional` to the imports at the top of the router file if not already present:
```python
from typing import Optional
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
pytest tests/api/test_order_fill.py -v
```
Expected: 4 tests PASS

- [ ] **Step 8: Run full backend suite to check nothing regressed**

```bash
pytest -q -m "not integration"
```
Expected: all pass (3 skipped integration)

- [ ] **Step 9: Commit**

```bash
git add api/models/portfolio.py api/repositories/orders_repo.py api/services/portfolio_service.py api/routers/portfolio.py tests/api/test_order_fill.py
git commit -m "feat: add fill_order endpoint and list_local_orders"
```

---

## Task 2: Backend — DeGiro order history endpoint

**Files:**
- Modify: `src/swing_screener/integrations/degiro/client.py`
- Modify: `api/services/portfolio_service.py`
- Modify: `api/routers/portfolio.py`
- Modify: `tests/api/test_order_fill.py`

- [ ] **Step 1: Write failing test for order history endpoint**

Add to `tests/api/test_order_fill.py`:

```python
def test_get_degiro_order_history(monkeypatch):
    """GET /api/portfolio/degiro/order-history returns normalized orders."""
    import api.routers.portfolio as portfolio_router

    class _FakeAPI:
        def get_orders_history(self, history_request, raw=True):
            return {
                "data": [{
                    "orderId": "DG-BUY-1",
                    "productId": "12345",
                    "isin": "NL0010273215",
                    "product": "SBMO Offshore",
                    "buysell": "B",
                    "size": 200,
                    "price": 12.34,
                    "date": "2026-04-26T09:14:00",
                    "status": "confirmed",
                }]
            }

    class _FakeCreds:
        pass

    class _FakeClient:
        def __init__(self, creds): pass
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def get_order_history(self, from_date, to_date):
            api = _FakeAPI()
            from datetime import date
            from degiro_connector.trading.models.order import HistoryRequest
            return api.get_orders_history(
                HistoryRequest(from_date=date.fromisoformat(from_date), to_date=date.fromisoformat(to_date)),
                raw=True,
            ).get("data", [])

    monkeypatch.setattr(portfolio_router, "_check_degiro_available", lambda: None)
    import api.services.portfolio_service as svc_module
    monkeypatch.setattr(svc_module, "DegiroClient", _FakeClient)
    monkeypatch.setattr(svc_module, "load_credentials", lambda: _FakeCreds())

    client = TestClient(app)
    resp = client.get("/api/portfolio/degiro/order-history")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["orders"]) == 1
    assert data["orders"][0]["order_id"] == "DG-BUY-1"
    assert data["orders"][0]["side"] == "buy"
    assert data["orders"][0]["price"] == 12.34
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/api/test_order_fill.py::test_get_degiro_order_history -v
```
Expected: FAIL (endpoint doesn't exist)

- [ ] **Step 3: Add `get_order_history()` to `src/swing_screener/integrations/degiro/client.py`**

Add after `get_orders()` (after line 104):

```python
def get_order_history(self, from_date: str, to_date: str) -> list[dict]:
    """Fetch order history (filled/cancelled) from DeGiro for the given date range.

    Args:
        from_date: Start date as ISO string (YYYY-MM-DD).
        to_date: End date as ISO string (YYYY-MM-DD).

    Returns:
        List of raw order dicts from the DeGiro API.
    """
    try:
        from datetime import date
        from degiro_connector.trading.models.order import HistoryRequest
    except ImportError as exc:
        raise ImportError(
            "degiro-connector is not installed. "
            "Install it with: pip install -e '.[degiro]'"
        ) from exc

    from_dt = date.fromisoformat(from_date)
    to_dt = date.fromisoformat(to_date)
    result = self.api.get_orders_history(
        history_request=HistoryRequest(from_date=from_dt, to_date=to_dt),
        raw=True,
    ) or {}
    return result.get("data", [])
```

- [ ] **Step 4: Add `list_degiro_order_history()` to `api/services/portfolio_service.py`**

Add after `list_degiro_orders()` (after line 732):

```python
def list_degiro_order_history(self, from_date: str, to_date: str) -> DegiroOrdersResponse:
    """Fetch recent filled/cancelled orders from DeGiro order history."""
    from swing_screener.integrations.degiro.credentials import load_credentials
    from swing_screener.integrations.degiro.client import DegiroClient

    credentials = load_credentials()
    with DegiroClient(credentials) as client:
        raw_orders = client.get_order_history(from_date=from_date, to_date=to_date)

    orders = [_normalize_degiro_order(o) for o in raw_orders]
    return DegiroOrdersResponse(orders=orders, asof=get_today_str())
```

- [ ] **Step 5: Add `GET /api/portfolio/degiro/order-history` to `api/routers/portfolio.py`**

Add after the existing `GET /orders` handler:

```python
@router.get("/degiro/order-history", response_model=DegiroOrdersResponse)
async def get_degiro_order_history(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Fetch order history (filled/cancelled orders) from DeGiro.

    Defaults to the last 30 days if from_date/to_date are not provided.
    """
    _check_degiro_available()
    from api.utils.files import get_today_str
    from datetime import date, timedelta

    if to_date is None:
        to_date = get_today_str()
    if from_date is None:
        from_dt = date.fromisoformat(to_date) - timedelta(days=30)
        from_date = from_dt.isoformat()

    return service.list_degiro_order_history(from_date=from_date, to_date=to_date)
```

- [ ] **Step 6: Run tests**

```bash
pytest tests/api/test_order_fill.py -v
```
Expected: all 5 tests PASS

- [ ] **Step 7: Run full suite**

```bash
pytest -q -m "not integration"
```
Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add src/swing_screener/integrations/degiro/client.py api/services/portfolio_service.py api/routers/portfolio.py tests/api/test_order_fill.py
git commit -m "feat: add DeGiro order history endpoint"
```

---

## Task 3: Backend — fill-from-degiro endpoint

**Files:**
- Modify: `api/models/portfolio.py`
- Modify: `api/services/portfolio_service.py`
- Modify: `api/routers/portfolio.py`
- Modify: `tests/api/test_order_fill.py`

- [ ] **Step 1: Write failing tests**

Add to `tests/api/test_order_fill.py`:

```python
def test_fill_from_degiro_creates_position(client_with_pending_order, monkeypatch):
    import api.routers.portfolio as portfolio_router
    import api.services.portfolio_service as svc_module

    class _FakeClient:
        def __init__(self, creds): pass
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def get_order_history(self, from_date, to_date):
            return [{
                "orderId": "DG-BUY-42",
                "productId": "9876",
                "isin": "NL0010273215",
                "product": "SBMO Offshore",
                "buysell": "B",
                "size": 200,
                "price": 12.34,
                "date": "2026-04-26",
                "status": "confirmed",
            }]

    monkeypatch.setattr(portfolio_router, "_check_degiro_available", lambda: None)
    monkeypatch.setattr(svc_module, "DegiroClient", _FakeClient)
    monkeypatch.setattr(svc_module, "load_credentials", lambda: object())

    resp = client_with_pending_order.post(
        "/api/portfolio/orders/ORD-SBMO-001/fill-from-degiro",
        json={"degiro_order_id": "DG-BUY-42"},
    )
    assert resp.status_code == 201
    body = resp.json()
    pos = body["position"]
    assert pos["ticker"] == "SBMO"
    assert pos["entry_price"] == 12.34
    assert pos["entry_date"] == "2026-04-26"
    assert body["broker_order_id"] == "DG-BUY-42"
    assert body["quantity_mismatch"] is False


def test_fill_from_degiro_quantity_mismatch_warns(client_with_pending_order, monkeypatch):
    import api.routers.portfolio as portfolio_router
    import api.services.portfolio_service as svc_module

    class _FakeClient:
        def __init__(self, creds): pass
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def get_order_history(self, from_date, to_date):
            return [{
                "orderId": "DG-BUY-99",
                "productId": "9876",
                "buysell": "B",
                "size": 150,  # mismatch: local order has 200
                "price": 12.34,
                "date": "2026-04-26",
                "status": "confirmed",
            }]

    monkeypatch.setattr(portfolio_router, "_check_degiro_available", lambda: None)
    monkeypatch.setattr(svc_module, "DegiroClient", _FakeClient)
    monkeypatch.setattr(svc_module, "load_credentials", lambda: object())

    resp = client_with_pending_order.post(
        "/api/portfolio/orders/ORD-SBMO-001/fill-from-degiro",
        json={"degiro_order_id": "DG-BUY-99"},
    )
    assert resp.status_code == 201
    assert resp.json()["quantity_mismatch"] is True


def test_fill_from_degiro_not_found_returns_422(client_with_pending_order, monkeypatch):
    import api.routers.portfolio as portfolio_router
    import api.services.portfolio_service as svc_module

    class _FakeClient:
        def __init__(self, creds): pass
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def get_order_history(self, from_date, to_date):
            return []

    monkeypatch.setattr(portfolio_router, "_check_degiro_available", lambda: None)
    monkeypatch.setattr(svc_module, "DegiroClient", _FakeClient)
    monkeypatch.setattr(svc_module, "load_credentials", lambda: object())

    resp = client_with_pending_order.post(
        "/api/portfolio/orders/ORD-SBMO-001/fill-from-degiro",
        json={"degiro_order_id": "DG-NOTFOUND"},
    )
    assert resp.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/api/test_order_fill.py -k "fill_from_degiro" -v
```
Expected: FAIL

- [ ] **Step 3: Add models to `api/models/portfolio.py`**

Add after `FillOrderResponse`:

```python
class FillFromDegiroRequest(BaseModel):
    """Request to fill a local order using a specific DeGiro order ID."""
    degiro_order_id: str


class FillFromDegiroResponse(BaseModel):
    order_id: str
    broker_order_id: str
    quantity_mismatch: bool
    position: Position
```

- [ ] **Step 4: Add `fill_order_from_degiro()` to `api/services/portfolio_service.py`**

Add after `fill_order()`:

```python
def fill_order_from_degiro(self, order_id: str, degiro_order_id: str) -> "FillFromDegiroResponse":
    """Fill a local pending order using data from a specific DeGiro order."""
    from api.models.portfolio import FillOrderRequest, FillFromDegiroResponse
    from swing_screener.integrations.degiro.credentials import load_credentials
    from swing_screener.integrations.degiro.client import DegiroClient
    from datetime import date, timedelta

    if self._orders_repo is None:
        raise HTTPException(status_code=503, detail="Orders repository not configured")

    order = self._orders_repo.get_order(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    if order.get("status") != "pending":
        raise HTTPException(status_code=409, detail=f"Order {order_id} is already {order.get('status')}")

    # Fetch recent order history from DeGiro (last 90 days to cover older fills)
    to_date = get_today_str()
    from_date = (date.fromisoformat(to_date) - timedelta(days=90)).isoformat()

    credentials = load_credentials()
    with DegiroClient(credentials) as client:
        raw_orders = client.get_order_history(from_date=from_date, to_date=to_date)

    # Find the matching DeGiro order
    degiro_order = next(
        (o for o in raw_orders if str(o.get("orderId", "")) == degiro_order_id),
        None,
    )
    if degiro_order is None:
        raise HTTPException(
            status_code=422,
            detail=f"DeGiro order {degiro_order_id} not found in order history (last 90 days)",
        )

    # Normalize fields
    vals = degiro_order
    fill_price = float(vals.get("price", 0))
    fill_qty = int(float(vals.get("size", 0) or vals.get("quantity", 0) or 0))
    fill_date_raw = str(vals.get("date", "") or get_today_str())
    fill_date = fill_date_raw[:10]  # take YYYY-MM-DD part only
    isin_from_degiro = str(vals.get("isin", "") or "") or None
    product_id = str(vals.get("productId", "") or "") or None

    quantity_mismatch = fill_qty != order.get("quantity", 0)

    # Write broker fields to order before fill
    broker_updates = {
        "broker_order_id": degiro_order_id,
        "broker": "degiro",
        "broker_synced_at": get_today_str(),
    }
    if isin_from_degiro and not order.get("isin"):
        broker_updates["isin"] = isin_from_degiro

    self._orders_repo.update_order(order_id, broker_updates)

    # Re-read order with broker fields applied
    order = self._orders_repo.get_order(order_id)

    fill_request = FillOrderRequest(
        filled_price=fill_price,
        filled_date=fill_date,
        fee_eur=None,
    )
    fill_response = self.fill_order(order_id, fill_request)

    # Also write broker_product_id to the created position
    if product_id:
        data = self._positions_repo.read()
        for pos in data.get("positions", []):
            if pos.get("source_order_id") == order_id:
                pos["broker_product_id"] = product_id
                pos["broker"] = "degiro"
                pos["broker_synced_at"] = get_today_str()
        self._positions_repo.write(data)

    return FillFromDegiroResponse(
        order_id=order_id,
        broker_order_id=degiro_order_id,
        quantity_mismatch=quantity_mismatch,
        position=fill_response.position,
    )
```

- [ ] **Step 5: Add `POST /orders/{order_id}/fill-from-degiro` to `api/routers/portfolio.py`**

Add after the `fill_order` route:

```python
@router.post("/orders/{order_id}/fill-from-degiro", status_code=201, response_model=FillFromDegiroResponse)
async def fill_order_from_degiro(
    order_id: str,
    request: FillFromDegiroRequest,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Fill a local pending order by linking it to a specific DeGiro order ID."""
    _check_degiro_available()
    return service.fill_order_from_degiro(order_id, request.degiro_order_id)
```

Add `FillFromDegiroRequest, FillFromDegiroResponse` to the import from `api.models.portfolio`.

- [ ] **Step 6: Run all fill tests**

```bash
pytest tests/api/test_order_fill.py -v
```
Expected: all 8 tests PASS

- [ ] **Step 7: Run full suite**

```bash
pytest -q -m "not integration"
```
Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add api/models/portfolio.py api/services/portfolio_service.py api/routers/portfolio.py tests/api/test_order_fill.py
git commit -m "feat: add fill-from-degiro endpoint"
```

---

## Task 4: Frontend — types, API functions, i18n keys

**Files:**
- Modify: `web-ui/src/lib/api.ts`
- Modify: `web-ui/src/types/order.ts`
- Modify: `web-ui/src/features/portfolio/api.ts`
- Modify: `web-ui/src/features/portfolio/hooks.ts`
- Modify: `web-ui/src/i18n/messages.en.ts`

- [ ] **Step 1: Add new endpoints to `web-ui/src/lib/api.ts`**

After `orderFill: (id: string) => ...` (line 41), add:

```typescript
degiroOrderHistory: '/api/portfolio/degiro/order-history',
orderFillFromDegiro: (id: string) => `/api/portfolio/orders/${id}/fill-from-degiro`,
localOrders: '/api/portfolio/orders/local',
```

- [ ] **Step 2: Add broker fields to `Order` in `web-ui/src/types/order.ts`**

In the `Order` interface, add after `fillFxRate`:
```typescript
brokerOrderId?: string | null;
broker?: string | null;
brokerSyncedAt?: string | null;
```

In `OrderApiResponse`, add after `fill_fx_rate`:
```typescript
broker_order_id?: string | null;
broker?: string | null;
broker_synced_at?: string | null;
```

In `transformOrder`, add after `fillFxRate: apiOrder.fill_fx_rate ?? null,`:
```typescript
brokerOrderId: apiOrder.broker_order_id ?? null,
broker: apiOrder.broker ?? null,
brokerSyncedAt: apiOrder.broker_synced_at ?? null,
```

Add new interfaces after `FillOrderRequest`:
```typescript
export interface FillFromDegiroRequest {
  degiroOrderId: string;
}

export interface FillFromDegiroResponse {
  orderId: string;
  brokerOrderId: string;
  quantityMismatch: boolean;
  position: import('./position').Position;
}

export interface DegiroOrderHistoryResponse {
  orders: import('./degiroOrder').DegiroOrder[];
  asof: string;
}
```

**Note:** `DegiroOrder` already exists as a frontend type. Check `web-ui/src/types/` for its location.

- [ ] **Step 3: Check DegiroOrder type location**

```bash
grep -rn "DegiroOrder" web-ui/src/types/ web-ui/src/features/
```

If `DegiroOrder` doesn't exist as a frontend type, add this to `web-ui/src/types/order.ts`:
```typescript
export interface DegiroOrder {
  orderId: string;
  productId?: string | null;
  isin?: string | null;
  productName?: string | null;
  status: string;
  price?: number | null;
  quantity: number;
  orderType?: string | null;
  side?: string | null;
  createdAt?: string | null;
}
```

Update `DegiroOrderHistoryResponse` to use the correct import path.

- [ ] **Step 4: Fix `fetchOrders` and add new API functions in `web-ui/src/features/portfolio/api.ts`**

Replace the `fetchOrders` function (lines 157-164) with:
```typescript
export async function fetchOrders(status: OrderFilterStatus): Promise<Order[]> {
  if (isLocalPersistenceMode()) {
    return listOrdersLocal(status);
  }
  const params = status ? `?status=${status}` : '';
  const response = await fetch(apiUrl(`${API_ENDPOINTS.localOrders}${params}`));
  if (!response.ok) {
    throw await buildApiError(response, 'Failed to fetch orders');
  }
  const data = await response.json();
  return (data.orders ?? []).map(transformOrder);
}
```

Add after `cancelOrder`:
```typescript
export async function fetchDegiroOrderHistory(): Promise<DegiroOrder[]> {
  if (isLocalPersistenceMode()) {
    return [];
  }
  const response = await fetch(apiUrl(API_ENDPOINTS.degiroOrderHistory));
  if (!response.ok) {
    throw await buildApiError(response, 'Failed to fetch DeGiro order history');
  }
  const data = await response.json();
  return (data.orders ?? []).map((o: any): DegiroOrder => ({
    orderId: o.order_id,
    productId: o.product_id ?? null,
    isin: o.isin ?? null,
    productName: o.product_name ?? null,
    status: o.status,
    price: o.price ?? null,
    quantity: o.quantity,
    orderType: o.order_type ?? null,
    side: o.side ?? null,
    createdAt: o.created_at ?? null,
  }));
}

export async function fillOrderFromDegiro(
  orderId: string,
  request: FillFromDegiroRequest,
): Promise<FillFromDegiroResponse> {
  if (isLocalPersistenceMode()) {
    throw new Error('fill-from-degiro not supported in local mode');
  }
  const response = await fetch(apiUrl(API_ENDPOINTS.orderFillFromDegiro(orderId)), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ degiro_order_id: request.degiroOrderId }),
  });
  if (!response.ok) {
    throw await buildApiError(response, 'Failed to fill order from DeGiro');
  }
  const data = await response.json();
  return {
    orderId: data.order_id,
    brokerOrderId: data.broker_order_id,
    quantityMismatch: data.quantity_mismatch,
    position: data.position,
  };
}
```

Add missing imports at the top of `api.ts`:
```typescript
import type { DegiroOrder, FillFromDegiroRequest, FillFromDegiroResponse } from '@/types/order';
```

- [ ] **Step 5: Add hooks to `web-ui/src/features/portfolio/hooks.ts`**

Add after `useFillOrderMutation`:
```typescript
export function useDegiroOrderHistory() {
  return useQuery({
    queryKey: ['degiro-order-history'] as const,
    queryFn: () => fetchDegiroOrderHistory(),
    staleTime: 2 * 60 * 1000, // 2 minutes — order history doesn't change often
  });
}

export function useFillFromDegiroMutation(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, degiroOrderId }: { orderId: string; degiroOrderId: string }) =>
      fillOrderFromDegiro(orderId, { degiroOrderId }),
    onSuccess: async () => {
      await invalidateOrderQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: queryKeys.positions('open') });
      onSuccess?.();
    },
  });
}
```

Add `fetchDegiroOrderHistory, fillOrderFromDegiro` to the import from `./api` at the top of `hooks.ts`.

- [ ] **Step 6: Add i18n keys to `web-ui/src/i18n/messages.en.ts`**

Add `orders` to `bookPage.tabs` and add new top-level sections. Find `bookPage` (around line 1969) and update:

```typescript
bookPage: {
  title: 'Trading Book',
  subtitle: 'Positions, trade history and performance.',
  tabs: {
    positions: 'Positions',
    orders: 'Orders',          // ← ADD
    journal: 'Journal',
    performance: 'Performance',
    review: 'Weekly Review',
  },
},
```

After `bookPage`, add:

```typescript
pendingOrdersTab: {
  title: 'Pending Orders',
  empty: 'No pending orders. Create one from the Today page when a candidate is ready.',
  columnTicker: 'Ticker',
  columnShares: 'Shares',
  columnLimit: 'Limit',
  columnStop: 'Stop',
  columnDate: 'Created',
  fillViaDegiro: 'Fill via DeGiro',
  fillManually: 'Fill manually',
  degiroNotConnected: 'DeGiro not connected',
},
fillViaDegiroModal: {
  title: 'Link fill for {{ticker}}',
  loading: 'Fetching recent DeGiro orders…',
  noOrders: 'No recent DeGiro orders found. Try filling manually.',
  matchedSection: 'Matching orders',
  otherSection: 'Other recent orders',
  columnProduct: 'Product',
  columnPrice: 'Fill price',
  columnQty: 'Qty',
  columnDate: 'Date',
  quantityMismatch: 'Quantity mismatch: DeGiro filled {{degiroQty}} shares, local order is {{localQty}}.',
  confirmButton: 'Confirm fill',
  cancelButton: 'Cancel',
  successToast: 'Position created for {{ticker}}',
  errorFetch: 'Failed to load DeGiro orders.',
},
todayPage: {
  // ... existing keys ...
  pendingBadge: {
    singular: '{{count}} pending order',
    plural: '{{count}} pending orders',
    goToOrders: 'Go to Orders',
  },
},
```

**Important:** The `todayPage` key already exists. Find it and add `pendingBadge` inside the existing object rather than creating a duplicate.

- [ ] **Step 7: Run frontend checks**

```bash
cd web-ui && npm run typecheck && npm run lint
```
Expected: zero errors, zero warnings

- [ ] **Step 8: Commit**

```bash
git add web-ui/src/lib/api.ts web-ui/src/types/order.ts web-ui/src/features/portfolio/api.ts web-ui/src/features/portfolio/hooks.ts web-ui/src/i18n/messages.en.ts
git commit -m "feat: frontend types, API functions, and i18n for pending orders + degiro fill"
```

---

## Task 5: Frontend — PendingOrdersTab + Book page Orders tab

**Files:**
- Create: `web-ui/src/components/domain/orders/PendingOrdersTab.tsx`
- Create: `web-ui/src/components/domain/orders/PendingOrdersTab.test.tsx`
- Modify: `web-ui/src/pages/Book.tsx`

- [ ] **Step 1: Write failing tests**

Create `web-ui/src/components/domain/orders/PendingOrdersTab.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import PendingOrdersTab from './PendingOrdersTab';
import { t } from '@/i18n/t';

const pendingOrder = {
  order_id: 'ORD-SBMO-001',
  ticker: 'SBMO',
  status: 'pending',
  order_type: 'LIMIT',
  order_kind: 'entry',
  quantity: 200,
  limit_price: 12.50,
  stop_price: 11.20,
  order_date: '2026-04-25',
  filled_date: null,
  entry_price: null,
  notes: '',
  parent_order_id: null,
  position_id: null,
  tif: 'GTC',
  fee_eur: null,
  fill_fx_rate: null,
  isin: 'NL0010273215',
  thesis: null,
};

describe('PendingOrdersTab', () => {
  it('renders pending orders', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [pendingOrder], asof: '2026-04-27' })
      )
    );
    renderWithProviders(<PendingOrdersTab />);
    expect(await screen.findByText('SBMO')).toBeInTheDocument();
    expect(await screen.findByText('200')).toBeInTheDocument();
  });

  it('renders empty state when no pending orders', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [], asof: '2026-04-27' })
      )
    );
    renderWithProviders(<PendingOrdersTab />);
    expect(await screen.findByText(t('pendingOrdersTab.empty'))).toBeInTheDocument();
  });

  it('shows fill-via-degiro button for pending entry orders', async () => {
    server.use(
      http.get('*/api/portfolio/orders/local', () =>
        HttpResponse.json({ orders: [pendingOrder], asof: '2026-04-27' })
      ),
      http.get('*/api/portfolio/degiro/status', () =>
        HttpResponse.json({ available: true, installed: true, credentials_configured: true, mode: 'ready', detail: '' })
      )
    );
    renderWithProviders(<PendingOrdersTab />);
    expect(await screen.findByRole('button', { name: t('pendingOrdersTab.fillViaDegiro') })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web-ui && npx vitest run src/components/domain/orders/PendingOrdersTab.test.tsx
```
Expected: FAIL (component doesn't exist)

- [ ] **Step 3: Create `web-ui/src/components/domain/orders/PendingOrdersTab.tsx`**

```tsx
import { useState } from 'react';
import { useOrders } from '@/features/portfolio/hooks';
import { useDegiroStatus } from '@/features/portfolio/hooks';
import { t } from '@/i18n/t';
import type { Order } from '@/types/order';
import FillViaDegiroModal from './FillViaDegiroModal';
import { FillOrderModalForm } from './FillOrderModalForm';

export default function PendingOrdersTab() {
  const ordersQuery = useOrders('pending');
  const degiroStatusQuery = useDegiroStatus();
  const [fillDegiroOrder, setFillDegiroOrder] = useState<Order | null>(null);
  const [fillManualOrder, setFillManualOrder] = useState<Order | null>(null);

  const orders = ordersQuery.data ?? [];
  const degiroAvailable = degiroStatusQuery.data?.available ?? false;

  if (ordersQuery.isLoading) {
    return <p className="text-sm text-gray-500 py-4">{t('common.table.loading')}</p>;
  }

  if (orders.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">{t('pendingOrdersTab.empty')}</p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 pr-4 text-left font-medium">{t('pendingOrdersTab.columnTicker')}</th>
              <th className="py-2 pr-4 text-right font-medium">{t('pendingOrdersTab.columnShares')}</th>
              <th className="py-2 pr-4 text-right font-medium">{t('pendingOrdersTab.columnLimit')}</th>
              <th className="py-2 pr-4 text-right font-medium">{t('pendingOrdersTab.columnStop')}</th>
              <th className="py-2 pr-4 text-left font-medium">{t('pendingOrdersTab.columnDate')}</th>
              <th className="py-2 text-left font-medium" />
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.orderId}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <td className="py-2 pr-4 font-semibold text-gray-900 dark:text-gray-100">
                  {order.ticker}
                </td>
                <td className="py-2 pr-4 text-right text-gray-700 dark:text-gray-300">
                  {order.quantity}
                </td>
                <td className="py-2 pr-4 text-right text-gray-700 dark:text-gray-300">
                  {order.limitPrice != null ? order.limitPrice.toFixed(2) : t('common.placeholders.dash')}
                </td>
                <td className="py-2 pr-4 text-right text-gray-700 dark:text-gray-300">
                  {order.stopPrice != null ? order.stopPrice.toFixed(2) : t('common.placeholders.dash')}
                </td>
                <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{order.orderDate}</td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFillDegiroOrder(order)}
                      disabled={!degiroAvailable}
                      title={!degiroAvailable ? t('pendingOrdersTab.degiroNotConnected') : undefined}
                      className="px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t('pendingOrdersTab.fillViaDegiro')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFillManualOrder(order)}
                      className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                    >
                      {t('pendingOrdersTab.fillManually')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {fillDegiroOrder && (
        <FillViaDegiroModal
          order={fillDegiroOrder}
          onClose={() => setFillDegiroOrder(null)}
        />
      )}

      {fillManualOrder && (
        <FillOrderModalForm
          order={fillManualOrder}
          onClose={() => setFillManualOrder(null)}
        />
      )}
    </>
  );
}
```

**Note:** Check that `useDegiroStatus` hook exists in `web-ui/src/features/portfolio/hooks.ts`. If not, add it:
```typescript
export function useDegiroStatus() {
  return useQuery({
    queryKey: ['degiro-status'] as const,
    queryFn: async () => {
      const r = await fetch(apiUrl(API_ENDPOINTS.degiroStatus));
      if (!r.ok) return { available: false };
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

Also check `FillOrderModalForm` props — it may need `onClose` vs `onSuccess`. Look at `web-ui/src/components/domain/orders/FillOrderModalForm.tsx` and adjust the prop name if needed.

- [ ] **Step 4: Add Orders tab to `web-ui/src/pages/Book.tsx`**

Change `BookTab` type (line 15):
```typescript
type BookTab = 'positions' | 'orders' | 'journal' | 'performance' | 'review';
```

Add the import at the top:
```typescript
import PendingOrdersTab from '@/components/domain/orders/PendingOrdersTab';
```

Update `localStorage` guard (line 102):
```typescript
if (stored === 'positions' || stored === 'orders' || stored === 'journal' || stored === 'performance' || stored === 'review') {
  return stored;
}
```

Update tabs array (after line 113):
```typescript
const tabs: { key: BookTab; label: string }[] = [
  { key: 'positions', label: t('bookPage.tabs.positions') },
  { key: 'orders', label: t('bookPage.tabs.orders') },
  { key: 'journal', label: t('bookPage.tabs.journal') },
  { key: 'performance', label: t('bookPage.tabs.performance') },
  { key: 'review', label: t('bookPage.tabs.review') },
];
```

Add tab content after `{activeTab === 'positions' && <PositionsTab />}`:
```typescript
{activeTab === 'orders' && <PendingOrdersTab />}
```

- [ ] **Step 5: Run tests**

```bash
cd web-ui && npx vitest run src/components/domain/orders/PendingOrdersTab.test.tsx
```
Expected: 3 tests PASS

- [ ] **Step 6: Run full frontend suite**

```bash
cd web-ui && npm test
```
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add web-ui/src/components/domain/orders/PendingOrdersTab.tsx web-ui/src/components/domain/orders/PendingOrdersTab.test.tsx web-ui/src/pages/Book.tsx
git commit -m "feat: add Orders tab to Book page with pending orders list"
```

---

## Task 6: Frontend — FillViaDegiroModal

**Files:**
- Create: `web-ui/src/components/domain/orders/FillViaDegiroModal.tsx`
- Create: `web-ui/src/components/domain/orders/FillViaDegiroModal.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `web-ui/src/components/domain/orders/FillViaDegiroModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import FillViaDegiroModal from './FillViaDegiroModal';
import { t } from '@/i18n/t';
import type { Order } from '@/types/order';

const order: Order = {
  orderId: 'ORD-SBMO-001',
  ticker: 'SBMO',
  status: 'pending',
  orderType: 'LIMIT',
  orderKind: 'entry',
  quantity: 200,
  limitPrice: 12.50,
  stopPrice: 11.20,
  orderDate: '2026-04-25',
  filledDate: '',
  entryPrice: null,
  notes: '',
  parentOrderId: null,
  positionId: null,
  tif: 'GTC',
};

const degiroOrders = [
  {
    order_id: 'DG-BUY-1',
    product_id: '9876',
    isin: 'NL0010273215',
    product_name: 'SBMO Offshore',
    status: 'confirmed',
    price: 12.34,
    quantity: 200,
    side: 'buy',
    created_at: '2026-04-26',
  },
];

describe('FillViaDegiroModal', () => {
  it('shows loading state while fetching', () => {
    server.use(
      http.get('*/api/portfolio/degiro/order-history', async () => {
        await new Promise(() => {}); // never resolves
        return HttpResponse.json({ orders: [] });
      })
    );
    renderWithProviders(<FillViaDegiroModal order={order} onClose={vi.fn()} />);
    expect(screen.getByText(t('fillViaDegiroModal.loading'))).toBeInTheDocument();
  });

  it('renders DeGiro order list', async () => {
    server.use(
      http.get('*/api/portfolio/degiro/order-history', () =>
        HttpResponse.json({ orders: degiroOrders, asof: '2026-04-27' })
      )
    );
    renderWithProviders(<FillViaDegiroModal order={order} onClose={vi.fn()} />);
    expect(await screen.findByText('SBMO Offshore')).toBeInTheDocument();
    expect(await screen.findByText('12.34')).toBeInTheDocument();
  });

  it('shows confirm button disabled until a row is selected', async () => {
    server.use(
      http.get('*/api/portfolio/degiro/order-history', () =>
        HttpResponse.json({ orders: degiroOrders, asof: '2026-04-27' })
      )
    );
    renderWithProviders(<FillViaDegiroModal order={order} onClose={vi.fn()} />);
    const btn = await screen.findByRole('button', { name: t('fillViaDegiroModal.confirmButton') });
    expect(btn).toBeDisabled();
  });

  it('enables confirm button after selecting a row', async () => {
    server.use(
      http.get('*/api/portfolio/degiro/order-history', () =>
        HttpResponse.json({ orders: degiroOrders, asof: '2026-04-27' })
      )
    );
    renderWithProviders(<FillViaDegiroModal order={order} onClose={vi.fn()} />);
    const row = await screen.findByText('SBMO Offshore');
    fireEvent.click(row.closest('tr')!);
    const btn = screen.getByRole('button', { name: t('fillViaDegiroModal.confirmButton') });
    expect(btn).toBeEnabled();
  });

  it('shows empty state when no orders returned', async () => {
    server.use(
      http.get('*/api/portfolio/degiro/order-history', () =>
        HttpResponse.json({ orders: [], asof: '2026-04-27' })
      )
    );
    renderWithProviders(<FillViaDegiroModal order={order} onClose={vi.fn()} />);
    expect(await screen.findByText(t('fillViaDegiroModal.noOrders'))).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web-ui && npx vitest run src/components/domain/orders/FillViaDegiroModal.test.tsx
```
Expected: FAIL (component doesn't exist)

- [ ] **Step 3: Create `web-ui/src/components/domain/orders/FillViaDegiroModal.tsx`**

```tsx
import { useState } from 'react';
import ModalShell from '@/components/common/ModalShell';
import Button from '@/components/common/Button';
import { useDegiroOrderHistory, useFillFromDegiroMutation } from '@/features/portfolio/hooks';
import type { Order } from '@/types/order';
import type { DegiroOrder } from '@/types/order';
import { t } from '@/i18n/t';

interface FillViaDegiroModalProps {
  order: Order;
  onClose: () => void;
}

export default function FillViaDegiroModal({ order, onClose }: FillViaDegiroModalProps) {
  const [selectedDegiroOrderId, setSelectedDegiroOrderId] = useState<string | null>(null);
  const historyQuery = useDegiroOrderHistory();
  const fillMutation = useFillFromDegiroMutation(onClose);

  const allOrders = historyQuery.data ?? [];
  // Split: same ticker (by ISIN or ticker substring match) vs others
  const matchedOrders = allOrders.filter(
    (o) =>
      o.isin === order.limitPrice?.toString() ||
      (o.productName ?? '').toUpperCase().includes(order.ticker) ||
      o.side === 'buy'
  );
  // Show all buy orders sorted: ticker match first, then others
  const buyOrders = allOrders.filter((o) => o.side === 'buy');
  const tickerMatches = buyOrders.filter(
    (o) => (o.productName ?? '').toUpperCase().includes(order.ticker)
  );
  const otherBuys = buyOrders.filter(
    (o) => !(o.productName ?? '').toUpperCase().includes(order.ticker)
  );

  const selectedOrder = allOrders.find((o) => o.orderId === selectedDegiroOrderId) ?? null;
  const quantityMismatch =
    selectedOrder !== null && selectedOrder.quantity !== order.quantity;

  function handleConfirm() {
    if (!selectedDegiroOrderId) return;
    fillMutation.mutate({ orderId: order.orderId, degiroOrderId: selectedDegiroOrderId });
  }

  function renderRow(o: DegiroOrder) {
    const isSelected = o.orderId === selectedDegiroOrderId;
    return (
      <tr
        key={o.orderId}
        onClick={() => setSelectedDegiroOrderId(o.orderId)}
        className={`cursor-pointer border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-950 ${isSelected ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
      >
        <td className="py-2 pr-3 text-sm text-gray-900 dark:text-gray-100">
          {o.productName ?? o.orderId}
        </td>
        <td className="py-2 pr-3 text-sm text-right text-gray-700 dark:text-gray-300">
          {o.price != null ? o.price.toFixed(2) : t('common.placeholders.dash')}
        </td>
        <td className="py-2 pr-3 text-sm text-right text-gray-700 dark:text-gray-300">
          {o.quantity}
        </td>
        <td className="py-2 text-sm text-gray-500 dark:text-gray-400">
          {o.createdAt?.slice(0, 10) ?? t('common.placeholders.dash')}
        </td>
      </tr>
    );
  }

  return (
    <ModalShell
      title={t('fillViaDegiroModal.title', { ticker: order.ticker })}
      onClose={onClose}
      closeAriaLabel={t('modal.closeAria')}
      className="max-w-lg"
    >
      {historyQuery.isLoading && (
        <p className="text-sm text-gray-500 py-4">{t('fillViaDegiroModal.loading')}</p>
      )}

      {historyQuery.isError && (
        <p className="text-sm text-red-600 dark:text-red-400 py-2">{t('fillViaDegiroModal.errorFetch')}</p>
      )}

      {!historyQuery.isLoading && !historyQuery.isError && buyOrders.length === 0 && (
        <p className="text-sm text-gray-500 py-4">{t('fillViaDegiroModal.noOrders')}</p>
      )}

      {buyOrders.length > 0 && (
        <div className="mb-4 overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="py-1 pr-3 text-left font-medium">{t('fillViaDegiroModal.columnProduct')}</th>
                <th className="py-1 pr-3 text-right font-medium">{t('fillViaDegiroModal.columnPrice')}</th>
                <th className="py-1 pr-3 text-right font-medium">{t('fillViaDegiroModal.columnQty')}</th>
                <th className="py-1 text-left font-medium">{t('fillViaDegiroModal.columnDate')}</th>
              </tr>
            </thead>
            <tbody>
              {tickerMatches.length > 0 && tickerMatches.map(renderRow)}
              {otherBuys.length > 0 && tickerMatches.length > 0 && (
                <tr>
                  <td colSpan={4} className="py-1 text-xs text-gray-400 dark:text-gray-500 italic">
                    {t('fillViaDegiroModal.otherSection')}
                  </td>
                </tr>
              )}
              {otherBuys.map(renderRow)}
            </tbody>
          </table>
        </div>
      )}

      {quantityMismatch && selectedOrder && (
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200">
          {t('fillViaDegiroModal.quantityMismatch', {
            degiroQty: String(selectedOrder.quantity),
            localQty: String(order.quantity),
          })}
        </div>
      )}

      {fillMutation.isError && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">
          {(fillMutation.error as Error)?.message ?? t('common.errors.generic')}
        </p>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="primary"
          disabled={!selectedDegiroOrderId || fillMutation.isPending}
          onClick={handleConfirm}
          className="flex-1"
        >
          {t('fillViaDegiroModal.confirmButton')}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('fillViaDegiroModal.cancelButton')}
        </Button>
      </div>
    </ModalShell>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd web-ui && npx vitest run src/components/domain/orders/FillViaDegiroModal.test.tsx
```
Expected: 5 tests PASS

- [ ] **Step 5: Run full frontend suite**

```bash
cd web-ui && npm test
```
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add web-ui/src/components/domain/orders/FillViaDegiroModal.tsx web-ui/src/components/domain/orders/FillViaDegiroModal.test.tsx
git commit -m "feat: add FillViaDegiroModal component"
```

---

## Task 7: Frontend — Today page pending orders badge

**Files:**
- Modify: `web-ui/src/pages/Today.tsx`

- [ ] **Step 1: Write failing test**

Find the existing Today page test file `web-ui/src/pages/Today.test.tsx` (or create it if missing). Add:

```tsx
it('shows pending orders badge when pending orders exist', async () => {
  server.use(
    http.get('*/api/portfolio/orders/local', () =>
      HttpResponse.json({
        orders: [{
          order_id: 'ORD-SBMO-001',
          ticker: 'SBMO',
          status: 'pending',
          order_kind: 'entry',
          order_type: 'LIMIT',
          quantity: 200,
          limit_price: 12.50,
          stop_price: 11.20,
          order_date: '2026-04-25',
          filled_date: null,
          entry_price: null,
          notes: '',
          parent_order_id: null,
          position_id: null,
          tif: 'GTC',
          fee_eur: null,
          fill_fx_rate: null,
        }],
        asof: '2026-04-27',
      })
    )
  );
  renderWithProviders(<Today />);
  expect(
    await screen.findByText(t('todayPage.pendingBadge.singular', { count: '1' }))
  ).toBeInTheDocument();
});

it('hides pending orders badge when no pending orders', async () => {
  server.use(
    http.get('*/api/portfolio/orders/local', () =>
      HttpResponse.json({ orders: [], asof: '2026-04-27' })
    )
  );
  renderWithProviders(<Today />);
  // Wait for load to settle, then verify badge is absent
  await screen.findByRole('main').catch(() => null);
  expect(
    screen.queryByText(t('todayPage.pendingBadge.singular', { count: '1' }))
  ).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web-ui && npx vitest run src/pages/Today.test.tsx -t "pending orders badge"
```
Expected: FAIL

- [ ] **Step 3: Add pending badge to `web-ui/src/pages/Today.tsx`**

At the top of `Today.tsx`, add import:
```typescript
import { useOrders } from '@/features/portfolio/hooks';
import { useNavigate } from 'react-router-dom';
```

Inside the `Today` component (or the main content component), add the pending badge just above the daily review candidates section. Find the outermost container div of the page content and add before the first content section:

```tsx
function PendingOrdersBadge() {
  const ordersQuery = useOrders('pending');
  const navigate = useNavigate();
  const count = ordersQuery.data?.length ?? 0;
  if (count === 0) return null;

  const label = count === 1
    ? t('todayPage.pendingBadge.singular', { count: String(count) })
    : t('todayPage.pendingBadge.plural', { count: String(count) });

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-700 dark:bg-amber-950">
      <span className="text-sm text-amber-800 dark:text-amber-200">⏳ {label}</span>
      <button
        type="button"
        onClick={() => navigate('/book', { state: { tab: 'orders' } })}
        className="ml-auto text-xs font-medium text-amber-700 hover:underline dark:text-amber-300"
      >
        {t('todayPage.pendingBadge.goToOrders')}
      </button>
    </div>
  );
}
```

Then in the Today page JSX, add `<PendingOrdersBadge />` before the main daily-review content.

**Note:** `Today.tsx` is large. Read it first to find the right insertion point. The badge should appear inside the main content area, above the candidate lists.

- [ ] **Step 4: Run tests**

```bash
cd web-ui && npx vitest run src/pages/Today.test.tsx
```
Expected: all pass including new badge tests

- [ ] **Step 5: Run full suite and typecheck**

```bash
cd web-ui && npm test && npm run typecheck && npm run lint
```
Expected: all pass, zero warnings

- [ ] **Step 6: Run backend suite**

```bash
pytest -q -m "not integration"
```
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add web-ui/src/pages/Today.tsx
git commit -m "feat: add pending orders badge to Today page"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Orders tab in Book page — Task 5
- ✅ Fill via DeGiro modal — Task 6
- ✅ Fill manually fallback — Task 5 (FillOrderModalForm already exists)
- ✅ broker fields on Order — Task 4
- ✅ `POST /orders/{id}/fill-from-degiro` — Task 3
- ✅ `GET /api/portfolio/degiro/order-history` — Task 2
- ✅ Fix fetchOrders returning `[]` — Task 4
- ✅ Today page pending badge — Task 7
- ✅ DeGiro not connected disabled state — Task 5
- ✅ Quantity mismatch warning — Tasks 3 + 6
- ✅ 409 on already-filled — Tasks 1 + 3

**Type consistency check:**
- `FillOrderRequest` defined in Task 1, used in Task 3 service — ✅
- `FillFromDegiroResponse` defined in Task 3, used in router and frontend Task 4 — ✅
- `DegiroOrder` frontend type defined in Task 4, used in FillViaDegiroModal Task 6 — ✅
- `useFillFromDegiroMutation` defined in Task 4, called in FillViaDegiroModal Task 6 — ✅
- `useDegiroOrderHistory` defined in Task 4, called in FillViaDegiroModal Task 6 — ✅
- `localOrders` endpoint key defined in Task 4, used in `fetchOrders` Task 4 — ✅
