# Partial Exit Workflow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow traders to close part of a position (e.g., half at 1R) while the remainder continues running, recording each partial close as a distinct event and computing a blended R across all exits.

**Architecture:** `partial_closes` is stored as a list of event dicts on the position JSON (`{ date, shares_closed, price, r_at_close }`). A new `POST /positions/{id}/partial-close` endpoint reduces `shares` in-place and appends the event; `initial_risk` is preserved so per-share R continuity is maintained. `get_position_metrics` adds `partial_closes` and `blended_r` to `PositionMetrics`. The frontend adds a "Partial Close" button next to the existing "Close" button in `PortfolioTable`, which opens a new `PartialCloseModalForm` component. After a partial close the position row shows the remaining share count without page reload.

**Tech Stack:** Python/FastAPI, Pydantic v2, React 18/TypeScript, React Query v5, Zustand, Tailwind CSS

---

## File map

| File | Change |
|---|---|
| `api/models/portfolio.py` | Add `PartialCloseRequest`, `PartialCloseEvent`; extend `Position` with `partial_closes`; extend `PositionMetrics` with `partial_closes` + `blended_r` |
| `api/services/portfolio_service.py` | Add `partial_close_position()`; update `get_position_metrics()` to include `partial_closes` + `blended_r` |
| `api/routers/portfolio.py` | Add `POST /positions/{id}/partial-close` route |
| `tests/api/test_partial_close.py` | Backend unit tests: event stored, shares reduced, initial_risk preserved, blended_r computed |
| `web-ui/src/features/portfolio/types.ts` | Add `PartialCloseEvent`, `PartialCloseRequest`; extend `Position` and `PositionMetrics` client types |
| `web-ui/src/features/portfolio/api.ts` | Add `partialClosePosition()` fetch function |
| `web-ui/src/lib/api.ts` | Add `PARTIAL_CLOSE` endpoint path |
| `web-ui/src/features/portfolio/hooks.ts` | Add `usePartialClosePositionMutation()` |
| `web-ui/src/components/domain/positions/PartialCloseModalForm.tsx` | New modal: shares input (default 50%), live preview of locked profit + remaining risk |
| `web-ui/src/components/domain/positions/PartialCloseModalForm.test.tsx` | Frontend tests for the modal |
| `web-ui/src/components/domain/workspace/PortfolioTable.tsx` | Add "Partial Close" button + modal wiring |
| `web-ui/src/i18n/messages.en.ts` | Add `positions.partialCloseModal.*` keys |

---

## Task 1: Backend models — `PartialCloseRequest`, `PartialCloseEvent`, extend `Position` and `PositionMetrics`

**Files:**
- Modify: `api/models/portfolio.py`
- Test: `tests/api/test_partial_close.py`

- [ ] **Step 1: Write failing model tests**

Create `tests/api/test_partial_close.py`:

```python
from __future__ import annotations

import pytest
from api.models.portfolio import (
    PartialCloseRequest,
    PartialCloseEvent,
    Position,
    PositionMetrics,
)


def test_partial_close_request_valid():
    req = PartialCloseRequest(shares_closed=5, price=25.0)
    assert req.shares_closed == 5
    assert req.price == 25.0
    assert req.fee_eur is None


def test_partial_close_request_rejects_zero_shares():
    with pytest.raises(Exception):
        PartialCloseRequest(shares_closed=0, price=25.0)


def test_partial_close_request_rejects_negative_price():
    with pytest.raises(Exception):
        PartialCloseRequest(shares_closed=5, price=-1.0)


def test_partial_close_event_fields():
    evt = PartialCloseEvent(date="2026-05-08", shares_closed=5, price=25.0, r_at_close=1.5)
    assert evt.r_at_close == 1.5
    assert evt.shares_closed == 5


def test_position_has_partial_closes_field():
    pos = Position(
        ticker="AAPL",
        status="open",
        entry_date="2026-01-01",
        entry_price=20.0,
        stop_price=18.0,
        shares=10,
    )
    assert pos.partial_closes == []


def test_position_metrics_has_partial_closes_and_blended_r():
    metrics = PositionMetrics(
        ticker="AAPL",
        pnl=100.0,
        pnl_percent=5.0,
        r_now=1.5,
        entry_value=2000.0,
        current_value=2100.0,
        per_share_risk=2.0,
        total_risk=20.0,
        partial_closes=[],
        blended_r=None,
    )
    assert metrics.blended_r is None
    assert metrics.partial_closes == []
```

