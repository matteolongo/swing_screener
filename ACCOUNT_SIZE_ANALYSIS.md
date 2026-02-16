# Account Size Management - Analysis & Improvement Plan

**Date:** 2026-02-15  
**Analysis by:** GitHub Copilot Agent  
**Status:** Draft for Review

---

## Executive Summary

The Swing Screener currently manages account size through a **risk-based position sizing system** but **does NOT track or block capital** when pending buy orders are placed. This creates potential issues:

1. **No capital blocking** for pending entry orders
2. **No tracking** of available vs. allocated capital
3. **Risk of over-allocation** when multiple orders fill simultaneously
4. **No portfolio-level capital constraint**

**Current State:**
- Account size: Configurable (default $500 or strategy-specific)
- Position sizing: Risk-based (1% risk per trade typical)
- Max position size: 60% of account (per position)
- Capital tracking: **NONE** ❌

---

## Current Implementation

### 1. Account Size Configuration

**Location:** `src/swing_screener/risk/position_sizing.py`

```python
@dataclass(frozen=True)
class RiskConfig:
    account_size: float = 500.0              # Total account
    risk_pct: float = 0.01                   # 1% risk per trade
    k_atr: float = 2.0                       # Stop = entry - 2*ATR
    max_position_pct: float = 0.60           # Max 60% per position
    min_shares: int = 1
    min_rr: float = 2.0                      # Min reward-to-risk ratio
    max_fee_risk_pct: float = 0.20           # Max fees vs risk
```

**Key Points:**
- Account size is a configuration parameter
- Used for calculating position sizes
- NOT updated based on actual capital usage

### 2. Position Sizing Logic

**Function:** `position_plan(entry, atr14, cfg)`

**Current logic:**
```python
risk_amount = cfg.account_size * cfg.risk_pct  # e.g., $500 * 0.01 = $5
risk_per_share = entry - stop
shares_by_risk = floor(risk_amount / risk_per_share)

max_position_value = cfg.account_size * cfg.max_position_pct  # e.g., $500 * 0.6 = $300
shares_by_cap = floor(max_position_value / entry)

shares = min(shares_by_risk, shares_by_cap)
position_value = shares * entry
```

**Issues:**
- Uses TOTAL account size, not AVAILABLE capital
- Does NOT check current open positions
- Does NOT check pending entry orders
- Each calculation is independent

### 3. Current Capital Allocation (Example from Data)

**From `data/positions.json` (2026-02-13):**

| Ticker | Status | Shares | Entry Price | Capital Allocated |
|--------|--------|--------|-------------|-------------------|
| VALE   | open   | 6      | $15.89      | $95.34           |
| MUFG   | open   | 4      | $17.93      | $71.72           |
| SMFG   | open   | 4      | $21.51      | $86.04           |
| INTC   | open   | 1      | $49.55      | $49.55           |
| **TOTAL** | -   | -      | -           | **$302.65**      |

**Pending entry orders:** 0 (currently)

**If account size is $500:**
- Used: $302.65 (60.5%)
- Available: $197.35 (39.5%)
- **BUT**: System doesn't track this! ❌

### 4. Screener Behavior

**Location:** `api/services/screener_service.py:311`

```python
results = build_daily_report(ohlcv, cfg=report_cfg, exclude_tickers=[])
```

**Current behavior:**
- `exclude_tickers=[]` is ALWAYS empty
- Screener can recommend tickers already held
- No awareness of capital constraints
- No capital reservation for pending orders

**Note:** CLI has `--positions` flag to exclude held tickers, but:
- Only excludes from candidate list
- Does NOT block capital
- Does NOT adjust available capital

---

## Problem Scenarios

### Scenario 1: Over-Allocation via Multiple Pending Orders

**Setup:**
- Account size: $500
- Open positions: $300 (60% used)
- Available: $200 (40%)

