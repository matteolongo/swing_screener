# Phase 1: Move Financial Calculations to Backend

## 🎯 Objective

Move P&L and R-multiple calculations from UI to backend to establish **single source of truth** for financial formulas.

**Priority:** HIGH - Directly addresses user verification doubts from Degiro comparison.

**Effort:** 1-2 hours

**Files Changed:** 7 files (3 new, 4 modified)

---

## 📋 Current State

### **Problem:**
Financial calculations are duplicated in UI and backend:

**UI (TypeScript):**
- `web-ui/src/types/position.ts` - `calculatePnL()`, `calculatePnLPercent()`, `calculateRNow()`
- `web-ui/src/features/portfolio/metrics.ts` - `calcOpenRisk()`, `calcTotalPositionValue()`

**Backend (Python):**
- `src/swing_screener/backtest/simulator.py` - R-multiple logic (lines 122-129)
- `src/swing_screener/portfolio/state.py` - Initial risk tracking

**Issues:**
- ❌ Two places to maintain same formula
- ❌ UI calculations can't be verified against backend
- ❌ User doubts correctness when comparing with broker

---

## 🎯 Implementation Steps

### Step 1: Create Backend Metrics Module (20 min)

**File:** `src/swing_screener/portfolio/metrics.py`

```python
"""
Portfolio position metrics and calculations.
Authoritative source for P&L, R-multiples, and position values.
"""
from typing import Optional
from swing_screener.portfolio.state import Position


def calculate_pnl(
    entry_price: float,
    current_price: float,
    shares: int,
) -> float:
    """
    Calculate absolute profit/loss for a position.
    
    Args:
        entry_price: Entry price per share
        current_price: Current price per share
        shares: Number of shares held
        
    Returns:
        Absolute P&L in dollars
        
    Example:
        >>> calculate_pnl(entry_price=15.89, current_price=16.65, shares=6)
        4.56
    """
    return (current_price - entry_price) * shares


def calculate_pnl_percent(
    entry_price: float,
    current_price: float,
) -> float:
    """
    Calculate percentage profit/loss for a position.
    
    Args:
        entry_price: Entry price per share
        current_price: Current price per share
        
    Returns:
        P&L as percentage (e.g., 4.78 for 4.78%)
        
    Example:
        >>> calculate_pnl_percent(entry_price=15.89, current_price=16.65)
        4.78
    """
    if entry_price == 0:
        return 0.0
    return ((current_price - entry_price) / entry_price) * 100


def calculate_r_now(
    position: Position,
    current_price: float,
) -> float:
    """
    Calculate current R-multiple for an open position.
    
    R-multiple = (Current P&L) / (Initial Risk)
    
    Args:
        position: Position with entry_price, shares, initial_risk
        current_price: Current market price
        
    Returns:
        R-multiple (e.g., 1.5 means 1.5R profit)
        
    Example:
        >>> pos = Position(entry_price=15.89, shares=6, initial_risk=7.74, ...)
        >>> calculate_r_now(pos, current_price=16.65)
        0.59
    """
    if not position.initial_risk or position.initial_risk == 0:
        return 0.0
    
    pnl = calculate_pnl(position.entry_price, current_price, position.shares)
    return pnl / position.initial_risk


def calculate_total_position_value(
    entry_price: float,
    shares: int,
) -> float:
    """
    Calculate total position value (cost basis).
    
    Args:
        entry_price: Entry price per share
        shares: Number of shares
        
    Returns:
        Total position value in dollars
    """
    return entry_price * shares


def calculate_current_position_value(
    current_price: float,
    shares: int,
) -> float:
    """
    Calculate current market value of position.
    
    Args:
        current_price: Current market price per share
        shares: Number of shares
        
    Returns:
        Current position value in dollars
    """
    return current_price * shares


def calculate_per_share_risk(
    position: Position,
) -> float:
    """
    Calculate risk per share for a position.
    
    Uses initial_risk if available, otherwise calculates from entry-stop.
    
    Args:
        position: Position with initial_risk or entry_price/stop_price
        
    Returns:
        Risk per share in dollars
    """
    if position.initial_risk and position.initial_risk > 0:
        return position.initial_risk
    
    return position.entry_price - position.stop_price
```

**File:** `tests/unit/portfolio/test_metrics.py`