- [ ] **Step 2: Run to verify fail**

```bash
pytest tests/api/test_partial_close.py -v
```

Expected: FAIL — `PartialCloseRequest` not defined.

- [ ] **Step 3: Add models to `api/models/portfolio.py`**

After the existing `ClosePositionRequest` class (around line 70), add:

```python
class PartialCloseEvent(BaseModel):
    """A single partial-close event stored on the position."""
    date: str = Field(..., description="Date of partial close (YYYY-MM-DD)")
    shares_closed: int = Field(..., gt=0, description="Number of shares closed in this leg")
    price: float = Field(..., gt=0, description="Exit price for this leg")
    r_at_close: float = Field(..., description="R-multiple at the time of this partial close")
    fee_eur: Optional[float] = Field(default=None, ge=0, description="Fee for this leg in EUR")


class PartialCloseRequest(BaseModel):
    """Request to partially close an open position."""
    shares_closed: int = Field(..., gt=0, description="Number of shares to close")
    price: float = Field(..., gt=0, description="Exit price for this leg")
    fee_eur: Optional[float] = Field(default=None, ge=0, description="Fee in EUR (optional)")
```

Extend `Position` (around line 38, after `tags`):

```python
    partial_closes: list[PartialCloseEvent] = Field(
        default_factory=list,
        description="Ordered list of partial-close events",
    )
```

Extend `PositionMetrics` (around line 310, after `total_risk`):

```python
    partial_closes: list[PartialCloseEvent] = Field(
        default_factory=list,
        description="Partial-close events recorded on this position",
    )
    blended_r: Optional[float] = Field(
        default=None,
        description="Blended R across all partial closes (None when no partial closes exist)",
    )
```

Also add `PartialCloseEvent` and `PartialCloseRequest` to the imports at the top of any file that needs them.

- [ ] **Step 4: Run tests to verify pass**

```bash
pytest tests/api/test_partial_close.py -v
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add api/models/portfolio.py tests/api/test_partial_close.py
git commit -m "feat: add PartialCloseRequest, PartialCloseEvent models; extend Position and PositionMetrics"
```

---

## Task 2: Backend service — `partial_close_position()` and updated `get_position_metrics()`

**Files:**
- Modify: `api/services/portfolio_service.py`
- Test: `tests/api/test_partial_close.py` (extend)

**R calculation:**
- `per_share_risk = position["entry_price"] - position["stop_price"]`
- `r_at_close = (price - entry_price) / per_share_risk` (positive = profit)
- `blended_r = sum(evt.shares_closed * evt.r_at_close for evt in events) / sum(evt.shares_closed for evt in events)`

**partial_close_position logic:**
1. Load position, verify `status == "open"`
2. Verify `request.shares_closed < position["shares"]` (must leave at least 1 share)
3. Compute `r_at_close`
4. Append event to `position["partial_closes"]`
5. Reduce `position["shares"]` by `request.shares_closed`
6. Write back, return summary

- [ ] **Step 1: Write failing service tests**

Append to `tests/api/test_partial_close.py`:

```python
import json
import os
import pytest
from fastapi import HTTPException
from api.models.portfolio import PartialCloseRequest
from api.services.portfolio_service import PortfolioService
from api.repositories.positions_repo import PositionsRepository
from api.repositories.orders_repo import OrdersRepository


def _make_service(tmp_path, positions: list[dict]) -> PortfolioService:
    pos_file = tmp_path / "positions.json"
    pos_file.write_text(json.dumps({"positions": positions, "asof": "2026-01-01"}))
    ord_file = tmp_path / "orders.json"
    ord_file.write_text(json.dumps({"orders": [], "asof": "2026-01-01"}))
    import api.dependencies as deps
    deps._positions_path = str(pos_file)
    deps._orders_path = str(ord_file)
    from api.dependencies import get_portfolio_service
    svc = get_portfolio_service.__wrapped__() if hasattr(get_portfolio_service, '__wrapped__') else PortfolioService(
        positions_repo=PositionsRepository(str(pos_file)),
        orders_repo=OrdersRepository(str(ord_file)),
    )
    return svc


def _open_position(position_id: str = "POS-001") -> dict:
    return {
        "position_id": position_id,
        "ticker": "AAPL",
        "status": "open",
        "entry_date": "2026-01-01",
        "entry_price": 20.0,
        "stop_price": 18.0,
        "shares": 10,
        "initial_risk": 20.0,  # (20 - 18) * 10
        "partial_closes": [],
    }


def test_partial_close_reduces_shares(tmp_path, monkeypatch):
    svc = _make_service_simple(tmp_path)
    req = PartialCloseRequest(shares_closed=4, price=22.0)
    result = svc.partial_close_position("POS-001", req)
    assert result["shares_remaining"] == 6


def test_partial_close_records_event(tmp_path, monkeypatch):
    svc = _make_service_simple(tmp_path)
    req = PartialCloseRequest(shares_closed=4, price=22.0)
    svc.partial_close_position("POS-001", req)
    data = json.loads((tmp_path / "positions.json").read_text())
    pos = data["positions"][0]
    assert len(pos["partial_closes"]) == 1
    evt = pos["partial_closes"][0]
    assert evt["shares_closed"] == 4
    assert evt["price"] == 22.0
    assert abs(evt["r_at_close"] - 1.0) < 0.001  # (22-20)/(20-18) = 1.0


def test_partial_close_preserves_initial_risk(tmp_path, monkeypatch):
    svc = _make_service_simple(tmp_path)
    req = PartialCloseRequest(shares_closed=4, price=22.0)
    svc.partial_close_position("POS-001", req)
    data = json.loads((tmp_path / "positions.json").read_text())
    pos = data["positions"][0]
    assert pos["initial_risk"] == 20.0  # unchanged


def test_partial_close_rejects_closing_all_shares(tmp_path, monkeypatch):
    svc = _make_service_simple(tmp_path)
    req = PartialCloseRequest(shares_closed=10, price=22.0)
    with pytest.raises(HTTPException) as exc_info:
        svc.partial_close_position("POS-001", req)
    assert exc_info.value.status_code == 400


def test_partial_close_rejects_closed_position(tmp_path, monkeypatch):
    pos = _open_position()
    pos["status"] = "closed"
    pos["exit_price"] = 22.0
    pos_file = tmp_path / "positions.json"
    pos_file.write_text(json.dumps({"positions": [pos], "asof": "2026-01-01"}))
    ord_file = tmp_path / "orders.json"
    ord_file.write_text(json.dumps({"orders": [], "asof": "2026-01-01"}))
    svc = PortfolioService(
        positions_repo=PositionsRepository(str(pos_file)),
        orders_repo=OrdersRepository(str(ord_file)),
    )
    req = PartialCloseRequest(shares_closed=5, price=22.0)
    with pytest.raises(HTTPException) as exc_info:
        svc.partial_close_position("POS-001", req)
    assert exc_info.value.status_code == 400


def _make_service_simple(tmp_path) -> PortfolioService:
    pos = _open_position()
    pos_file = tmp_path / "positions.json"
    pos_file.write_text(json.dumps({"positions": [pos], "asof": "2026-01-01"}))
    ord_file = tmp_path / "orders.json"
    ord_file.write_text(json.dumps({"orders": [], "asof": "2026-01-01"}))
    return PortfolioService(
        positions_repo=PositionsRepository(str(pos_file)),
        orders_repo=OrdersRepository(str(ord_file)),
    )
```

- [ ] **Step 2: Run to verify fail**

```bash
pytest tests/api/test_partial_close.py -k "partial_close_reduces or partial_close_records or partial_close_preserves or partial_close_rejects" -v
```

Expected: FAIL — `partial_close_position` not on service.

- [ ] **Step 3: Add `partial_close_position()` to `portfolio_service.py`**

Add after `close_position()` (around line 967):

