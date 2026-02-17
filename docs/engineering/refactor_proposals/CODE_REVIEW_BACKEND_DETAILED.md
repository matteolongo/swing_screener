# Backend Code Review - Detailed Analysis
**Date:** 2026-02-15  
**Status Update:** 2026-02-16  
**Scope:** Python backend in `src/swing_screener/` and `api/`

---

## ⚠️ STATUS UPDATE (2026-02-16)

**Progress:**
- ✅ **Fixed:** Issue #6 (Dependency Injection for MarketDataProvider)
- ❌ **Critical Unfixed:** Issues #1, #2, #5 (Config state, file locking, hardcoded dates)
- ⚠️ **URGENT:** Issue #5 (Hardcoded dates) will break application in ~2 weeks

**Priority:**
1. **THIS WEEK:** Fix hardcoded dates (3h)
2. **Next:** Fix file locking (1h)
3. **Then:** Fix global config (6h)

---

## 🔴 CRITICAL ISSUES

### 1. Global Mutable State in Config Router
**File:** `api/routers/config.py:44`  
**Severity:** CRITICAL  
**Impact:** Thread-safety issues, impossible to test properly

**Current Code:**
```python
current_config = load_config()  # Global mutable variable!

@router.get("/config")
async def get_config():
    return current_config

@router.put("/config")
async def update_config(config: dict):
    global current_config
    current_config = config
    save_config(config)
    return current_config
```

**Problems:**
1. **Race conditions:** Multiple threads can read/write simultaneously
2. **Testing nightmare:** Cannot mock or reset state between tests
3. **Circular dependencies:** Services import `api.routers.config` to access global config
4. **No isolation:** Changes in one test affect other tests

**Solution:**
```python
# Create api/repositories/config_repository.py
from threading import Lock
from pathlib import Path
from typing import Optional

class ConfigRepository:
    """Thread-safe configuration repository."""
    
    def __init__(self, config_path: str = "config.json"):
        self._config_path = Path(config_path)
        self._lock = Lock()
        self._cache: Optional[dict] = None
    
    def get(self) -> dict:
        """Get current configuration."""
        with self._lock:
            if self._cache is None:
                self._cache = self._load()
            return self._cache.copy()
    
    def update(self, config: dict) -> dict:
        """Update configuration atomically."""
        with self._lock:
            self._save(config)
            self._cache = config.copy()
            return self._cache.copy()
    
    def _load(self) -> dict:
        from swing_screener.config import load_config
        return load_config(str(self._config_path))
    
    def _save(self, config: dict) -> None:
        from swing_screener.config import save_config
        save_config(config, str(self._config_path))

# Update api/routers/config.py
from fastapi import Depends
from api.repositories.config_repository import ConfigRepository

def get_config_repository() -> ConfigRepository:
    return ConfigRepository()

@router.get("/config")
async def get_config(
    repo: ConfigRepository = Depends(get_config_repository)
) -> dict:
    return repo.get()

@router.put("/config")
async def update_config(
    config: dict,
    repo: ConfigRepository = Depends(get_config_repository)
) -> dict:
    return repo.update(config)
```

**Migration Steps:**
1. Create `ConfigRepository` class
2. Add dependency injection to all routers
3. Update services to accept config as parameter instead of importing global
4. Remove global `current_config` variable
5. Update tests to use repository

**Estimated Effort:** 6 hours  
**Status:** ❌ **UNFIXED** (Verified 2026-02-16 - global variable still present)

---

### 2. Race Condition in Intelligence Storage
**File:** `src/swing_screener/intelligence/storage.py:143-148`  
**Severity:** CRITICAL  
**Impact:** Data corruption, lost updates

**Current Code:**
```python
def save_symbol_state(symbol: str, state: dict) -> None:
    """Save state for a symbol."""
    # Read entire file
    all_states = load_all_symbol_states()
    
    # Update in memory
    all_states[symbol] = state
    
    # Write back (NO LOCKING!)
    with open('data/symbol_state.json', 'w') as f:
        json.dump(all_states, f, indent=2)
```

**Race Condition Scenario:**
```
Time  Thread A (API)              Thread B (CLI)
----  ------------------------    ------------------------
T1    Read file: {AAPL: {...}}    
T2                                Read file: {AAPL: {...}}
T3    Update AAPL in memory
T4                                Update MSFT in memory
T5    Write file: {AAPL: new}     
T6                                Write file: {MSFT: new}  ← OVERWRITES T5!
```

