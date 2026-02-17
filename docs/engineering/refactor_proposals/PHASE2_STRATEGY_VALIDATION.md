# Phase 2: Move Strategy Validation to Backend

## 🎯 Objective

Move strategy validation rules and safety scoring from UI to backend to ensure **consistent validation** across all strategy operations.

**Priority:** HIGH - Business rules should be server-side

**Effort:** 2-3 hours

**Files Changed:** 9 files (4 new, 5 modified)

---

## 📋 Current State

### **Problem:**
Strategy validation logic lives entirely in UI:

**UI (TypeScript):**
- `web-ui/src/utils/strategySafety.ts` (200 lines)
  - 6 parameter validation functions
  - `evaluateStrategy()` - applies all rules
  - `calculateSafetyScore()` - scores 0-100
  - `getSafetyLevel()` - categorizes risk

**Backend (Python):**
- No validation logic!
- Strategies can be saved with dangerous parameters
- No server-side safety checks

**Issues:**
- ❌ Business rules in presentation layer
- ❌ Backend can't validate on save
- ❌ Rules could diverge between UI and backend
- ❌ No protection against API misuse

---

## 🎯 Implementation Steps

### Step 1: Create Backend Validation Module (40 min)

**File:** `src/swing_screener/strategies/validation.py`

```python
"""
Strategy parameter validation and safety scoring.
Provides behavioral warnings for trading strategy configurations.
"""
from typing import Literal, List, Tuple
from dataclasses import dataclass
from swing_screener.reporting.config import StrategyConfig


@dataclass
class ValidationWarning:
    """A validation warning for a strategy parameter."""
    
    parameter: str
    level: Literal['danger', 'warning', 'info']
    message: str
    
    def to_dict(self) -> dict:
        """Convert to dict for JSON serialization."""
        return {
            'parameter': self.parameter,
            'level': self.level,
            'message': self.message,
        }


def evaluate_breakout_lookback(value: int) -> ValidationWarning | None:
    """
    Evaluate breakout lookback parameter.
    
    Args:
        value: Breakout lookback period in days
        
    Returns:
        Warning if value is concerning, None otherwise
    """
    if value < 20:
        return ValidationWarning(
            parameter='breakoutLookback',
            level='danger',
            message='Breakout Lookback below 20 behaves more like day trading than swing trading.',
        )
    if value < 40:
        return ValidationWarning(
            parameter='breakoutLookback',
            level='warning',
            message='Lower lookback periods increase signal frequency but may include more false breakouts.',
        )
    return None


def evaluate_minimum_rr(value: float) -> ValidationWarning | None:
    """
    Evaluate minimum risk/reward ratio parameter.
    
    Args:
        value: Minimum R/R ratio
        
    Returns:
        Warning if value is concerning, None otherwise
    """
    if value < 1.5:
        return ValidationWarning(
            parameter='minimumRr',
            level='danger',
            message='Minimum R/R under 1.5 makes profitability statistically harder. Consider raising to 2 or higher.',
        )
    if value < 2.0:
        return ValidationWarning(
            parameter='minimumRr',
            level='warning',
            message='R/R below 2 requires a higher win rate to be profitable. Most professionals target 2:1 or better.',
        )
    return None


def evaluate_max_atr_pct(value: float) -> ValidationWarning | None:
    """
    Evaluate maximum ATR percentage parameter.
    
    Args:
        value: Max ATR as percentage (e.g., 15 for 15%)
        
    Returns:
        Warning if value is concerning, None otherwise
    """
    if value > 25:
        return ValidationWarning(
            parameter='maxAtrPct',
            level='danger',
            message='Max ATR above 25% indicates extremely volatile stocks — beginners often struggle managing risk at this level.',
        )
    if value > 18:
        return ValidationWarning(
            parameter='maxAtrPct',
            level='warning',
            message='Higher volatility means larger stop distances and more emotional pressure. Ensure your risk management is solid.',
        )
    return None


def evaluate_pullback_ma(value: int) -> ValidationWarning | None:
    """
    Evaluate pullback moving average parameter.
    
    Args:
        value: Pullback MA period in days
        
    Returns:
        Warning if value is concerning, None otherwise
    """
    if value < 10:
        return ValidationWarning(
            parameter='pullbackMa',
            level='warning',
            message='Very short pullback periods may lead to entries on minor retracements that fail.',
        )
    if value > 50:
        return ValidationWarning(
            parameter='pullbackMa',
            level='info',
            message='Longer pullback periods are more conservative but may miss faster-moving opportunities.',
        )
    return None


def evaluate_max_holding_days(value: int) -> ValidationWarning | None:
    """
    Evaluate maximum holding days parameter.
    
    Args:
        value: Max holding period in days
        
    Returns:
        Warning if value is concerning, None otherwise
    """
    if value < 5:
        return ValidationWarning(
            parameter='maxHoldingDays',
            level='warning',
            message='Very short holding periods may not give momentum enough time to develop.',
        )
    if value > 30:
        return ValidationWarning(
            parameter='maxHoldingDays',
            level='info',
            message='Longer holding periods can tie up capital in stagnant trades. Monitor performance closely.',
        )
    return None


def evaluate_risk_per_trade(value: float) -> ValidationWarning | None:
    """
    Evaluate risk per trade parameter.
    
    Args:
        value: Risk per trade as percentage (e.g., 2 for 2%)
        
    Returns:
        Warning if value is concerning, None otherwise
    """
    if value > 3:
        return ValidationWarning(
            parameter='riskPerTrade',
            level='danger',
            message='Risking more than 3% per trade significantly increases the risk of large drawdowns.',
        )
    if value > 2:
        return ValidationWarning(
            parameter='riskPerTrade',
            level='warning',
            message='Most professional traders risk 1-2% per trade. Higher risk requires perfect execution.',
        )
    return None


def evaluate_strategy(strategy_dict: dict) -> List[ValidationWarning]:
    """
    Evaluate all parameters in a strategy and return warnings.
    
    Args:
        strategy_dict: Strategy configuration as dictionary
        
    Returns:
        List of validation warnings (empty if all parameters are safe)
        
    Example:
        >>> config = {...}
        >>> warnings = evaluate_strategy(config)
        >>> for w in warnings:
        ...     print(f"{w.level.upper()}: {w.parameter} - {w.message}")
    """
    warnings: List[ValidationWarning] = []
    
    # Signals
    signals = strategy_dict.get('signals', {})
    if 'breakout_lookback' in signals:
        w = evaluate_breakout_lookback(signals['breakout_lookback'])
        if w:
            warnings.append(w)
    
    if 'pullback_ma' in signals:
        w = evaluate_pullback_ma(signals['pullback_ma'])
        if w:
            warnings.append(w)
    
    # Risk
    risk = strategy_dict.get('risk', {})
    if 'min_rr' in risk:
        w = evaluate_minimum_rr(risk['min_rr'])
        if w:
            warnings.append(w)
    
    if 'risk_pct' in risk:
        # risk_pct is stored as decimal (e.g., 0.02), convert to percentage
        risk_pct_value = risk['risk_pct'] * 100
        w = evaluate_risk_per_trade(risk_pct_value)
        if w:
            warnings.append(w)
    
    # Universe volatility filter
    universe = strategy_dict.get('universe', {})
    filt = universe.get('filt', {})
    if 'max_atr_pct' in filt:
        w = evaluate_max_atr_pct(filt['max_atr_pct'])
        if w:
            warnings.append(w)
    
    # Management
    manage = strategy_dict.get('manage', {})
    if 'max_holding_days' in manage:
        w = evaluate_max_holding_days(manage['max_holding_days'])
        if w:
            warnings.append(w)
    
    return warnings


def calculate_safety_score(warnings: List[ValidationWarning]) -> int:
    """
    Calculate a safety score (0-100) based on validation warnings.
    
    Args:
        warnings: List of validation warnings
        
    Returns:
        Safety score from 0 (dangerous) to 100 (very safe)
        
    Scoring:
        - Start at 100
        - Deduct 15 points per 'danger' warning
        - Deduct 8 points per 'warning' warning
        - Deduct 3 points per 'info' warning
    """
    score = 100
    
    for warning in warnings:
        if warning.level == 'danger':
            score -= 15
        elif warning.level == 'warning':
            score -= 8
        elif warning.level == 'info':
            score -= 3
    
    return max(0, min(100, score))


def get_safety_level(score: int) -> Literal['beginner-safe', 'requires-discipline', 'expert-only']:
    """
    Categorize safety score into risk levels.
    
    Args:
        score: Safety score (0-100)
        
    Returns:
        Risk level category
        
    Levels:
        - 85-100: beginner-safe
        - 70-84:  requires-discipline
        - 0-69:   expert-only
    """
    if score >= 85:
        return 'beginner-safe'
    if score >= 70:
        return 'requires-discipline'
    return 'expert-only'


def validate_strategy_full(strategy_dict: dict) -> Tuple[List[ValidationWarning], int, str]:
    """
    Complete validation: warnings, score, and level.
    
    Args:
        strategy_dict: Strategy configuration as dictionary
        
    Returns:
        Tuple of (warnings, safety_score, safety_level)
        
    Example:
        >>> warnings, score, level = validate_strategy_full(config)
        >>> print(f"Score: {score}/100 ({level})")
        >>> for w in warnings:
        ...     print(f"  - {w.message}")
    """
    warnings = evaluate_strategy(strategy_dict)
    score = calculate_safety_score(warnings)
    level = get_safety_level(score)
    
    return warnings, score, level
```