```python
def partial_close_position(self, position_id: str, request: "PartialCloseRequest") -> dict:
    """Close a subset of shares on an open position, recording a partial-close event."""
    data = self._positions_repo.read()
    positions = data.get("positions", [])
    found = False

    for pos in positions:
        if pos.get("position_id") != position_id:
            continue

        if pos.get("status") != "open":
            raise HTTPException(status_code=400, detail="Position is not open")

        current_shares = int(pos.get("shares", 0))
        if request.shares_closed >= current_shares:
            raise HTTPException(
                status_code=400,
                detail=f"shares_closed ({request.shares_closed}) must be less than current shares ({current_shares}); use close_position to fully close",
            )

        entry_price = float(pos.get("entry_price", 0.0))
        stop_price = float(pos.get("stop_price", 0.0))
        per_share_risk = entry_price - stop_price
        r_at_close = (request.price - entry_price) / per_share_risk if per_share_risk != 0 else 0.0

        event = {
            "date": get_today_str(),
            "shares_closed": request.shares_closed,
            "price": request.price,
            "r_at_close": round(r_at_close, 4),
            "fee_eur": request.fee_eur,
        }

        if "partial_closes" not in pos or pos["partial_closes"] is None:
            pos["partial_closes"] = []
        pos["partial_closes"].append(event)
        pos["shares"] = current_shares - request.shares_closed
        found = True
        break

    if not found:
        raise HTTPException(status_code=404, detail=f"Position not found: {position_id}")

    data["asof"] = get_today_str()
    self._positions_repo.write(data)

    return {
        "status": "ok",
        "position_id": position_id,
        "shares_closed": request.shares_closed,
        "price": request.price,
        "r_at_close": round(r_at_close, 4),
        "shares_remaining": pos["shares"],
    }
```

Also add `from api.models.portfolio import PartialCloseRequest` to the import block at the top of the service if not already present (it should be imported with the other models).

- [ ] **Step 4: Update `get_position_metrics()` to include `partial_closes` and `blended_r`**

In `get_position_metrics()` (around line 429), replace the `return PositionMetrics(...)` with:

```python
        raw_events = position.get("partial_closes") or []
        partial_close_events = [
            PartialCloseEvent(
                date=e["date"],
                shares_closed=int(e["shares_closed"]),
                price=float(e["price"]),
                r_at_close=float(e["r_at_close"]),
                fee_eur=e.get("fee_eur"),
            )
            for e in raw_events
        ]

        blended_r: Optional[float] = None
        if partial_close_events:
            total_shares = sum(e.shares_closed for e in partial_close_events)
            blended_r = sum(e.shares_closed * e.r_at_close for e in partial_close_events) / total_shares

        return PositionMetrics(
            ticker=ticker,
            pnl=pnl,
            fees_eur=entry_fee_eur,
            pnl_percent=pnl_percent,
            r_now=calculate_r_now(state_position, current_price),
            entry_value=entry_value,
            current_value=calculate_current_position_value(current_price, state_position.shares),
            per_share_risk=per_share_risk,
            total_risk=per_share_risk * state_position.shares,
            partial_closes=partial_close_events,
            blended_r=blended_r,
        )
```

Also add `PartialCloseEvent` and `Optional` to the relevant imports at the top of the service file if not already present.

- [ ] **Step 5: Run tests**

```bash
pytest tests/api/test_partial_close.py -v
```

Expected: all pass.

- [ ] **Step 6: Run full backend suite**

```bash
pytest -q
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add api/services/portfolio_service.py tests/api/test_partial_close.py
git commit -m "feat: add partial_close_position service method and blended_r in metrics"
```

---

## Task 3: Backend route

**Files:**
- Modify: `api/routers/portfolio.py`

- [ ] **Step 1: Add import and route**

In `api/routers/portfolio.py`, add `PartialCloseRequest` to the model imports at the top:

```python
from api.models.portfolio import (
    ...
    PartialCloseRequest,
    ...
)
```

Add the route immediately after `close_position` (around line 133):

```python
@router.post("/positions/{position_id}/partial-close")
async def partial_close_position(
    position_id: str,
    request: PartialCloseRequest,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Partially close an open position by closing a subset of shares."""
    return service.partial_close_position(position_id, request)
```

- [ ] **Step 2: Run backend suite**

```bash
pytest -q
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add api/routers/portfolio.py
git commit -m "feat: add POST /positions/{id}/partial-close endpoint"
```

---

## Task 4: Frontend types, API call, and hook

