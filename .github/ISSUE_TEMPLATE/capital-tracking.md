---
name: Capital Tracking & Allocation Improvement
about: Track available capital and prevent over-allocation via pending orders
title: 'Implement capital tracking and blocking for pending buy orders'
labels: enhancement, portfolio, risk-management
assignees: ''
---

## Problem Statement

The Swing Screener currently **does NOT track or block capital** when pending buy orders are placed.

**Current issues:**
- ❌ Pending entry orders do not reserve capital
- ❌ Position sizing uses total account size, not available capital
- ❌ Multiple pending orders can exceed available funds
- ❌ No portfolio-level visibility of capital allocation

**Example:**
```
Account: $500
Open positions: $300 (60%)
User creates 3 orders @ $100 each
Total if all fill: $600 (120%!) ← System allows this
```

## Analysis

See full analysis in `ACCOUNT_SIZE_ANALYSIS.md` (25+ pages)

**Current capital allocation (from real data):**
| Item | Amount | % |
|------|--------|---|
| Open positions | $302.65 | 60.5% |
| Pending orders | $0.00 | 0% |
| Available | $197.35 | 39.5% |

**Problem:** System doesn't track this!

## Proposed Solution

### Phase 1: Foundation (HIGH PRIORITY)

**1. Create capital tracking module**
- File: `src/swing_screener/portfolio/capital.py`
- Functions: `compute_capital_state()`, `check_capital_available()`
- Models: `CapitalState`, `CapitalCheck`

**2. Add API endpoint**
- `GET /api/portfolio/capital` → returns allocation state

**3. Block order creation**
- Update `create_order()` to check capital
- Return 400 with details if insufficient

### Phase 2: Integration (MEDIUM PRIORITY)

**4. Dashboard capital widget**
- Visual progress bar
- Real-time updates
- Color-coded (green/orange/red)

**5. Update position sizing**
- Accept `available_capital` parameter
- Constrain by availability

**6. Screener warnings**
- Warn if utilization >80%

### Phase 3: Advanced (LOW PRIORITY)

- Portfolio-level hard cap
- Capital forecasting
- Auto-cancel stale orders

## Implementation Details

<details>
<summary>Capital State Model (click to expand)</summary>

```python
@dataclass(frozen=True)
class CapitalState:
    account_size: float
    allocated_positions: float  # Capital in open positions
    reserved_orders: float      # Capital in pending entry orders
    available: float            # Remaining capital
    utilization_pct: float      # Usage percentage

def compute_capital_state(positions, orders, account_size):
    allocated = sum(p.shares * p.entry_price for p in positions if p.status == "open")
    reserved = sum(o.quantity * o.limit_price for o in orders 
                   if o.status == "pending" and o.order_kind == "entry")
    available = account_size - allocated - reserved
    utilization = (allocated + reserved) / account_size
    return CapitalState(...)
```

</details>

<details>
<summary>Order Creation with Capital Check (click to expand)</summary>

```python
def create_order(request):
    capital_state = compute_capital_state(positions, orders, account_size)
    required = request.quantity * request.limit_price
    check = check_capital_available(capital_state, required)
    
    if not check.is_available:
        raise HTTPException(400, detail={
            "error": "insufficient_capital",
            "capital_state": {...},
            "shortfall": check.shortfall
        })
    # Create order...
```

</details>

## Testing Requirements

### Unit Tests
```python
def test_capital_state_calculation():
    # Open: $3500, Pending: $400, Available: $6100
    state = compute_capital_state(positions, orders, 10000)
    assert state.allocated_positions == 3500
    assert state.reserved_orders == 400
    assert state.available == 6100

def test_check_capital_insufficient():
    state = CapitalState(available=1000, ...)
    check = check_capital_available(state, required=2000)
    assert not check.is_available
    assert check.shortfall == 1000
```

### Integration Tests
```python
def test_order_blocked_insufficient_capital(client):
    response = client.post("/api/orders", json={
        "ticker": "AAPL",
        "quantity": 100,
        "limit_price": 200  # $20k but only $500 available
    })
    assert response.status_code == 400
    assert "insufficient_capital" in response.json()["detail"]
```

## Acceptance Criteria

### Phase 1 (MVP)
- [ ] Capital tracking module with full test coverage
- [ ] API endpoint returns capital state
- [ ] Order creation blocked when capital insufficient
- [ ] Clear error messages with breakdown
- [ ] Unit tests >95% coverage
- [ ] Integration tests pass

### Phase 2
- [ ] Dashboard capital widget
- [ ] Real-time updates
- [ ] Screener warnings
- [ ] Position sizing uses available capital

### Phase 3
- [ ] Portfolio max allocation
- [ ] Capital forecasting
- [ ] Auto-cancel stale orders

## Migration & Rollout

1. **Week 1:** Deploy capital endpoint (read-only, no blocking)
2. **Week 2:** Enable blocking in dev/staging
3. **Week 3:** Production rollout (gradual: 10% → 50% → 100%)
4. **Week 4:** Add UI components

## Documentation

Update:
- [ ] `docs/OPERATIONAL_GUIDE.md`
- [ ] `docs/WEB_UI_GUIDE.md`
- [ ] `README.md`
- [ ] API documentation

## Open Questions

1. Should pending STOP orders affect capital? (No - they're exits)
2. Handle partial fills? (Update order status on partial fill)
3. Dynamic account size? (Manual updates only in Phase 1)

## References

- **Analysis:** `ACCOUNT_SIZE_ANALYSIS.md` (comprehensive 25-page document)
- **Current code:** 
  - `src/swing_screener/risk/position_sizing.py`
  - `api/services/portfolio_service.py`

---

**Priority:** 🔴 HIGH  
**Effort:** 1-2 weeks (Phase 1)  
**Impact:** 🎯 HIGH (prevents costly over-allocation)