**File:** `tests/unit/strategies/test_validation.py`

```python
"""Tests for strategy validation."""
import pytest
from swing_screener.strategies.validation import (
    ValidationWarning,
    evaluate_breakout_lookback,
    evaluate_minimum_rr,
    evaluate_max_atr_pct,
    evaluate_pullback_ma,
    evaluate_max_holding_days,
    evaluate_risk_per_trade,
    evaluate_strategy,
    calculate_safety_score,
    get_safety_level,
    validate_strategy_full,
)


def test_evaluate_breakout_lookback():
    """Test breakout lookback validation."""
    # Danger: below 20
    w = evaluate_breakout_lookback(15)
    assert w is not None
    assert w.level == 'danger'
    assert 'day trading' in w.message.lower()
    
    # Warning: 20-39
    w = evaluate_breakout_lookback(30)
    assert w is not None
    assert w.level == 'warning'
    
    # OK: 40+
    w = evaluate_breakout_lookback(50)
    assert w is None


def test_evaluate_minimum_rr():
    """Test minimum R/R validation."""
    # Danger: below 1.5
    w = evaluate_minimum_rr(1.2)
    assert w is not None
    assert w.level == 'danger'
    
    # Warning: 1.5-1.99
    w = evaluate_minimum_rr(1.8)
    assert w is not None
    assert w.level == 'warning'
    
    # OK: 2.0+
    w = evaluate_minimum_rr(2.5)
    assert w is None


def test_evaluate_max_atr_pct():
    """Test max ATR percentage validation."""
    # Danger: above 25%
    w = evaluate_max_atr_pct(30)
    assert w is not None
    assert w.level == 'danger'
    assert 'extremely volatile' in w.message.lower()
    
    # Warning: 18-25%
    w = evaluate_max_atr_pct(20)
    assert w is not None
    assert w.level == 'warning'
    
    # OK: below 18%
    w = evaluate_max_atr_pct(15)
    assert w is None


def test_evaluate_risk_per_trade():
    """Test risk per trade validation."""
    # Danger: above 3%
    w = evaluate_risk_per_trade(4.0)
    assert w is not None
    assert w.level == 'danger'
    assert 'drawdown' in w.message.lower()
    
    # Warning: 2-3%
    w = evaluate_risk_per_trade(2.5)
    assert w is not None
    assert w.level == 'warning'
    
    # OK: below 2%
    w = evaluate_risk_per_trade(1.5)
    assert w is None


def test_evaluate_strategy_safe():
    """Test evaluation of a safe strategy."""
    strategy = {
        'signals': {
            'breakout_lookback': 50,
            'pullback_ma': 20,
        },
        'risk': {
            'min_rr': 2.5,
            'risk_pct': 0.015,  # 1.5%
        },
        'universe': {
            'filt': {
                'max_atr_pct': 15,
            },
        },
        'manage': {
            'max_holding_days': 20,
        },
    }
    
    warnings = evaluate_strategy(strategy)
    assert len(warnings) == 0


def test_evaluate_strategy_dangerous():
    """Test evaluation of a dangerous strategy."""
    strategy = {
        'signals': {
            'breakout_lookback': 10,  # Too short - danger
            'pullback_ma': 5,         # Too short - warning
        },
        'risk': {
            'min_rr': 1.2,            # Too low - danger
            'risk_pct': 0.04,         # 4% - danger
        },
        'universe': {
            'filt': {
                'max_atr_pct': 30,    # Too high - danger
            },
        },
        'manage': {
            'max_holding_days': 3,    # Too short - warning
        },
    }
    
    warnings = evaluate_strategy(strategy)
    assert len(warnings) == 6
    
    # Count by level
    danger_count = sum(1 for w in warnings if w.level == 'danger')
    warning_count = sum(1 for w in warnings if w.level == 'warning')
    
    assert danger_count == 4
    assert warning_count == 2


def test_calculate_safety_score():
    """Test safety score calculation."""
    # No warnings = 100
    score = calculate_safety_score([])
    assert score == 100
    
    # One danger = 85
    warnings = [ValidationWarning('test', 'danger', 'Test')]
    score = calculate_safety_score(warnings)
    assert score == 85
    
    # Multiple warnings
    warnings = [
        ValidationWarning('test1', 'danger', 'Test'),   # -15
        ValidationWarning('test2', 'warning', 'Test'),  # -8
        ValidationWarning('test3', 'info', 'Test'),     # -3
    ]
    score = calculate_safety_score(warnings)
    assert score == 74  # 100 - 15 - 8 - 3


def test_get_safety_level():
    """Test safety level categorization."""
    assert get_safety_level(100) == 'beginner-safe'
    assert get_safety_level(85) == 'beginner-safe'
    assert get_safety_level(84) == 'requires-discipline'
    assert get_safety_level(70) == 'requires-discipline'
    assert get_safety_level(69) == 'expert-only'
    assert get_safety_level(0) == 'expert-only'


def test_validate_strategy_full():
    """Test complete validation."""
    strategy = {
        'signals': {
            'breakout_lookback': 25,  # Warning
            'pullback_ma': 20,
        },
        'risk': {
            'min_rr': 2.5,
            'risk_pct': 0.015,
        },
        'universe': {
            'filt': {
                'max_atr_pct': 15,
            },
        },
        'manage': {
            'max_holding_days': 20,
        },
    }
    
    warnings, score, level = validate_strategy_full(strategy)
    
    assert len(warnings) == 1
    assert warnings[0].level == 'warning'
    assert score == 92  # 100 - 8
    assert level == 'beginner-safe'


def test_validation_warning_to_dict():
    """Test ValidationWarning serialization."""
    w = ValidationWarning('testParam', 'danger', 'Test message')
    d = w.to_dict()
    
    assert d == {
        'parameter': 'testParam',
        'level': 'danger',
        'message': 'Test message',
    }
```

