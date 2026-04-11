# PR 1 — Intelligence Technical-Readiness Handoff

> Branch: `fix/intelligence-handoff`
> Base: `feature/ux-revamp`
> Depends on: nothing
> Blocks: PR2, PR3, PR4

---

## Problem

When a user opens the workspace for a symbol that exists in the screener results, the intelligence run is launched without the candidate's technical readiness score. The backend pipeline defaults every missing symbol to `0.5` (see `_normalize_technical` in `pipeline.py:440`).

Consequence:
- `decision_summary.technical_label` can be silently weakened.
- Opportunity scores and action labels in intelligence do not reflect the actual screener setup.
- A symbol ranked #1 technically may receive the same intelligence weighting as an unranked symbol.

**Verified gap**: `useSymbolIntelligenceRunner.ts` calls `runIntelligence({ symbols: [symbol] })` with no `technicalReadiness` field. The API model (`IntelligenceRunRequest`) already has the field; it is just never populated from the frontend.

---

## Changes

### 1. `web-ui/src/features/intelligence/useSymbolIntelligenceRunner.ts`

- Accept an optional `technicalReadiness?: Record<string, number>` parameter in the hook.
- Pass it into the `runIntelligence(...)` call.

```typescript
// before
const launch = await runIntelligence({ symbols: [symbol] });

// after
const launch = await runIntelligence({
  symbols: [symbol],
  technicalReadiness: technicalReadiness ?? undefined,
});
```

### 2. Call sites (workspace components)

- Find all components that call `useSymbolIntelligenceRunner`.
- Pass down `candidate.technicalReadiness` (or derive from `candidate.confidence` if the dedicated field is not yet present).
- If no candidate exists for the symbol, pass `undefined` explicitly — do not pass `0.5` from the frontend; let the backend apply the documented fallback.

### 3. `src/swing_screener/intelligence/pipeline.py` — `_normalize_technical`

Add a debug log line when a symbol falls back to 0.5:

```python
if value is None:
    logger.debug(
        "_normalize_technical: no readiness value for %s, using fallback 0.5", symbol
    )
    out[symbol] = 0.5
```

This makes missing handoffs visible in backend logs without changing behavior.

### 4. `api/models/intelligence.py` (verify only)

Confirm `IntelligenceRunRequest` already has:
```python
technical_readiness: dict[str, float] | None = None
```
If not, add it. No other model changes needed.

---

## Tests

### `tests/test_intelligence_pipeline.py`

**Test 1 — real readiness is forwarded, not replaced by fallback**
```python
def test_technical_readiness_passed_through():
    result = _normalize_technical(["AAPL"], {"AAPL": 0.85})
    assert result["AAPL"] == approx(0.85)
```

**Test 2 — missing symbol falls back to 0.5, does not crash**
```python
def test_missing_symbol_defaults_to_0_5():
    result = _normalize_technical(["AAPL", "MSFT"], {"AAPL": 0.9})
    assert result["MSFT"] == approx(0.5)
```

**Test 3 — higher technical readiness produces higher opportunity score (integration)**
Build two `build_opportunities()` calls with identical signals but different `technical_readiness` values (0.9 vs 0.5) and assert the 0.9 case produces a higher `opportunity_score`.

---

## Acceptance criteria

- [ ] Intelligence run launched from workspace sends real `technical_readiness` when a screener candidate exists.
- [ ] Backend log shows actual values, not fallback 0.5, for workspace runs.
- [ ] `decision_summary.technical_label` is no longer silently weakened by missing handoff.
- [ ] All three new tests pass.
- [ ] No existing tests broken.