```python
"""Tests for portfolio metrics calculations."""
import pytest
from swing_screener.portfolio.state import Position
from swing_screener.portfolio.metrics import (
    calculate_pnl,
    calculate_pnl_percent,
    calculate_r_now,
    calculate_total_position_value,
    calculate_current_position_value,
    calculate_per_share_risk,
)


def test_calculate_pnl():
    """Test P&L calculation."""
    # Profitable position
    pnl = calculate_pnl(entry_price=15.89, current_price=16.65, shares=6)
    assert pnl == pytest.approx(4.56, abs=0.01)
    
    # Loss position
    pnl = calculate_pnl(entry_price=20.0, current_price=18.0, shares=10)
    assert pnl == pytest.approx(-20.0, abs=0.01)
    
    # Break-even
    pnl = calculate_pnl(entry_price=15.0, current_price=15.0, shares=5)
    assert pnl == 0.0


def test_calculate_pnl_percent():
    """Test P&L percentage calculation."""
    # 4.78% gain
    pct = calculate_pnl_percent(entry_price=15.89, current_price=16.65)
    assert pct == pytest.approx(4.78, abs=0.01)
    
    # 10% loss
    pct = calculate_pnl_percent(entry_price=20.0, current_price=18.0)
    assert pct == pytest.approx(-10.0, abs=0.01)
    
    # Zero entry price
    pct = calculate_pnl_percent(entry_price=0.0, current_price=10.0)
    assert pct == 0.0


def test_calculate_r_now():
    """Test R-multiple calculation."""
    pos = Position(
        ticker="VALE",
        status="open",
        entry_date="2025-01-15",
        entry_price=15.89,
        stop_price=14.60,
        shares=6,
        initial_risk=7.74,
    )
    
    # Profitable position
    r_now = calculate_r_now(pos, current_price=16.65)
    assert r_now == pytest.approx(0.59, abs=0.01)
    
    # At entry (0R)
    r_now = calculate_r_now(pos, current_price=15.89)
    assert r_now == 0.0
    
    # At stop (-1R)
    r_now = calculate_r_now(pos, current_price=14.60)
    assert r_now == pytest.approx(-1.0, abs=0.01)


def test_calculate_r_now_no_initial_risk():
    """Test R-multiple when initial_risk is missing."""
    pos = Position(
        ticker="TEST",
        status="open",
        entry_date="2025-01-15",
        entry_price=100.0,
        stop_price=95.0,
        shares=10,
        initial_risk=None,
    )
    
    r_now = calculate_r_now(pos, current_price=105.0)
    assert r_now == 0.0  # Returns 0 when no initial risk


def test_calculate_total_position_value():
    """Test position value calculation."""
    value = calculate_total_position_value(entry_price=15.89, shares=6)
    assert value == pytest.approx(95.34, abs=0.01)


def test_calculate_current_position_value():
    """Test current market value calculation."""
    value = calculate_current_position_value(current_price=16.65, shares=6)
    assert value == pytest.approx(99.90, abs=0.01)


def test_calculate_per_share_risk():
    """Test per-share risk calculation."""
    # With initial_risk
    pos = Position(
        ticker="TEST",
        status="open",
        entry_date="2025-01-15",
        entry_price=100.0,
        stop_price=95.0,
        shares=10,
        initial_risk=5.0,
    )
    risk = calculate_per_share_risk(pos)
    assert risk == 5.0
    
    # Without initial_risk, fallback to entry-stop
    pos2 = Position(
        ticker="TEST",
        status="open",
        entry_date="2025-01-15",
        entry_price=100.0,
        stop_price=95.0,
        shares=10,
        initial_risk=None,
    )
    risk2 = calculate_per_share_risk(pos2)
    assert risk2 == 5.0
```

---

### Step 2: Add API Response Models (10 min)

**File:** `api/models/portfolio.py`

Add new response models:

```python
from pydantic import BaseModel, Field


class PositionMetrics(BaseModel):
    """Calculated metrics for a position."""
    
    ticker: str = Field(..., description="Stock ticker symbol")
    pnl: float = Field(..., description="Absolute profit/loss in dollars")
    pnl_percent: float = Field(..., description="P&L as percentage")
    r_now: float = Field(..., description="Current R-multiple")
    entry_value: float = Field(..., description="Total entry value (shares × entry_price)")
    current_value: float = Field(..., description="Current market value (shares × current_price)")
    per_share_risk: float = Field(..., description="Risk per share in dollars")
    total_risk: float = Field(..., description="Total position risk (per_share_risk × shares)")


class PortfolioSummary(BaseModel):
    """Portfolio-level aggregations."""
    
    total_positions: int = Field(..., description="Number of open positions")
    total_value: float = Field(..., description="Total market value of all positions")
    total_cost_basis: float = Field(..., description="Total entry value of all positions")
    total_pnl: float = Field(..., description="Total unrealized P&L across all positions")
    total_pnl_percent: float = Field(..., description="Average P&L percentage")
    open_risk: float = Field(..., description="Total open risk (sum of all position risks)")
    open_risk_percent: float = Field(..., description="Open risk as % of account size")
    account_size: float = Field(..., description="Account size from strategy config")
    available_capital: float = Field(..., description="Account size - total value")
```