Result: Thread A's update to AAPL is lost!

**Solution:**
```python
# The project already has file locking utilities!
from swing_screener.utils.file_lock import locked_write_json_cli, locked_read_json_cli

def save_symbol_state(symbol: str, state: dict) -> None:
    """Save state for a symbol (thread-safe)."""
    filepath = Path('data/symbol_state.json')
    
    # Read with lock
    all_states = locked_read_json_cli(filepath, default={})
    
    # Update
    all_states[symbol] = state
    
    # Write with lock
    locked_write_json_cli(all_states, filepath)

def load_symbol_state(symbol: str) -> Optional[dict]:
    """Load state for a symbol (thread-safe)."""
    filepath = Path('data/symbol_state.json')
    all_states = locked_read_json_cli(filepath, default={})
    return all_states.get(symbol)
```

**Files to Update:**
- `src/swing_screener/intelligence/storage.py` (main fix)
- `src/swing_screener/intelligence/pipeline.py` (uses storage)
- `api/services/intelligence_service.py` (API access)

**Estimated Effort:** 1 hour  
**Status:** ❌ **UNFIXED** (Verified 2026-02-16 - no file locking present)

---

## 🟠 HIGH PRIORITY ISSUES

### 3. Hardcoded Dates Will Break in 2026
**Files:** 7 locations verified (2026-02-16)
- `api/services/portfolio_service.py`
- `api/services/screener_service.py`
- `src/swing_screener/strategies/momentum.py`
- `src/swing_screener/strategies/trend.py`
- `src/swing_screener/strategies/entries.py`
- `src/swing_screener/backtesting/simulator.py`
- `src/swing_screener/backtesting/state.py`

**Severity:** HIGH → **CRITICAL** (Breaks in ~2 weeks)  
**Status:** ❌ **UNFIXED - URGENT**

**Current Code:**
```python
START_DATE = "2025-01-01"  # ❌ Hard-coded year
```

**Problem:** Application will break on 2026-01-02 when this date becomes invalid.

**Solution:**
```python
# Add to config.json
{
  "backtest": {
    "default_lookback_years": 1,
    "max_lookback_years": 5
  }
}

# Create utils/date_helpers.py
from datetime import datetime, timedelta
from typing import Optional

def get_lookback_start_date(
    years: int = 1,
    from_date: Optional[datetime] = None
) -> str:
    """Get start date for lookback period.
    
    Args:
        years: Number of years to look back
        from_date: Reference date (defaults to today)
    
    Returns:
        ISO format date string (YYYY-MM-DD)
    """
    if from_date is None:
        from_date = datetime.now()
    
    start_date = from_date - timedelta(days=years * 365.25)
    return start_date.strftime("%Y-%m-%d")

def get_default_backtest_start() -> str:
    """Get default start date for backtests."""
    return get_lookback_start_date(years=1)

# Update all services
from swing_screener.utils.date_helpers import get_default_backtest_start

class BacktestService:
    def run_backtest(
        self,
        start_date: Optional[str] = None,
        ...
    ):
        if start_date is None:
            start_date = get_default_backtest_start()
        ...
```

**Files to Update:** 7 locations (verified 2026-02-16)
- `api/services/portfolio_service.py`
- `api/services/screener_service.py`
- `src/swing_screener/strategies/momentum.py`
- `src/swing_screener/strategies/trend.py`
- `src/swing_screener/strategies/entries.py`
- `src/swing_screener/backtesting/simulator.py`
- `src/swing_screener/backtesting/state.py`

**Estimated Effort:** 2-3 hours (increased due to more locations)  
**Status:** ❌ **UNFIXED - BREAKS ON 2026-01-02** (~2 weeks)

---

### 4. Service Constructors Create Providers (Violates DI)
**Files:**
- `api/services/screener_service.py:15`
- `api/services/daily_review_service.py:12`
- `api/services/backtest_service.py:18`
- 5+ other services

**Status:** ✅ **FIXED** (Verified 2026-02-16)

**Original Problem:**
```python
class ScreenerService:
    def __init__(self):
        # ❌ Creates dependency internally
        self.provider = create_market_data_provider()
```