**Files:**
- Modify: `web-ui/src/lib/api.ts`
- Modify: `web-ui/src/features/portfolio/types.ts`
- Modify: `web-ui/src/features/portfolio/api.ts`
- Modify: `web-ui/src/features/portfolio/hooks.ts`

Follow the exact same pattern as `closePosition`.

- [ ] **Step 1: Add endpoint path to `api.ts`**

In `web-ui/src/lib/api.ts`, find the `API_ENDPOINTS` object and add:

```typescript
PARTIAL_CLOSE_POSITION: (positionId: string) => `/api/portfolio/positions/${positionId}/partial-close`,
```

- [ ] **Step 2: Add types to `features/portfolio/types.ts`**

Find `ClosePositionRequest` in the file and add after it:

```typescript
export interface PartialCloseEvent {
  date: string;
  sharesClosed: number;
  price: number;
  rAtClose: number;
  feeEur?: number | null;
}

export interface PartialCloseRequest {
  sharesClosed: number;
  price: number;
  feeEur?: number;
}
```

Also extend the `Position` interface by adding:
```typescript
  partialCloses: PartialCloseEvent[];
```

And extend `PositionMetrics` (if it exists as a type) or add a note that `blended_r` and `partial_closes` come back from the metrics endpoint — the frontend currently reads position metrics raw from the API without a dedicated typed interface (check the file first — if no `PositionMetrics` type exists, skip this sub-step).

- [ ] **Step 3: Update `transformPosition()` in `web-ui/src/types/position.ts`**

Find `transformPosition` and add the `partialCloses` mapping:

```typescript
  partialCloses: (raw.partial_closes ?? []).map((e: any) => ({
    date: e.date,
    sharesClosed: e.shares_closed,
    price: e.price,
    rAtClose: e.r_at_close,
    feeEur: e.fee_eur ?? null,
  })),
```

If `partial_closes` is not in the raw API type yet, also add `partial_closes?: Array<{...}>` to `PositionApiResponse`.

- [ ] **Step 4: Add fetch function to `features/portfolio/api.ts`**

```typescript
export async function partialClosePosition(
  positionId: string,
  request: PartialCloseRequest,
): Promise<void> {
  const response = await fetch(API_ENDPOINTS.PARTIAL_CLOSE_POSITION(positionId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      shares_closed: request.sharesClosed,
      price: request.price,
      fee_eur: request.feeEur,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail ?? 'Failed to partial close position');
  }
}
```

- [ ] **Step 5: Add hook to `features/portfolio/hooks.ts`**

```typescript
export function usePartialClosePositionMutation(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ positionId, request }: { positionId: string; request: PartialCloseRequest }) =>
      partialClosePosition(positionId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.positions() });
      onSuccess?.();
    },
  });
}
```

- [ ] **Step 6: Typecheck**

```bash
cd web-ui && npm run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add web-ui/src/lib/api.ts web-ui/src/features/portfolio/types.ts \
        web-ui/src/features/portfolio/api.ts web-ui/src/features/portfolio/hooks.ts \
        web-ui/src/types/position.ts
git commit -m "feat: add partialClosePosition frontend types, API call, and hook"
```

---

## Task 5: `PartialCloseModalForm` component

**Files:**
- Create: `web-ui/src/components/domain/positions/PartialCloseModalForm.tsx`
- Create: `web-ui/src/components/domain/positions/PartialCloseModalForm.test.tsx`
- Modify: `web-ui/src/i18n/messages.en.ts`

**Modal UX:**
- Shares input: numeric, `1` to `position.shares - 1`, default `Math.floor(position.shares / 2)`
- Price input: numeric, default `position.entryPrice` (user will type current price)
- Live preview: "Locked profit: +X.XX (1.0R) · Remaining: N shares, risk Y"
- Submit button: "Partial Close"

- [ ] **Step 1: Add i18n keys**

In `web-ui/src/i18n/messages.en.ts`, find the `positions` section and add a `partialCloseModal` subsection:

```typescript
      partialCloseModal: {
        title: 'Partial Close — {{ticker}}',
        sharesLabel: 'Shares to close',
        priceLabel: 'Exit price',
        feeEurOptional: 'Fee (EUR, optional)',
        preview: 'Preview',
        lockedProfit: 'Locked profit',
        remainingShares: 'Remaining shares',
        remainingRisk: 'Remaining risk',
        rAtClose: 'R at close',
        submit: 'Partial Close',
        errorTooManyShares: 'Cannot close all shares — use Close Position instead.',
        errorInvalidPrice: 'Enter a valid positive price.',
        errorInvalidShares: 'Enter a number between 1 and {{max}}.',
      },
```