---

### Step 3: Add API Endpoints (30 min)

**File:** `api/routers/portfolio.py`

Add new endpoints:

```python
from api.models.portfolio import PositionMetrics, PortfolioSummary
from src.swing_screener.portfolio.metrics import (
    calculate_pnl,
    calculate_pnl_percent,
    calculate_r_now,
    calculate_total_position_value,
    calculate_current_position_value,
    calculate_per_share_risk,
)


@router.get("/positions/{position_id}/metrics", response_model=PositionMetrics)
async def get_position_metrics(
    position_id: str,
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> PositionMetrics:
    """
    Get calculated metrics for a specific position.
    
    Returns authoritative financial calculations including P&L, R-multiple, and values.
    """
    position = portfolio_service._positions_repo.get_position(position_id)
    if not position:
        raise HTTPException(status_code=404, detail=f"Position not found: {position_id}")
    
    ticker = position["ticker"]
    entry_price = position["entry_price"]
    stop_price = position["stop_price"]
    shares = position["shares"]
    initial_risk = position.get("initial_risk")
    
    # Get current price
    try:
        current_price = position.get("current_price")
        if not current_price:
            # Fetch latest price if not cached
            from src.swing_screener.utils.date_helpers import get_today_str
            ohlcv = portfolio_service._provider.fetch_ohlcv(
                [ticker],
                start_date=get_today_str(),
                end_date=get_today_str(),
            )
            if not ohlcv.empty:
                current_price = ohlcv[("Close", ticker)].iloc[-1]
            else:
                current_price = entry_price  # Fallback
    except Exception:
        current_price = entry_price  # Fallback on error
    
    # Create Position object for calculations
    from swing_screener.portfolio.state import Position
    pos = Position(
        ticker=ticker,
        status=position["status"],
        entry_date=position["entry_date"],
        entry_price=entry_price,
        stop_price=stop_price,
        shares=shares,
        initial_risk=initial_risk,
    )
    
    # Calculate metrics
    pnl = calculate_pnl(entry_price, current_price, shares)
    pnl_pct = calculate_pnl_percent(entry_price, current_price)
    r_now = calculate_r_now(pos, current_price)
    entry_value = calculate_total_position_value(entry_price, shares)
    current_value = calculate_current_position_value(current_price, shares)
    per_share_risk = calculate_per_share_risk(pos)
    total_risk = per_share_risk * shares
    
    return PositionMetrics(
        ticker=ticker,
        pnl=pnl,
        pnl_percent=pnl_pct,
        r_now=r_now,
        entry_value=entry_value,
        current_value=current_value,
        per_share_risk=per_share_risk,
        total_risk=total_risk,
    )


@router.get("/portfolio/summary", response_model=PortfolioSummary)
async def get_portfolio_summary(
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
    config_repo: ConfigRepository = Depends(get_config_repository),
) -> PortfolioSummary:
    """
    Get portfolio-level summary with aggregated metrics.
    
    Returns total values, P&L, and risk across all open positions.
    """
    positions, _ = portfolio_service._positions_repo.list_positions(status="open")
    
    if not positions:
        config = config_repo.get()
        account_size = config.get("risk", {}).get("account_size", 0)
        return PortfolioSummary(
            total_positions=0,
            total_value=0.0,
            total_cost_basis=0.0,
            total_pnl=0.0,
            total_pnl_percent=0.0,
            open_risk=0.0,
            open_risk_percent=0.0,
            account_size=account_size,
            available_capital=account_size,
        )
    
    # Get current prices for all positions
    tickers = [p["ticker"] for p in positions]
    from src.swing_screener.utils.date_helpers import get_today_str
    
    try:
        ohlcv = portfolio_service._provider.fetch_ohlcv(
            tickers,
            start_date=get_today_str(),
            end_date=get_today_str(),
        )
        current_prices = {
            ticker: ohlcv[("Close", ticker)].iloc[-1]
            for ticker in tickers
            if ("Close", ticker) in ohlcv.columns
        }
    except Exception:
        current_prices = {}
    
    # Calculate aggregates
    total_value = 0.0
    total_cost_basis = 0.0
    total_pnl = 0.0
    open_risk = 0.0
    
    for p in positions:
        ticker = p["ticker"]
        entry_price = p["entry_price"]
        shares = p["shares"]
        current_price = current_prices.get(ticker, p.get("current_price", entry_price))
        
        # Create Position object
        from swing_screener.portfolio.state import Position
        pos = Position(
            ticker=ticker,
            status=p["status"],
            entry_date=p["entry_date"],
            entry_price=entry_price,
            stop_price=p["stop_price"],
            shares=shares,
            initial_risk=p.get("initial_risk"),
        )
        
        total_cost_basis += calculate_total_position_value(entry_price, shares)
        total_value += calculate_current_position_value(current_price, shares)
        total_pnl += calculate_pnl(entry_price, current_price, shares)
        
        per_share_risk = calculate_per_share_risk(pos)
        if per_share_risk > 0:
            open_risk += per_share_risk * shares
    
    config = config_repo.get()
    account_size = config.get("risk", {}).get("account_size", 0)
    
    total_pnl_pct = (
        (total_pnl / total_cost_basis * 100) if total_cost_basis > 0 else 0.0
    )
    open_risk_pct = (open_risk / account_size * 100) if account_size > 0 else 0.0
    available_capital = account_size - total_value
    
    return PortfolioSummary(
        total_positions=len(positions),
        total_value=total_value,
        total_cost_basis=total_cost_basis,
        total_pnl=total_pnl,
        total_pnl_percent=total_pnl_pct,
        open_risk=open_risk,
        open_risk_percent=open_risk_pct,
        account_size=account_size,
        available_capital=available_capital,
    )
```