**What happens:**
1. Screener runs → recommends 5 new trades
2. User creates 5 pending limit orders, each requiring ~$80
   - Total pending: $400
3. **Problem:** $300 (open) + $400 (pending) = $700 needed, but only $500 available
4. If 3 orders fill overnight → **over-allocated by $200**

**Current system:** No warning, no prevention ❌

### Scenario 2: Position Sizing Ignores Existing Positions

**Setup:**
- Account size: $10,000
- Already have: 4 positions using $6,000 (60%)
- Screener recommends new trade

**What happens:**
1. Position sizing calculates: `max_position_value = $10,000 * 0.6 = $6,000`
2. **Problem:** Already have $6,000 allocated!
3. New position could require another $4,000
4. Total: $10,000 (100% allocated) ✅
5. **BUT:** If user has pending orders too → over-allocated ❌

### Scenario 3: Risk Budget vs. Capital Budget Mismatch

**Setup:**
- Account size: $500
- Risk per trade: 1% = $5
- 4 open positions (as in real data): $302.65

**Analysis:**
- Risk-based sizing: Still has room for more trades (risk budget allows)
- Capital-based reality: Only $197.35 available (39.5%)
- **Problem:** Risk budget says "yes", capital says "no"

---

## Root Causes

### 1. No Capital Tracking State
- System tracks positions (`positions.json`)
- System tracks orders (`orders.json`)
- **BUT:** No module calculates `available_capital`

### 2. No Portfolio-Level Constraint
- `max_position_pct` limits **individual** positions (60% max)
- No constraint on **total** portfolio allocation
- Could theoretically have 10 positions at 60% each = 600%!

### 3. Pending Orders Not Considered
- When order is created (status: `pending`)
- Capital is NOT reserved
- Multiple pending orders can exceed available capital

### 4. Screener Unaware of Capital
- Screener generates candidates
- Does NOT check: "Can user afford this?"
- Does NOT filter by available capital

---

## Proposed Improvements

### Improvement 1: Capital Tracking Module

**Create:** `src/swing_screener/portfolio/capital.py`

```python
@dataclass(frozen=True)
class CapitalState:
    """Portfolio capital state."""
    account_size: float
    allocated_positions: float  # Capital in open positions
    reserved_orders: float      # Capital in pending entry orders
    available: float            # account_size - allocated - reserved
    utilization_pct: float      # (allocated + reserved) / account_size
    
@dataclass(frozen=True)
class CapitalCheck:
    """Result of checking if capital is available."""
    is_available: bool
    required: float
    available: float
    shortfall: float
    reason: str

def compute_capital_state(
    positions: list[Position],
    orders: list[Order],
    account_size: float
) -> CapitalState:
    """Calculate current capital allocation."""
    allocated = sum(
        p.shares * p.entry_price 
        for p in positions 
        if p.status == "open"
    )
    
    reserved = sum(
        o.quantity * o.limit_price
        for o in orders
        if o.status == "pending" and o.order_kind == "entry"
    )
    
    available = account_size - allocated - reserved
    utilization = (allocated + reserved) / account_size if account_size > 0 else 0.0
    
    return CapitalState(
        account_size=account_size,
        allocated_positions=allocated,
        reserved_orders=reserved,
        available=available,
        utilization_pct=utilization
    )

def check_capital_available(
    capital_state: CapitalState,
    required_capital: float
) -> CapitalCheck:
    """Check if sufficient capital is available for a new order."""
    is_available = capital_state.available >= required_capital
    shortfall = max(0.0, required_capital - capital_state.available)
    
    if is_available:
        reason = f"Sufficient capital available (${capital_state.available:.2f} >= ${required_capital:.2f})"
    else:
        reason = f"Insufficient capital: need ${required_capital:.2f}, have ${capital_state.available:.2f} (shortfall: ${shortfall:.2f})"
    
    return CapitalCheck(
        is_available=is_available,
        required=required_capital,
        available=capital_state.available,
        shortfall=shortfall,
        reason=reason
    )
```

