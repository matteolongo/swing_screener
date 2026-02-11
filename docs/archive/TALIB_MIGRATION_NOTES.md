# TA-Lib Migration Analysis (Archive)

**Date:** February 11, 2026  
**Status:** Decided on Option C (Validation Layer)

This document archives the analysis of whether to migrate indicators to TA-Lib.

---

## Original Question

Should we migrate custom indicator implementations (SMA, ATR, Momentum) to use TA-Lib
for "battle-tested correctness"?

---

## Options Considered

### Option A: Full Migration
Replace all custom indicators with TA-Lib calls.

**Rejected** - Violates project philosophy of simplicity and transparency.

### Option B: Hybrid Approach
Keep custom core, add TA-Lib wrapper for future expansion.

**Good but unnecessary** - Not needed until adding complex indicators.

### Option C: Validation Layer ✅
Use TA-Lib in tests only to verify custom implementations.

**SELECTED** - Best balance of correctness validation and code simplicity.

---

## Validation Results

See `docs/INDICATOR_VALIDATION.md` for full results.

**Summary:**
- ✅ SMA: Perfect match (11/11 tests)
- ✅ Momentum: Perfect match (8/8 tests)
- ⚠️ ATR: Algorithmic difference (SMA vs Wilder's EMA, ~20% value difference)

---

## Decision Rationale

1. **Correctness achieved:** Validation proves SMA and Momentum are correct
2. **Simplicity maintained:** No dependency burden for end users
3. **Transparency preserved:** Custom code is easy to understand
4. **Growth path available:** Can use TA-Lib for future complex indicators
5. **Aligns with AGENTS.md:** "clarity over cleverness"

---

## ATR Decision Deferred

The ATR difference (SMA vs Wilder's EMA) is **documented but not resolved**.

**Future decision needed:**
- Keep SMA-based ATR (responsive, simple)
- Migrate to Wilder's EMA (industry standard)

See `INDICATOR_VALIDATION.md` for migration path.

---

## Files Created

Validation infrastructure:
- `tests/utils/talib_validators.py` - Helper functions
- `tests/test_sma_validation.py` - 11 SMA tests
- `tests/test_momentum_validation.py` - 8 momentum tests
- `tests/test_atr_validation.py` - Documents difference
- `docs/INDICATOR_VALIDATION.md` - User-facing docs

---

## Lessons Learned

1. **Validation layer is powerful** - Gives confidence without code changes
2. **Industry standards vary** - Not all "standards" are identical
3. **Simplicity has value** - Custom code is easier to debug and explain
4. **Document differences** - Transparency about algorithmic choices matters

---

_This file is archived for historical reference. See INDICATOR_VALIDATION.md for current status._