---

### Step 4: Update UI to Use Backend Calculations (20 min)

**File:** `web-ui/src/features/portfolio/api.ts`

Add new API calls:

```typescript
import { apiClient } from '@/lib/api';

export interface PositionMetrics {
  ticker: string;
  pnl: number;
  pnlPercent: number;
  rNow: number;
  entryValue: number;
  currentValue: number;
  perShareRisk: number;
  totalRisk: number;
}

export interface PortfolioSummary {
  totalPositions: number;
  totalValue: number;
  totalCostBasis: number;
  totalPnl: number;
  totalPnlPercent: number;
  openRisk: number;
  openRiskPercent: number;
  accountSize: number;
  availableCapital: number;
}

export async function fetchPositionMetrics(positionId: string): Promise<PositionMetrics> {
  const response = await apiClient.get(`/api/positions/${positionId}/metrics`);
  return transformPositionMetrics(response.data);
}

export async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
  const response = await apiClient.get('/api/portfolio/summary');
  return transformPortfolioSummary(response.data);
}

function transformPositionMetrics(data: any): PositionMetrics {
  return {
    ticker: data.ticker,
    pnl: data.pnl,
    pnlPercent: data.pnl_percent,
    rNow: data.r_now,
    entryValue: data.entry_value,
    currentValue: data.current_value,
    perShareRisk: data.per_share_risk,
    totalRisk: data.total_risk,
  };
}

function transformPortfolioSummary(data: any): PortfolioSummary {
  return {
    totalPositions: data.total_positions,
    totalValue: data.total_value,
    totalCostBasis: data.total_cost_basis,
    totalPnl: data.total_pnl,
    totalPnlPercent: data.total_pnl_percent,
    openRisk: data.open_risk,
    openRiskPercent: data.open_risk_percent,
    accountSize: data.account_size,
    availableCapital: data.available_capital,
  };
}
```

**File:** `web-ui/src/features/portfolio/hooks.ts`

Add new hooks:

```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchPositionMetrics, fetchPortfolioSummary } from './api';

export function usePositionMetrics(positionId: string | undefined) {
  return useQuery({
    queryKey: ['position-metrics', positionId],
    queryFn: () => fetchPositionMetrics(positionId!),
    enabled: !!positionId,
    staleTime: 30000, // 30 seconds
  });
}

export function usePortfolioSummary() {
  return useQuery({
    queryKey: ['portfolio-summary'],
    queryFn: fetchPortfolioSummary,
    staleTime: 30000, // 30 seconds
  });
}
```

---

### Step 5: Update UI Components (20 min)

**File:** `web-ui/src/types/position.ts`

Comment out old calculation functions and add deprecation notice:

```typescript
/**
 * @deprecated Use backend /api/positions/{id}/metrics instead
 * This function is kept temporarily for backward compatibility
 * but will be removed in next release.
 */
export function calculatePnL(position: Position, currentPrice?: number): number {
  const exitOrCurrent = position.exitPrice ?? currentPrice ?? position.currentPrice ?? position.entryPrice;
  return (exitOrCurrent - position.entryPrice) * position.shares;
}

/**
 * @deprecated Use backend /api/positions/{id}/metrics instead
 */
export function calculatePnLPercent(position: Position, currentPrice?: number): number {
  const exitOrCurrent = position.exitPrice ?? currentPrice ?? position.currentPrice ?? position.entryPrice;
  return ((exitOrCurrent - position.entryPrice) / position.entryPrice) * 100;
}

/**
 * @deprecated Use backend /api/positions/{id}/metrics instead
 */
export function calculateRNow(position: Position, currentPrice: number): number {
  if (!position.initialRisk || position.initialRisk === 0) return 0;
  const profitLoss = (currentPrice - position.entryPrice) * position.shares;
  return profitLoss / position.initialRisk;
}
```

**File:** `web-ui/src/pages/Dashboard.tsx`

Replace local calculations with backend data:

```typescript
// OLD:
// const totalPnL = positions.reduce((sum: number, pos: Position) => {
//   return sum + calculatePnL(pos);
// }, 0);
// const openRisk = calcOpenRisk(positions);
// const totalPositionValue = calcTotalPositionValue(positions);

// NEW:
const { data: portfolioSummary } = usePortfolioSummary();

const totalPnL = portfolioSummary?.totalPnl ?? 0;
const openRisk = portfolioSummary?.openRisk ?? 0;
const totalPositionValue = portfolioSummary?.totalValue ?? 0;
const availableToDeploy = portfolioSummary?.availableCapital ?? 0;
```

---

## ✅ Testing & Validation

### 1. Run Backend Tests

```bash
# Test the new metrics module
pytest tests/unit/portfolio/test_metrics.py -v

# Test full backend suite
pytest tests/ -v
```

**Expected:** All tests pass, including 13 new tests for metrics.

---

### 2. Test API Endpoints

```bash
# Start API
cd api && uvicorn main:app --reload

# Test position metrics endpoint
curl http://localhost:8000/api/positions/{position_id}/metrics

# Test portfolio summary endpoint
curl http://localhost:8000/api/portfolio/summary
```

**Expected:** Both endpoints return JSON with calculations.

---

### 3. Run Frontend Tests

```bash
cd web-ui && npm test -- --run
```

**Expected:** All 318 tests still pass.

---

### 4. Manual UI Verification

1. Open Dashboard page
2. Check that P&L values match backend
3. Compare with Degiro values (should be same for USD, EUR-converted for EUR)
4. Open Positions page
5. Hover over values - tooltip should show calculations
6. Verify inline "shares × price" matches displayed value

---

## 📊 Success Criteria

- ✅ Backend module `portfolio/metrics.py` created with 6 functions
- ✅ 13 new backend tests passing
- ✅ 2 new API endpoints working
- ✅ UI fetches calculations from backend
- ✅ Old UI calculation functions deprecated (not removed yet)
- ✅ Dashboard shows values from `/api/portfolio/summary`
- ✅ All 318 frontend tests still passing
- ✅ All 434+ backend tests passing

---

## 🚀 Deployment Steps

1. Merge to main branch
2. Backend automatically deploys (Docker + FastAPI)
3. Frontend rebuild happens on next deploy
4. Verify in production that Dashboard loads summary
5. Monitor API logs for `/portfolio/summary` calls

---

## 📝 Commit Message

```
feat: Move financial calculations to backend (Phase 1)

Establishes single source of truth for P&L, R-multiples, and portfolio metrics.

**Backend:**
- Created `src/swing_screener/portfolio/metrics.py` with 6 calculation functions
- Added 13 comprehensive tests for all calculations
- Added `/api/positions/{id}/metrics` endpoint
- Added `/api/portfolio/summary` endpoint for aggregations

**Frontend:**
- Added hooks: `usePositionMetrics()`, `usePortfolioSummary()`
- Dashboard now fetches summary from backend
- Deprecated UI calculation functions (kept for compatibility)
- All 318 tests still passing

**Impact:**
- Single source of truth for financial formulas
- Backend calculations are authoritative
- UI just displays values (no local computation)
- Eliminates user verification doubts

**Closes:** Issue about Degiro value discrepancies

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## 🔄 Rollback Plan

If issues arise:

1. UI still has old calculation functions (deprecated but working)
2. Can temporarily revert to client-side calculations
3. Backend endpoints are additive (no breaking changes)
4. To rollback: `git revert <commit-hash>`

---

## 📚 Next Steps

After Phase 1 is complete and tested:

- [ ] **Phase 2:** Move strategy validation to backend (2-3 hours)
- [ ] **Phase 3:** Additional portfolio aggregations (1-2 hours)
- [ ] **Cleanup:** Remove deprecated UI calculation functions