### Improvement 2: Position Sizing with Capital Awareness

**Update:** `position_plan()` to accept `CapitalState`

```python
def position_plan(
    entry: float, 
    atr14: float, 
    cfg: RiskConfig = RiskConfig(),
    capital_state: Optional[CapitalState] = None
) -> Optional[Dict[str, Any]]:
    """
    Build a position plan constrained by:
      - risk budget (account_size * risk_pct)
      - max position value (account_size * max_position_pct)
      - AVAILABLE CAPITAL (new!)
    """
    risk_amount = cfg.account_size * cfg.risk_pct
    stop = compute_stop(entry, atr14, cfg.k_atr)
    risk_per_share = entry - stop
    
    if risk_per_share <= 0:
        return None
    
    # Original constraints
    shares_by_risk = math.floor(risk_amount / risk_per_share)
    max_position_value = cfg.account_size * cfg.max_position_pct
    shares_by_cap = math.floor(max_position_value / entry)
    
    # NEW: Capital availability constraint
    if capital_state is not None:
        shares_by_available = math.floor(capital_state.available / entry)
        shares = min(shares_by_risk, shares_by_cap, shares_by_available)
    else:
        shares = min(shares_by_risk, shares_by_cap)
    
    if shares < cfg.min_shares:
        return None
    
    position_value = shares * entry
    realized_risk = shares * risk_per_share
    
    return {
        "entry": round(entry, 2),
        "stop": round(stop, 2),
        "shares": int(shares),
        "position_value": round(position_value, 2),
        "realized_risk": round(realized_risk, 2),
        "constrained_by": _determine_constraint(shares_by_risk, shares_by_cap, shares_by_available if capital_state else None),
    }
```

### Improvement 3: Order Creation with Capital Check

**Update:** `api/services/portfolio_service.py:create_order()`

```python
def create_order(self, request: CreateOrderRequest) -> Order:
    # Load current state
    positions = load_positions(self._positions_repo.path)
    orders = load_orders(self._orders_repo.path)
    
    # Get risk config for account size
    from api.routers.config import current_config
    account_size = current_config.risk.account_size
    
    # Compute capital state
    capital_state = compute_capital_state(positions, orders, account_size)
    
    # Calculate required capital
    required_capital = request.quantity * request.limit_price
    
    # Check if capital is available
    check = check_capital_available(capital_state, required_capital)
    
    if not check.is_available:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "insufficient_capital",
                "message": check.reason,
                "capital_state": {
                    "account_size": capital_state.account_size,
                    "allocated": capital_state.allocated_positions,
                    "reserved": capital_state.reserved_orders,
                    "available": capital_state.available,
                    "required": required_capital,
                    "shortfall": check.shortfall
                }
            }
        )
    
    # Proceed with order creation...
```

### Improvement 4: Dashboard Capital Widget

**Add to Web UI Dashboard:**

```typescript
interface CapitalState {
  accountSize: number;
  allocatedPositions: number;
  reservedOrders: number;
  available: number;
  utilizationPct: number;
}

function CapitalWidget({ state }: { state: CapitalState }) {
  const utilizationColor = 
    state.utilizationPct > 90 ? 'red' :
    state.utilizationPct > 75 ? 'orange' : 'green';
    
  return (
    <Card>
      <h3>Capital Allocation</h3>
      <ProgressBar value={state.utilizationPct} color={utilizationColor} />
      <div>Account Size: ${state.accountSize.toFixed(2)}</div>
      <div>Open Positions: ${state.allocatedPositions.toFixed(2)}</div>
      <div>Pending Orders: ${state.reservedOrders.toFixed(2)}</div>
      <div>Available: ${state.available.toFixed(2)}</div>
      <div>Utilization: {state.utilizationPct.toFixed(1)}%</div>
    </Card>
  );
}
```