---

### Step 2: Add API Models (10 min)

**File:** `api/models/strategy.py`

Add validation response models:

```python
from pydantic import BaseModel, Field
from typing import Literal, List


class ValidationWarningModel(BaseModel):
    """A validation warning for a strategy parameter."""
    
    parameter: str = Field(..., description="Parameter name that triggered warning")
    level: Literal['danger', 'warning', 'info'] = Field(..., description="Severity level")
    message: str = Field(..., description="Human-readable warning message")


class StrategyValidationResult(BaseModel):
    """Result of strategy validation."""
    
    is_valid: bool = Field(..., description="True if no danger-level warnings")
    warnings: List[ValidationWarningModel] = Field(default_factory=list, description="All validation warnings")
    safety_score: int = Field(..., ge=0, le=100, description="Safety score (0-100)")
    safety_level: Literal['beginner-safe', 'requires-discipline', 'expert-only'] = Field(
        ...,
        description="Risk level category"
    )
    total_warnings: int = Field(..., description="Total number of warnings")
    danger_count: int = Field(..., description="Number of danger-level warnings")
    warning_count: int = Field(..., description="Number of warning-level warnings")
    info_count: int = Field(..., description="Number of info-level warnings")
```

---

### Step 3: Add Validation Endpoint (20 min)