**Current Implementation:**
```python
class ScreenerService:
    def __init__(self, provider: MarketDataProvider):
        # ✅ Dependency injected!
        self.provider = provider
```

**Impact:** Services are now properly mockable in tests. This issue has been resolved.
4. Violates Dependency Inversion Principle

**Solution:**
```python
# Update service to accept provider
class ScreenerService:
    def __init__(self, provider: MarketDataProvider):
        self.provider = provider

# Create dependency in api/dependencies.py
from swing_screener.data.providers.factory import create_market_data_provider
from swing_screener.data.providers.base import MarketDataProvider

def get_market_data_provider() -> MarketDataProvider:
    """Dependency injection for market data provider."""
    return create_market_data_provider()

# Update router
from api.dependencies import get_market_data_provider
from api.services.screener_service import ScreenerService

def get_screener_service(
    provider: MarketDataProvider = Depends(get_market_data_provider)
) -> ScreenerService:
    return ScreenerService(provider)

@router.post("/screener/run")
async def run_screener(
    request: ScreenerRequest,
    service: ScreenerService = Depends(get_screener_service)
):
    return service.run(request)
```

**Testing Benefits:**
```python
# Now we can easily mock in tests!
def test_screener_service():
    mock_provider = MockMarketDataProvider()
    service = ScreenerService(mock_provider)
    
    result = service.run(...)
    assert mock_provider.fetch_called_with(...)
```

**Files to Update:**
- ~~All 8 services that create providers~~ ✅ **COMPLETED**
- ~~Create `api/dependencies.py` if it doesn't exist~~ ✅ **COMPLETED**
- ~~Update all routers to use DI~~ ✅ **COMPLETED**
- ~~Update tests to use mock providers~~ ✅ **COMPLETED**

**Estimated Effort:** ~~8 hours~~ ✅ **COMPLETED (0h remaining)**

---

### 5. Duplicate Helper Functions
**Severity:** HIGH  
**Impact:** ~300 lines of duplicated code  
**Status:** ❌ **UNFIXED** (Verified 2026-02-16)

**Duplicated Functions Found:**

**Duplicated Functions Found (Verified 2026-02-16):**

#### `_get_close_matrix()` - Found in 2 files (CONFIRMED)
```python
# Exact duplicates in:
# - src/swing_screener/strategies/momentum.py
# - src/swing_screener/strategies/trend.py

def _get_close_matrix(df: pd.DataFrame) -> pd.DataFrame:
    if isinstance(df.columns, pd.MultiIndex):
        return df.xs('Close', axis=1, level=0)
    return df['Close']
```

#### `_to_iso()` - Found in 2+ files (CONFIRMED)
```python
# Duplicated in:
# - api/services/screener_service.py
# - api/services/portfolio_service.py

def _to_iso(dt) -> str:
    if isinstance(dt, str):
        return dt
    return dt.strftime("%Y-%m-%d")
```

#### `_sma()` - Needs further investigation

**Solution - Create Utility Modules:**

```python
# Create src/swing_screener/utils/dataframe_helpers.py
from datetime import datetime
from typing import Union
import pandas as pd

def to_iso_date(dt: Union[str, datetime, pd.Timestamp]) -> str:
    """Convert any date type to ISO format (YYYY-MM-DD).
    
    Args:
        dt: Date as string, datetime, or pandas Timestamp
        
    Returns:
        ISO formatted date string
    """
    if isinstance(dt, str):
        return dt
    return dt.strftime("%Y-%m-%d")

def get_close_prices(df: pd.DataFrame) -> pd.DataFrame:
    """Extract close prices from OHLCV DataFrame.
    
    Handles both MultiIndex (field, ticker) and simple columns.
    
    Args:
        df: OHLCV DataFrame
        
    Returns:
        DataFrame with only close prices
    """
    if isinstance(df.columns, pd.MultiIndex):
        return df.xs('Close', axis=1, level=0)
    return df['Close'] if 'Close' in df.columns else df

def get_field_matrix(df: pd.DataFrame, field: str) -> pd.DataFrame:
    """Extract any field from OHLCV MultiIndex DataFrame.
    
    Args:
        df: OHLCV DataFrame with MultiIndex columns
        field: Field name (Open, High, Low, Close, Volume)
        
    Returns:
        DataFrame with only the specified field
    """
    if isinstance(df.columns, pd.MultiIndex):
        return df.xs(field, axis=1, level=0)
    return df[field] if field in df.columns else df

# Create src/swing_screener/utils/indicators.py
import pandas as pd

def simple_moving_average(series: pd.Series, period: int) -> pd.Series:
    """Calculate simple moving average.
    
    Args:
        series: Input price series
        period: Number of periods
        
    Returns:
        SMA series
    """
    return series.rolling(window=period).mean()

def exponential_moving_average(series: pd.Series, period: int) -> pd.Series:
    """Calculate exponential moving average.
    
    Args:
        series: Input price series
        period: Number of periods
        
    Returns:
        EMA series
    """
    return series.ewm(span=period, adjust=False).mean()
```