### Improvement 5: Screener Capital Filtering

**Add optional parameter:**

```python
def build_daily_report(
    ohlcv: pd.DataFrame,
    cfg: ReportConfig,
    exclude_tickers: Optional[list[str]] = None,
    capital_state: Optional[CapitalState] = None,  # NEW
) -> pd.DataFrame:
    """
    If capital_state provided, filter candidates by available capital.
    """
    # ... existing logic ...
    
    if capital_state is not None and not plans.empty:
        # Filter plans that require more capital than available
        plans = plans[plans["position_value"] <= capital_state.available]
    
    return report
```

### Improvement 6: Portfolio-Level Max Allocation

**Add to RiskConfig:**

```python
@dataclass(frozen=True)
class RiskConfig:
    # ... existing fields ...
    max_portfolio_pct: float = 0.90  # NEW: Max 90% of account in positions + orders
```

**Enforce in capital check:**

```python
def check_capital_available(
    capital_state: CapitalState,
    required_capital: float,
    max_portfolio_pct: float = 0.90
) -> CapitalCheck:
    # Check 1: Available capital
    after_allocation = capital_state.allocated_positions + capital_state.reserved_orders + required_capital
    utilization_after = after_allocation / capital_state.account_size
    
    # Check 2: Portfolio-level max
    if utilization_after > max_portfolio_pct:
        return CapitalCheck(
            is_available=False,
            required=required_capital,
            available=capital_state.available,
            shortfall=required_capital - capital_state.available,
            reason=f"Portfolio allocation would exceed {max_portfolio_pct*100:.0f}% limit (current: {capital_state.utilization_pct*100:.0f}%, after: {utilization_after*100:.0f}%)"
        )
    
    # Existing check...
```

---

## Implementation Priority

### Phase 1: Foundation (High Priority)
1. ✅ Create `capital.py` module with `CapitalState` and utility functions
2. ✅ Add API endpoint: `GET /api/portfolio/capital` returning `CapitalState`
3. ✅ Update `create_order()` to check capital before creating order

**Impact:** Prevents over-allocation at order creation time

### Phase 2: Integration (Medium Priority)
4. ✅ Add capital widget to Web UI Dashboard
5. ✅ Update position_plan() to accept and use `CapitalState`
6. ✅ Add warning in screener if capital is low

**Impact:** Better visibility and planning

### Phase 3: Advanced (Low Priority)
7. ⚠️ Add portfolio-level max allocation constraint
8. ⚠️ Add "capital reservation" period for pending orders
9. ⚠️ Add capital forecasting (if all pending orders fill)

**Impact:** Advanced portfolio management

---

## Testing Strategy

### Unit Tests
```python
def test_capital_state_calculation():
    """Test capital allocation calculation."""
    positions = [
        Position(ticker="AAPL", status="open", shares=10, entry_price=150.0, ...),
        Position(ticker="MSFT", status="open", shares=5, entry_price=400.0, ...),
        Position(ticker="GOOGL", status="closed", shares=3, entry_price=140.0, ...),  # ignored
    ]
    orders = [
        Order(ticker="TSLA", status="pending", order_kind="entry", quantity=2, limit_price=200.0, ...),
        Order(ticker="NVDA", status="filled", order_kind="entry", quantity=10, limit_price=500.0, ...),  # ignored
    ]
    
    state = compute_capital_state(positions, orders, account_size=10000.0)
    
    assert state.allocated_positions == 3500.0  # 10*150 + 5*400
    assert state.reserved_orders == 400.0       # 2*200
    assert state.available == 6100.0            # 10000 - 3500 - 400
    assert state.utilization_pct == 0.39        # 3900/10000

def test_capital_check_sufficient():
    """Test capital check when sufficient capital available."""
    state = CapitalState(
        account_size=10000.0,
        allocated_positions=3000.0,
        reserved_orders=2000.0,
        available=5000.0,
        utilization_pct=0.50
    )
    
    check = check_capital_available(state, required_capital=3000.0)
    assert check.is_available is True
    assert check.shortfall == 0.0

def test_capital_check_insufficient():
    """Test capital check when insufficient capital."""
    state = CapitalState(
        account_size=10000.0,
        allocated_positions=5000.0,
        reserved_orders=3000.0,
        available=2000.0,
        utilization_pct=0.80
    )
    
    check = check_capital_available(state, required_capital=3000.0)
    assert check.is_available is False
    assert check.shortfall == 1000.0
    assert "Insufficient capital" in check.reason
```