**File:** `api/routers/strategy.py`

Add validation endpoint:

```python
from api.models.strategy import StrategyValidationResult, ValidationWarningModel
from src.swing_screener.strategies.validation import validate_strategy_full


@router.post("/strategies/validate", response_model=StrategyValidationResult)
async def validate_strategy(
    strategy: Strategy,
) -> StrategyValidationResult:
    """
    Validate strategy parameters and return warnings with safety score.
    
    Evaluates all strategy parameters against trading best practices and
    returns warnings for potentially dangerous configurations.
    
    Args:
        strategy: Strategy configuration to validate
        
    Returns:
        Validation result with warnings, score, and safety level
    """
    # Convert Strategy model to dict for validation
    strategy_dict = strategy.model_dump()
    
    # Run validation
    warnings, score, level = validate_strategy_full(strategy_dict)
    
    # Count warnings by level
    danger_count = sum(1 for w in warnings if w.level == 'danger')
    warning_count = sum(1 for w in warnings if w.level == 'warning')
    info_count = sum(1 for w in warnings if w.level == 'info')
    
    # Strategy is valid if no danger-level warnings
    is_valid = danger_count == 0
    
    return StrategyValidationResult(
        is_valid=is_valid,
        warnings=[
            ValidationWarningModel(
                parameter=w.parameter,
                level=w.level,
                message=w.message,
            )
            for w in warnings
        ],
        safety_score=score,
        safety_level=level,
        total_warnings=len(warnings),
        danger_count=danger_count,
        warning_count=warning_count,
        info_count=info_count,
    )


# Also add validation to create/update endpoints
@router.post("/strategies", response_model=Strategy)
async def create_strategy(
    strategy: Strategy,
    service: StrategyService = Depends(get_strategy_service),
) -> Strategy:
    """Create a new strategy with automatic validation."""
    # Validate first
    strategy_dict = strategy.model_dump()
    warnings, score, level = validate_strategy_full(strategy_dict)
    
    # Warn if dangerous (but still allow creation)
    danger_count = sum(1 for w in warnings if w.level == 'danger')
    if danger_count > 0:
        logger.warning(
            f"Creating strategy with {danger_count} danger warnings. "
            f"Safety score: {score}/100 ({level})"
        )
    
    # Create strategy
    created = service.create_strategy(strategy)
    return created


@router.put("/strategies/{strategy_id}", response_model=Strategy)
async def update_strategy(
    strategy_id: str,
    strategy: Strategy,
    service: StrategyService = Depends(get_strategy_service),
) -> Strategy:
    """Update a strategy with automatic validation."""
    # Validate first
    strategy_dict = strategy.model_dump()
    warnings, score, level = validate_strategy_full(strategy_dict)
    
    # Warn if dangerous (but still allow update)
    danger_count = sum(1 for w in warnings if w.level == 'danger')
    if danger_count > 0:
        logger.warning(
            f"Updating strategy {strategy_id} with {danger_count} danger warnings. "
            f"Safety score: {score}/100 ({level})"
        )
    
    # Update strategy
    updated = service.update_strategy(strategy_id, strategy)
    return updated
```