**Migration Plan:**
1. Create utility modules
2. Add tests for utilities
3. Replace usage in one file at a time
4. Verify tests still pass
5. Remove old duplicate code

**Files to Update:** 20+ files

**Estimated Effort:** 6 hours

---

### 6. Circular Import for Config Access
**Files:** Multiple services import `api.routers.config`  
**Severity:** HIGH

**Current Anti-Pattern:**
```python
# In src/swing_screener/signals/entries.py (domain layer)
from api.routers.config import current_config  # ❌ Domain importing API!

def generate_signals(...):
    risk_config = current_config['risk']
    ...
```

**Problems:**
1. Domain layer depends on API layer (violates layering)
2. Breaks when running CLI without API server
3. Makes testing difficult
4. Creates circular dependency graph

**Solution (After fixing Issue #1):**
```python
# Pass config as parameter
def generate_signals(
    data: pd.DataFrame,
    risk_config: dict,
    ...
):
    # Use risk_config parameter
    ...

# In service layer
class SignalService:
    def __init__(self, config_repo: ConfigRepository):
        self.config_repo = config_repo
    
    def generate(self, ...):
        config = self.config_repo.get()
        return generate_signals(
            data,
            risk_config=config['risk'],
            ...
        )
```

**Estimated Effort:** 4 hours (after Issue #1 is fixed)

---

## 🟡 MEDIUM PRIORITY ISSUES

### 7. God Method - `update_position_stop()`
**File:** `api/services/position_service.py:112-240`  
**Severity:** MEDIUM  
**Lines:** 128 lines

**Responsibilities (5!):**
1. Load position from repository
2. Fetch current market price
3. Calculate R-multiples
4. Validate stop rules
5. Save updated position

**Recommendation:**
```python
# Break into smaller methods
class PositionService:
    def update_position_stop(
        self,
        position_id: str,
        new_stop: float,
        reason: str
    ) -> dict:
        position = self._load_position(position_id)
        current_price = self._fetch_current_price(position.ticker)
        
        self._validate_stop_update(position, new_stop, current_price)
        
        updated_position = self._apply_stop_update(
            position, new_stop, reason
        )
        
        return self._save_position(updated_position)
    
    def _load_position(self, position_id: str) -> Position:
        """Load and validate position exists."""
        ...
    
    def _fetch_current_price(self, ticker: str) -> float:
        """Fetch latest market price."""
        ...
    
    def _validate_stop_update(
        self,
        position: Position,
        new_stop: float,
        current_price: float
    ) -> None:
        """Validate stop update rules."""
        ...
    
    def _apply_stop_update(
        self,
        position: Position,
        new_stop: float,
        reason: str
    ) -> Position:
        """Apply stop update and recalculate metrics."""
        ...
    
    def _save_position(self, position: Position) -> dict:
        """Save position and return API response."""
        ...
```

**Estimated Effort:** 3 hours

---

### 8. Missing Input Validation
**File:** `api/services/order_service.py:45`  
**Severity:** MEDIUM

**Current Code:**
```python
def create_order(self, request: CreateOrderRequest) -> dict:
    order = {
        'ticker': request.ticker,  # ❌ No validation!
        'quantity': request.quantity,
        ...
    }
```

**Add Validation:**
```python
from swing_screener.data.universe import is_valid_ticker

def create_order(self, request: CreateOrderRequest) -> dict:
    # Validate ticker
    if not is_valid_ticker(request.ticker):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid ticker symbol: {request.ticker}"
        )
    
    # Validate quantity
    if request.quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity must be positive"
        )
    
    # Validate prices
    if request.limit_price and request.limit_price <= 0:
        raise HTTPException(
            status_code=400,
            detail="Limit price must be positive"
        )
    
    ...
```

**Estimated Effort:** 2 hours

---

### 9-16. Additional Medium Priority Issues

*See full report for details on:*
- File lock coupling (utils using HTTPException)
- Two file lock implementations
- Three position representations
- Repeated OHLCV patterns
- Inefficient DataFrame merging
- Unnecessary data fetching
- Inconsistent error handling

---

## 🟢 LOW PRIORITY ISSUES

### 17. Inconsistent Logging Levels
**Severity:** LOW

**Current:** Mix of `warning()`, `error()`, `exception()` for similar cases

**Recommendation:**
```python
# Establish logging guidelines
# - DEBUG: Detailed debugging info
# - INFO: Normal operations
# - WARNING: Recoverable issues
# - ERROR: Operation failed but app continues
# - CRITICAL: App-level failures

# Example
try:
    data = fetch_market_data(ticker)
except ProviderError as e:
    logger.warning(f"Provider failed for {ticker}, trying fallback")
    data = fetch_from_fallback(ticker)
except Exception as e:
    logger.error(f"Failed to fetch {ticker}", exc_info=True)
    raise
```

---

### 18. Magic Numbers
**Severity:** LOW

**Examples:**
```python
if atr_ratio > 1.1:  # What is 1.1?
if len(candidates) > 200:  # Why 200?
```

**Recommendation:**
```python
# Add to config or constants
ATR_VOLATILITY_THRESHOLD = 1.1
MAX_SCREENER_CANDIDATES = 200

if atr_ratio > ATR_VOLATILITY_THRESHOLD:
    ...
```

---

## 📊 TESTING IMPROVEMENTS

### Current State
- Basic pytest coverage exists
- Some services hard to test due to tight coupling
- Missing integration tests for workflows

### Needed Improvements

#### 1. Service Integration Tests
```python
# tests/integration/test_screener_workflow.py
def test_full_screener_workflow(tmp_path):
    """Test complete screener → candidates → order flow."""
    # Setup
    provider = MockMarketDataProvider()
    service = ScreenerService(provider)
    
    # Run screener
    result = service.run_screener(...)
    assert len(result.candidates) > 0
    
    # Create order from candidate
    order_service = OrderService()
    order = order_service.create_from_candidate(result.candidates[0])
    assert order['ticker'] == result.candidates[0].ticker
```

#### 2. Repository Tests
```python
# tests/unit/repositories/test_config_repository.py
def test_config_repository_thread_safety():
    """Ensure concurrent access is safe."""
    repo = ConfigRepository()
    
    def update_worker(value: int):
        config = repo.get()
        config['test_value'] = value
        repo.update(config)
    
    threads = [Thread(target=update_worker, args=(i,)) for i in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    
    # Should not crash or corrupt data
    final = repo.get()
    assert 'test_value' in final
```

---

## 🎯 IMPLEMENTATION PRIORITY

### Week 1: Critical Fixes
1. ConfigRepository + DI (6h)
2. Intelligence storage locking (1h)
3. Hardcoded dates (2h)

### Week 2: High Priority
4. Provider DI (8h)
5. Consolidate helpers (6h)
6. Break circular imports (4h)

### Week 3: Medium Priority
7. Refactor God methods (8h)
8. Add validation (4h)
9. Unify representations (6h)

---

## 📝 NOTES FOR IMPLEMENTATION

### Before Starting
- [ ] Create feature branch: `refactor/code-review-fixes`
- [ ] Ensure all tests pass: `pytest`
- [ ] Backup `data/` folder
- [ ] Review this document with team

### During Implementation
- [ ] Fix one issue at a time
- [ ] Run tests after each fix
- [ ] Update documentation as needed
- [ ] Add new tests for refactored code

### After Completion
- [ ] Full test suite passes
- [ ] Manual testing of critical paths
- [ ] Update CHANGELOG.md
- [ ] Create PR for review

---

**Questions or need clarification? Add comments to this document.**
