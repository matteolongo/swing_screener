# Indicator Validation

> **Status: Current.**  
> **Last Reviewed:** February 17, 2026.

## Overview

The Swing Screener uses **TA-Lib as a validation oracle** for technical indicators.
This ensures our custom implementations produce correct results while maintaining
code simplicity and transparency.

**Philosophy:**
- Keep custom implementations in production (simple, transparent, debuggable)
- Use TA-Lib in **dev/test only** to verify correctness
- No dependency burden for end users
- Battle-tested confidence without sacrificing clarity

---

## Implementation Approach

### Option C: Validation Layer ✅

We use TA-Lib as a **test oracle** rather than replacing our custom code.

**Benefits:**
- ✅ Validates correctness without changing production code
- ✅ Maintains simplicity and transparency
- ✅ No installation burden for end users
- ✅ Aligns with project philosophy ("clarity over cleverness")
- ✅ Easy to rollback if issues found

**How it works:**
```python
# tests/test_sma_validation.py
def test_sma_matches_talib():
    custom_sma = compute_sma(close_df, window=20)
    talib_sma = talib.SMA(close, timeperiod=20)
    assert_series_close(custom_sma, talib_sma)  # ✅ Pass
```

---

## Validation Results

### Summary Table

| Indicator | Tests | Status | Match | Notes |
|-----------|-------|--------|-------|-------|
| **SMA** | 11 | ✅ Pass | 100% | Perfect match with TA-Lib |
| **Momentum/ROC** | 8 | ✅ Pass | 100% | Perfect match (after unit conversion) |
| **ATR** | - | ⚠️ Different | ~80% | Algorithmic difference (see below) |

**Total validation tests:** 19  
**Total project tests:** 169 (149 original + 19 new + 1 ATR)

---

## 1. SMA (Simple Moving Average)

✅ **PERFECT MATCH** - 11/11 tests passing

### Implementation
**Custom:**
```python
def compute_sma(close_df, window):
    return close_df.rolling(window, min_periods=window).mean()
```

**TA-Lib:**
```python
talib.SMA(close, timeperiod=window)
```

### Validation Results
- ✅ Single ticker: Exact match
- ✅ Multiple tickers: Exact match
- ✅ Various windows (2, 20, 50, 200): All match
- ✅ Edge cases (insufficient data, NaN, gaps): Match
- ✅ Large datasets (5+ years): Match

**Conclusion:** Our SMA implementation is **correct and matches industry standard**.

### Test Files
- `tests/test_sma_validation.py` - 11 comprehensive tests
- `tests/utils/talib_validators.py` - Validation helper functions

---

## 2. Momentum / ROC (Rate of Change)

✅ **PERFECT MATCH** - 8/8 tests passing

### Implementation
**Custom:**
```python
def compute_returns(close, lookback):
    return (close[t] / close[t-lookback]) - 1  # Returns as fraction
```

**TA-Lib:**
```python
talib.ROC(close, timeperiod=lookback)  # Returns as percentage
```

**Note:** TA-Lib ROC returns percentages (5.0 = 5%), our custom returns fractions (0.05 = 5%).
Validation divides TA-Lib result by 100 for comparison.

### Validation Results
- ✅ 6-month momentum (126 days): Exact match
- ✅ 12-month momentum (252 days): Exact match
- ✅ Multiple periods (1mo, 3mo, 6mo, 12mo): All match
- ✅ Multiple tickers: Match
- ✅ Trending markets (up/down): Match
- ✅ Sideways markets: Match
- ✅ Insufficient data: Match (all NaN)

**Conclusion:** Our momentum calculation is **correct and matches TA-Lib ROC**.

### Test Files
- `tests/test_momentum_validation.py` - 8 comprehensive tests

---

## 3. ATR (Average True Range)

⚠️ **ALGORITHMIC DIFFERENCE** - Documented, not a bug

### Root Cause

**Custom:** Uses **Simple Moving Average** (SMA) of True Range
```python
def compute_atr(high, low, close, window):
    tr = compute_true_range(high, low, close)
    return tr.rolling(window, min_periods=window).mean()
```

**TA-Lib:** Uses **Wilder's Smoothing** (Exponential Moving Average)
```python
# Wilder's method (original 1978 specification):
# ATR[0] = SMA(TR, period)
# ATR[t] = ((period - 1) * ATR[t-1] + TR[t]) / period
```

This is equivalent to: `tr.ewm(alpha=1/window, adjust=False).mean()`

### Impact

- **Values differ by ~10-20%** especially after volatility spikes
- **Wilder's method:** Smooths more aggressively, slower to react
- **SMA method:** More responsive to recent volatility

### Which is "Correct"?

**Both are valid.** It's a design choice:

| Aspect | Custom (SMA) | TA-Lib (Wilder's EMA) |
|--------|--------------|------------------------|
| **Historical** | N/A | ✅ Wilder 1978 original |
| **Industry Standard** | ❌ Non-standard | ✅ Most TA tools use this |
| **Simplicity** | ✅ Very simple | ⚠️ More complex |
| **Transparency** | ✅ Easy to debug | ⚠️ Stateful smoothing |
| **Responsiveness** | ✅ Reacts quickly | ⚠️ Lags more |
| **Swing Trading** | ✅ Good for recent volatility | ⚠️ Over-smoothing risk |

### Recommendation

**Current decision:** **DOCUMENT and decide later**

**When to migrate to Wilder's:**
- If comparing results with other TA tools (need identical values)
- If following traditional technical analysis literature
- If backtesting against historical TA strategies

**When to keep SMA:**
- If prioritizing transparency and simplicity
- If recent volatility matters more for swing trading
- If using ATR for relative comparisons (ranking stocks)

### Migration Path (if needed)

To match TA-Lib exactly:
```python
# In src/swing_screener/indicators/volatility.py:60
# Replace:
atr = tr.rolling(window=window, min_periods=window).mean()
# With:
atr = tr.ewm(alpha=1/window, adjust=False, min_periods=window).mean()
```

**Effort:** ~5 minutes  
**Risk:** Low (just changes smoothing, not formula)  
**Impact:** All ATR values will change by ~10-20%

### Test Files
- `tests/test_atr_validation.py` - Documents the difference
- Session notes: `ATR_VALIDATION_NOTE.md` - Detailed analysis

---

## Running Validation Tests

### Prerequisites
```bash
# TA-Lib must be installed (dev dependency)
pip install ta-lib  # or: conda install -c conda-forge ta-lib
```

**Note:** TA-Lib requires compilation. See installation guides for your platform.

### Run Tests
```bash
# All validation tests
pytest tests/test_sma_validation.py tests/test_momentum_validation.py -v

# SMA only
pytest tests/test_sma_validation.py -v

# Momentum only
pytest tests/test_momentum_validation.py -v

# All tests (excluding ATR validation)
pytest tests/ -k "not atr_validation" -v
```

### Without TA-Lib
Validation tests are **skipped** if TA-Lib is not installed.
This ensures end users can run the test suite without TA-Lib.

```python
@require_talib()  # Decorator skips test if TA-Lib unavailable
class TestSMAValidation:
    ...
```

---

## Adding New Indicators

When adding a new indicator (e.g., RSI, MACD):

1. **Implement custom version first** (simple, transparent)
2. **Create validation test** comparing to TA-Lib
3. **Document any differences** if they exist
4. **Decide:** Keep custom or use TA-Lib?

**Example:**
```python
# tests/test_rsi_validation.py
@require_talib()
class TestRSIValidation:
    def test_rsi_matches_talib(self):
        custom_rsi = compute_rsi(close_df, window=14)
        talib_rsi = talib.RSI(close, timeperiod=14)
        validate_rsi(close_df["AAPL"], 14, custom_rsi["AAPL"])
```

---

## FAQ

### Why not just use TA-Lib everywhere?

1. **Transparency:** Custom code is easier to understand and debug
2. **Simplicity:** No complex dependencies for end users
3. **Educational:** Users can see exactly how indicators work
4. **Flexibility:** Easy to modify if needed

### Do I need TA-Lib to use Swing Screener?

**No.** TA-Lib is a **dev dependency only**. The production code uses custom implementations.

### What if validation finds a bug?

If custom implementation doesn't match TA-Lib:
1. **Investigate:** Is it a bug or design difference?
2. **Document:** Explain the difference
3. **Decide:** Fix, keep, or migrate to TA-Lib

### Can I use TA-Lib for new indicators?

**Yes**, but consider:
- Does it violate the "simplicity" principle?
- Could a simple custom implementation work just as well?
- Is battle-tested accuracy critical for this indicator?

---

## References

### TA-Lib Documentation
- [TA-Lib Python wrapper](https://ta-lib.github.io/ta-lib-python/)
- [Function reference](https://ta-lib.org/function.html)

### Technical Analysis Standards
- Wilder, J. Welles (1978). *New Concepts in Technical Trading Systems*. (Original ATR specification)
- Murphy, John J. (1999). *Technical Analysis of the Financial Markets*. (SMA, momentum standards)

### Alternative Libraries (if TA-Lib installation fails)
- **pandas-ta**: Pure Python, 130+ indicators, easy install
- **ta**: Pure Python, simpler, common indicators only

---

## Changelog

### 2026-02-11 - Initial Validation
- ✅ Added SMA validation (11 tests, all passing)
- ✅ Added Momentum/ROC validation (8 tests, all passing)
- ⚠️ Documented ATR algorithmic difference (SMA vs Wilder's EMA)
- 📝 Created this documentation

---

_For questions or to propose changes to validation approach, see AGENTS.md and project philosophy._