- [ ] **Step 2: Write the failing test**

Create `web-ui/src/components/domain/positions/PartialCloseModalForm.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import PartialCloseModalForm from './PartialCloseModalForm';
import { t } from '@/i18n/t';
import type { Position } from '@/features/portfolio/types';

const position: Position = {
  positionId: 'POS-001',
  ticker: 'AAPL',
  status: 'open',
  entryDate: '2026-01-01',
  entryPrice: 20.0,
  stopPrice: 18.0,
  shares: 10,
  initialRisk: 20.0,
  partialCloses: [],
  notes: '',
  tags: [],
};

describe('PartialCloseModalForm', () => {
  it('renders with default shares = 50% of position', () => {
    renderWithProviders(
      <PartialCloseModalForm
        position={position}
        isLoading={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    const sharesInput = screen.getByLabelText(t('positions.partialCloseModal.sharesLabel'));
    expect((sharesInput as HTMLInputElement).value).toBe('5');
  });

  it('calls onSubmit with correct shares and price', () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <PartialCloseModalForm
        position={position}
        isLoading={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    const priceInput = screen.getByLabelText(t('positions.partialCloseModal.priceLabel'));
    fireEvent.change(priceInput, { target: { value: '22.0' } });
    fireEvent.click(screen.getByText(t('positions.partialCloseModal.submit')));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ sharesClosed: 5, price: 22.0 })
    );
  });

  it('shows validation error when shares >= total', () => {
    renderWithProviders(
      <PartialCloseModalForm
        position={position}
        isLoading={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    const sharesInput = screen.getByLabelText(t('positions.partialCloseModal.sharesLabel'));
    fireEvent.change(sharesInput, { target: { value: '10' } });
    fireEvent.click(screen.getByText(t('positions.partialCloseModal.submit')));
    expect(screen.getByText(t('positions.partialCloseModal.errorTooManyShares'))).toBeInTheDocument();
  });

  it('shows live R-at-close preview', () => {
    renderWithProviders(
      <PartialCloseModalForm
        position={position}
        isLoading={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    const priceInput = screen.getByLabelText(t('positions.partialCloseModal.priceLabel'));
    fireEvent.change(priceInput, { target: { value: '22.0' } });
    // (22 - 20) / (20 - 18) = 1.00R
    expect(screen.getByText(/1\.00R/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify fail**

```bash
cd web-ui && npx vitest run src/components/domain/positions/PartialCloseModalForm.test.tsx
```

Expected: FAIL — component doesn't exist.

- [ ] **Step 4: Implement `PartialCloseModalForm.tsx`**

Create `web-ui/src/components/domain/positions/PartialCloseModalForm.tsx`:

```typescript
import { useState } from 'react';
import Button from '@/components/common/Button';
import ModalShell from '@/components/common/ModalShell';
import type { PartialCloseRequest, Position } from '@/features/portfolio/types';
import { formatCurrency } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface PartialCloseModalFormProps {
  position: Position;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (request: PartialCloseRequest) => void;
}

