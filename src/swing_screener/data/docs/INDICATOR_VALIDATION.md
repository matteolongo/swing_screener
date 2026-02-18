# Indicator Validation

> Status: current.  
> Last reviewed: 2026-02-17.

## Summary
Custom indicator implementations are validated in tests against TA-Lib where possible.

Validated indicators:
- SMA: matches TA-Lib
- ROC / momentum: matches TA-Lib (unit conversion applied)
- ATR: intentionally differs (SMA vs Wilder smoothing)

Key tests:
- `tests/test_sma_validation.py`
- `tests/test_momentum_validation.py`
- `tests/test_atr_validation.py`

## ATR Note
ATR uses a simple moving average of true range (not Wilder). This is a design choice for transparency; results differ from TA-Lib.