### Integration Tests
```python
def test_create_order_blocked_by_capital(client):
    """Test that order creation is blocked when insufficient capital."""
    # Setup: allocate most capital
    # ... create positions and orders using most of $500 account ...
    
    # Try to create order requiring more capital than available
    response = client.post("/api/orders", json={
        "ticker": "AAPL",
        "order_type": "BUY_LIMIT",
        "quantity": 10,
        "limit_price": 200.0,  # requires $2000, but only ~$100 available
    })
    
    assert response.status_code == 400
    assert "insufficient_capital" in response.json()["detail"]["error"]
```

---

## Migration Plan

### Backward Compatibility
- New capital checking is **opt-in** initially
- Add config flag: `capital_tracking_enabled: bool = False`
- When disabled: works as current (no blocking)
- When enabled: enforces capital constraints

### Rollout Steps
1. Deploy capital module (no enforcement)
2. Add API endpoint and UI widget (visibility only)
3. Monitor for 1-2 weeks (observe capital patterns)
4. Enable enforcement in API (block over-allocation)
5. Add screener filtering (after proven stable)

### User Communication
- Release notes explaining new feature
- Dashboard shows capital state (even before enforcement)
- Clear error messages when order blocked
- Documentation update: OPERATIONAL_GUIDE.md

---

## Open Questions

1. **Should pending STOP orders reserve capital?**
   - Current answer: NO (stops are sells, not buys)
   - But: Could reserve negative capital (expected inflow)

2. **How to handle partial fills?**
   - Order for 10 shares, only 5 fill
   - Capital reserved: full 10
   - Capital actually used: only 5
   - Solution: Update order status when partially filled

3. **Multi-currency accounts?**
   - Current system assumes single currency
   - Enhancement: Track capital per currency
   - Out of scope for initial implementation

4. **Should account size be dynamic?**
   - Option A: User updates manually
   - Option B: System updates based on realized P&L
   - Recommendation: Start with A (explicit), add B later

5. **Grace period for capital reservation?**
   - Pending order might never fill
   - Should capital be "reserved" indefinitely?
   - Options: 
     - Reserve for X days then release
     - User manually cancels to free capital
   - Recommendation: No auto-release (user cancels)

---

## Metrics to Track

After implementation:
- Capital utilization over time
- Number of orders blocked by capital check
- Frequency of "shortfall" warnings
- Average available capital percentage
- Peak capital usage periods

---

## Conclusion

The current system has NO capital tracking or blocking mechanism. This creates risk of over-allocation when multiple pending orders exist or when new positions are sized without considering existing allocation.

**Recommended Action:**
1. Implement Phase 1 (Foundation) immediately
2. Deploy to production with `capital_tracking_enabled=false` initially
3. Monitor capital state via new API endpoint
4. Enable enforcement after 1-2 weeks of monitoring
5. Proceed with Phase 2 (Integration) based on feedback

**Impact:**
- ✅ Prevents accidental over-allocation
- ✅ Provides visibility into capital usage
- ✅ Better portfolio-level risk management
- ✅ Maintains backward compatibility
- ⚠️ Requires user to manage capital manually (cancel orders to free capital)

---

**Next Steps:**
1. Review this analysis with maintainer
2. Create GitHub issue from this document
3. Get approval for implementation approach
4. Begin Phase 1 development