function parsePositiveFloat(value: string): number | null {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parsePositiveInt(value: string): number | null {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function PartialCloseModalForm({
  position,
  isLoading,
  error,
  onClose,
  onSubmit,
}: PartialCloseModalFormProps) {
  const defaultShares = Math.max(1, Math.floor(position.shares / 2));
  const [sharesValue, setSharesValue] = useState(String(defaultShares));
  const [priceValue, setPriceValue] = useState(position.entryPrice.toFixed(2));
  const [feeEurValue, setFeeEurValue] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const parsedShares = parsePositiveInt(sharesValue) ?? 0;
  const parsedPrice = parsePositiveFloat(priceValue) ?? 0;
  const perShareRisk = position.entryPrice - position.stopPrice;
  const rAtClose = perShareRisk !== 0 ? (parsedPrice - position.entryPrice) / perShareRisk : 0;
  const lockedProfit = (parsedPrice - position.entryPrice) * parsedShares;
  const remainingShares = position.shares - parsedShares;
  const remainingRisk = perShareRisk * remainingShares;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const shares = parsePositiveInt(sharesValue);
    if (shares == null || shares < 1 || shares >= position.shares) {
      setFormError(
        shares != null && shares >= position.shares
          ? t('positions.partialCloseModal.errorTooManyShares')
          : t('positions.partialCloseModal.errorInvalidShares', { max: position.shares - 1 }),
      );
      return;
    }

    const price = parsePositiveFloat(priceValue);
    if (price == null) {
      setFormError(t('positions.partialCloseModal.errorInvalidPrice'));
      return;
    }

    const feeEurStr = feeEurValue.trim();
    const feeEur =
      feeEurStr.length > 0
        ? Number.parseFloat(feeEurStr) >= 0
          ? Number.parseFloat(feeEurStr)
          : undefined
        : undefined;

    onSubmit({ sharesClosed: shares, price, feeEur });
  };

  return (
    <ModalShell
      title={t('positions.partialCloseModal.title', { ticker: position.ticker })}
      onClose={onClose}
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Position summary */}
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm space-y-1">
          <p><strong>{t('positions.closeModal.entryLabel')}</strong> {formatCurrency(position.entryPrice)}</p>
          <p><strong>{t('positions.closeModal.sharesLabel')}</strong> {position.shares}</p>
          <p><strong>{t('positions.closeModal.stopLabel')}</strong> {formatCurrency(position.stopPrice)}</p>
        </div>

        {/* Shares to close */}
        <div>
          <label htmlFor="partial-close-shares" className="block text-sm font-medium mb-1">
            {t('positions.partialCloseModal.sharesLabel')}
          </label>
          <input
            id="partial-close-shares"
            type="number"
            step="1"
            min="1"
            max={position.shares - 1}
            value={sharesValue}
            onChange={(e) => setSharesValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            required
          />
        </div>

        {/* Price */}
        <div>
          <label htmlFor="partial-close-price" className="block text-sm font-medium mb-1">
            {t('positions.partialCloseModal.priceLabel')}
          </label>
          <input
            id="partial-close-price"
            type="number"
            step="0.01"
            min="0.01"
            value={priceValue}
            onChange={(e) => setPriceValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            required
          />
        </div>

        {/* Fee */}
        <div>
          <label htmlFor="partial-close-fee" className="block text-sm font-medium mb-1">
            {t('positions.partialCloseModal.feeEurOptional')}
          </label>
          <input
            id="partial-close-fee"
            type="number"
            step="0.01"
            min="0"
            value={feeEurValue}
            onChange={(e) => setFeeEurValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
          />
        </div>

        {/* Live preview */}
        {parsedShares > 0 && parsedPrice > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-sm space-y-1">
            <p className="font-medium">{t('positions.partialCloseModal.preview')}</p>
            <p>
              <span className="text-gray-600 dark:text-gray-400">{t('positions.partialCloseModal.rAtClose')}: </span>
              <span className={rAtClose >= 0 ? 'text-green-600 font-mono' : 'text-red-600 font-mono'}>
                {rAtClose >= 0 ? '+' : ''}{rAtClose.toFixed(2)}R
              </span>
            </p>
            <p>
              <span className="text-gray-600 dark:text-gray-400">{t('positions.partialCloseModal.lockedProfit')}: </span>
              <span className={lockedProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                {lockedProfit >= 0 ? '+' : ''}{formatCurrency(lockedProfit)}
              </span>
            </p>
            <p>
              <span className="text-gray-600 dark:text-gray-400">{t('positions.partialCloseModal.remainingShares')}: </span>
              {remainingShares}
            </p>
            <p>
              <span className="text-gray-600 dark:text-gray-400">{t('positions.partialCloseModal.remainingRisk')}: </span>
              {formatCurrency(remainingRisk)}
            </p>
          </div>
        )}

        {formError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{formError}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? t('positions.closeModal.closing') : t('positions.partialCloseModal.submit')}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
```

- [ ] **Step 5: Run tests**

```bash
cd web-ui && npx vitest run src/components/domain/positions/PartialCloseModalForm.test.tsx
```

Expected: all pass.

- [ ] **Step 6: Run typecheck**

```bash
cd web-ui && npm run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add web-ui/src/i18n/messages.en.ts \
        web-ui/src/components/domain/positions/PartialCloseModalForm.tsx \
        web-ui/src/components/domain/positions/PartialCloseModalForm.test.tsx
git commit -m "feat: add PartialCloseModalForm component with live R preview"
```

---

## Task 6: Wire "Partial Close" button into `PortfolioTable`

**Files:**
- Modify: `web-ui/src/components/domain/workspace/PortfolioTable.tsx`

Add state for `showPartialCloseModal`, wire the new button next to "Close", and render `PartialCloseModalForm`.

- [ ] **Step 1: Add state and mutation**

In `PortfolioTable.tsx`, find the existing state declarations (around line 112) and add:

```typescript
const [showPartialCloseModal, setShowPartialCloseModal] = useState(false);
const partialClosePositionMutation = usePartialClosePositionMutation(() => {
  setShowPartialCloseModal(false);
  setSelectedPosition(null);
});
```

Import `usePartialClosePositionMutation` from `@/features/portfolio/hooks` and `PartialCloseModalForm` from `@/components/domain/positions/PartialCloseModalForm`.

- [ ] **Step 2: Find where the "Close" button renders per row and add "Partial Close" next to it**

Search for the row actions in PortfolioTable — the "Close" button is likely rendered inside the row action column. Find it and add a "Partial Close" button:

```typescript
<Button
  size="sm"
  variant="secondary"
  onClick={() => {
    setSelectedPosition(row.position!);
    setShowPartialCloseModal(true);
  }}
  disabled={!row.position}
>
  {t('positions.partialCloseModal.submit')}
</Button>
```

Place this immediately before or after the existing "Close" button.

- [ ] **Step 3: Render the modal**

Add after the existing `{showCloseModal && selectedPosition ? ... }` block:

```typescript
{showPartialCloseModal && selectedPosition ? (
  <PartialCloseModalForm
    position={selectedPosition}
    onClose={() => { setShowPartialCloseModal(false); setSelectedPosition(null); }}
    onSubmit={(request) =>
      partialClosePositionMutation.mutate({ positionId: selectedPosition.positionId!, request })
    }
    isLoading={partialClosePositionMutation.isPending}
    error={partialClosePositionMutation.error?.message}
  />
) : null}
```

- [ ] **Step 4: Typecheck**

```bash
cd web-ui && npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/components/domain/workspace/PortfolioTable.tsx
git commit -m "feat: add Partial Close button and modal to PortfolioTable"
```

---

## Task 7: Final validation and docs update

- [ ] **Step 1: Full backend suite**

```bash
pytest -q
```

Expected: all pass.

- [ ] **Step 2: Full frontend suite**

```bash
cd web-ui && npx vitest run
```

Expected: all pass.

- [ ] **Step 3: Typecheck**

```bash
cd web-ui && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Update roadmap**

In `docs/superpowers/specs/2026-05-03-swing-trading-feature-roadmap.md`, update the F10 row:

```
| 10 | Partial exits | 2 | ✅ Done — `codex/partial-exits` / PR pending | Scale-out capability |
```

- [ ] **Step 5: Update handover-context**

In `docs/superpowers/plans/handover-context.md`:

1. Add F10 to the feature table:
```
| Feature 10 - Partial exits | `codex/partial-exits` | `main` | pending | PR pending |
```

2. Add F10 to the validation section:
```
- Feature 10: `pytest tests/api/test_partial_close.py -v`, `cd web-ui && npx vitest run src/components/domain/positions/PartialCloseModalForm.test.tsx`, `pytest -q`, `cd web-ui && npm run typecheck`.
```

3. Update active branch section:
```
Next work: Tier 3 features (F11 Regime performance, F12 FX-adjusted R, F13 Trail customization, F14 MTF trend filter). Start new branch from `main`.
```

- [ ] **Step 6: Commit docs**

```bash
git add docs/superpowers/specs/2026-05-03-swing-trading-feature-roadmap.md \
        docs/superpowers/plans/handover-context.md \
        docs/superpowers/plans/2026-05-08-feature-10-partial-exits.md
git commit -m "docs: mark F10 partial exits complete in roadmap and handover-context"
```