---

### Step 4: Update UI to Use Backend Validation (30 min)

**File:** `web-ui/src/features/strategy/api.ts`

Add validation API call:

```typescript
export interface ValidationWarning {
  parameter: string;
  level: 'danger' | 'warning' | 'info';
  message: string;
}

export interface StrategyValidationResult {
  isValid: boolean;
  warnings: ValidationWarning[];
  safetyScore: number;
  safetyLevel: 'beginner-safe' | 'requires-discipline' | 'expert-only';
  totalWarnings: number;
  dangerCount: number;
  warningCount: number;
  infoCount: number;
}

export async function validateStrategy(strategy: Strategy): Promise<StrategyValidationResult> {
  const response = await apiClient.post('/api/strategies/validate', transformStrategyForApi(strategy));
  return transformValidationResult(response.data);
}

function transformValidationResult(data: any): StrategyValidationResult {
  return {
    isValid: data.is_valid,
    warnings: data.warnings.map((w: any) => ({
      parameter: w.parameter,
      level: w.level,
      message: w.message,
    })),
    safetyScore: data.safety_score,
    safetyLevel: data.safety_level,
    totalWarnings: data.total_warnings,
    dangerCount: data.danger_count,
    warningCount: data.warning_count,
    infoCount: data.info_count,
  };
}
```

**File:** `web-ui/src/features/strategy/hooks.ts`

Add validation hook:

```typescript
import { useMutation } from '@tanstack/react-query';
import { validateStrategy } from './api';

export function useStrategyValidation() {
  return useMutation({
    mutationFn: validateStrategy,
  });
}
```

**File:** `web-ui/src/utils/strategySafety.ts`

Deprecate and redirect to backend:

```typescript
/**
 * @deprecated This file is deprecated. Use backend validation instead.
 * 
 * All functions in this file now just call the backend /api/strategies/validate endpoint.
 * This file is kept temporarily for backward compatibility but will be removed.
 * 
 * Migration:
 * - Old: const warnings = evaluateStrategy(strategy)
 * - New: const { warnings } = await validateStrategy(strategy)
 */

import { validateStrategy as validateStrategyBackend } from '@/features/strategy/api';

/**
 * @deprecated Use backend validation via useStrategyValidation() hook
 */
export async function evaluateStrategy(strategy: any) {
  const result = await validateStrategyBackend(strategy);
  return result.warnings;
}

/**
 * @deprecated Use backend validation via useStrategyValidation() hook
 */
export async function calculateSafetyScore(strategy: any) {
  const result = await validateStrategyBackend(strategy);
  return result.safetyScore;
}

/**
 * @deprecated Use backend validation via useStrategyValidation() hook
 */
export async function getSafetyLevel(score: number) {
  // This is now determined by backend
  console.warn('getSafetyLevel is deprecated. Use backend validation.');
  if (score >= 85) return 'beginner-safe';
  if (score >= 70) return 'requires-discipline';
  return 'expert-only';
}
```

**File:** `web-ui/src/pages/Strategy.tsx`

Update to use backend validation:

```typescript
const { mutateAsync: validateStrategyMutation } = useStrategyValidation();

// When strategy changes, validate it
useEffect(() => {
  if (strategy) {
    validateStrategyMutation(strategy).then((result) => {
      setValidationWarnings(result.warnings);
      setSafetyScore(result.safetyScore);
      setSafetyLevel(result.safetyLevel);
    });
  }
}, [strategy, validateStrategyMutation]);
```

---

## ✅ Testing & Validation

### 1. Run Backend Tests

```bash
# Test validation module
pytest tests/unit/strategies/test_validation.py -v

# Should see 10+ tests passing

# Test full suite
pytest tests/ -v
```

---

### 2. Test Validation Endpoint

```bash
# Start API
cd api && uvicorn main:app --reload

# Test validation with safe strategy
curl -X POST http://localhost:8000/api/strategies/validate \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Safe Strategy",
    "signals": {"breakout_lookback": 50, "pullback_ma": 20},
    "risk": {"min_rr": 2.5, "risk_pct": 0.015, "account_size": 10000},
    "universe": {"filt": {"max_atr_pct": 15}},
    "manage": {"max_holding_days": 20}
  }'

# Expected: is_valid: true, warnings: [], safety_score: 100

# Test with dangerous strategy
curl -X POST http://localhost:8000/api/strategies/validate \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dangerous Strategy",
    "signals": {"breakout_lookback": 10, "pullback_ma": 5},
    "risk": {"min_rr": 1.2, "risk_pct": 0.04, "account_size": 10000},
    "universe": {"filt": {"max_atr_pct": 30}},
    "manage": {"max_holding_days": 3}
  }'

# Expected: is_valid: false, multiple danger warnings, low score
```

---

### 3. Run Frontend Tests

```bash
cd web-ui && npm test -- --run
```

**Expected:** All tests pass (may need to update mocks for validation).

---

### 4. Manual UI Verification

1. Go to Strategy page
2. Create a new strategy with extreme parameters:
   - Breakout lookback: 5
   - Min R/R: 1.0
   - Risk per trade: 5%
3. Should see danger warnings from backend
4. Try to save - backend should log warning but allow
5. Edit to safe values - warnings should disappear

---

## 📊 Success Criteria

- ✅ Backend validation module created with 6 evaluators
- ✅ 10+ backend tests passing
- ✅ `/api/strategies/validate` endpoint working
- ✅ Backend validates on create/update (logs warnings)
- ✅ UI calls backend for validation
- ✅ Old UI validation deprecated (not removed yet)
- ✅ All 318 frontend tests passing
- ✅ All 434+ backend tests passing

---

## 📝 Commit Message

```
feat: Move strategy validation to backend (Phase 2)

Centralizes validation rules in backend for consistency across all operations.

**Backend:**
- Created `src/swing_screener/strategies/validation.py` with 6 validators
- Added 10+ comprehensive validation tests
- Added `/api/strategies/validate` endpoint
- Backend now validates on strategy create/update

**Frontend:**
- Added `useStrategyValidation()` hook
- Strategy page uses backend validation
- Deprecated `strategySafety.ts` (kept for compatibility)

**Impact:**
- Single source of truth for business rules
- Backend can enforce validation server-side
- Protection against API misuse
- Consistent warnings across UI and backend

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## 🔄 Next Steps

After Phase 2:
- [ ] **Phase 3:** Additional portfolio aggregations
- [ ] **Cleanup:** Remove deprecated UI files
- [ ] **Documentation:** Update strategy docs with validation rules
