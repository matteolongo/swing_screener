# PR 6 — Fundamentals Conviction Model

> Branch: `feat/fundamentals-conviction`
> Base: `feature/ux-revamp`
> Depends on: PR4
> Blocks: PR8

---

## Problem

The fundamentals module currently snapshots level-based pillar scores (growth, profitability, balance sheet, cash flow, valuation). It does not capture whether growth is accelerating or decelerating, does not penalize stale or partial data before the combined ranking stage, and mixes valuation into the quality score.

Consequence:
- A business with decelerating revenue but still-positive growth levels scores as well as an accelerating one.
- Stale fundamentals (old `report_date`) can support high conviction without any caveat.
- Valuation and quality are not separable for ranking purposes.

---

## Changes

### 1. `src/swing_screener/fundamentals/models.py`

Add fields to the fundamentals result model:

```python
# Trend acceleration signals (added in scoring)
revenue_acceleration: float | None = None      # slope of 3-period revenue growth series (positive = accelerating)
margin_trend_slope: float | None = None        # slope of operating margin over 3 periods
fcf_margin_trend: float | None = None          # slope of FCF margin over 3 periods

# Conviction modifiers (used by combined ranking)
freshness_penalty: float = 0.0    # 0..1, higher = more stale; reduces combined priority
coverage_penalty: float = 0.0     # 0..1, higher = more missing pillars; caps conviction

# Separate quality vs valuation
business_quality_score: float | None = None    # growth + profitability + balance sheet + FCF only
valuation_attractiveness: float | None = None  # valuation pillar only, separate from quality
```

### 2. `src/swing_screener/fundamentals/scoring.py`

**Trend acceleration**:
- `revenue_acceleration`: fit a linear slope over the last 3 annual revenue growth rates. Positive = accelerating.
- `margin_trend_slope`: fit a linear slope over the last 3 operating margin readings.
- `fcf_margin_trend`: fit a linear slope over the last 3 FCF margin readings.
- When fewer than 2 data points are available, leave as `None`.

**Freshness penalty**:
```python
def _freshness_penalty(report_date: date | None, reference_date: date) -> float:
    if report_date is None:
        return 0.5    # unknown age = moderate penalty
    age_days = (reference_date - report_date).days
    if age_days <= 90:
        return 0.0
    if age_days <= 180:
        return 0.15
    if age_days <= 365:
        return 0.30
    return 0.50
```

**Coverage penalty**:
```python
def _coverage_penalty(pillar_scores: dict[str, float | None]) -> float:
    missing = sum(1 for v in pillar_scores.values() if v is None)
    total = len(pillar_scores)
    return missing / total if total > 0 else 0.0
```

**Quality / valuation split**:
- `business_quality_score` = average of growth, profitability, balance_sheet, cash_flow pillar scores (exclude valuation).
- `valuation_attractiveness` = valuation pillar score only.
- Existing composite `overall_score` kept for backward compatibility.

**Sector-aware thresholds** (extend existing pattern):
- Apply sector-specific thresholds to profitability and leverage pillars, mirroring the existing `sector_aware_valuation` logic.
- Document the threshold tables in code comments.

### 3. `src/swing_screener/recommendation/priority.py` (from PR4)

Use the new fields in `compute_combined_priority`:

```python
fundamentals_quality = snap.business_quality_score or 0.5
valuation_attractiveness = snap.valuation_attractiveness or 0.5
freshness_pen = snap.freshness_penalty
coverage_pen = snap.coverage_penalty
```

### 4. `src/swing_screener/recommendation/decision_summary.py`

In `ExplanationContract.confidence_notes` (from PR3):
- Add note if `freshness_penalty > 0.15`: "Fundamentals data is X months old."
- Add note if `coverage_penalty > 0.25`: "Some fundamental pillars are missing."

---

## Tests

### `tests/test_fundamentals_scoring.py` (extend existing or new)

**Test 1 — stale data produces non-zero freshness_penalty**
```python
def test_stale_data_produces_freshness_penalty():
    old_date = date.today() - timedelta(days=400)
    penalty = _freshness_penalty(old_date, date.today())
    assert penalty >= 0.30
```

**Test 2 — fresh data produces zero penalty**
```python
def test_fresh_data_produces_no_penalty():
    recent_date = date.today() - timedelta(days=30)
    penalty = _freshness_penalty(recent_date, date.today())
    assert penalty == 0.0
```

**Test 3 — partial coverage produces coverage_penalty**
```python
def test_partial_coverage_produces_penalty():
    pillars = {"growth": 0.7, "profitability": None, "balance_sheet": 0.5, "cash_flow": None, "valuation": 0.4}
    penalty = _coverage_penalty(pillars)
    assert penalty == approx(2 / 5)
```

**Test 4 — business_quality_score excludes valuation**
```python
def test_business_quality_excludes_valuation():
    snapshot = build_snapshot(growth=0.8, profitability=0.8, balance_sheet=0.8, cash_flow=0.8, valuation=0.1)
    assert snapshot.business_quality_score > 0.7
    assert snapshot.valuation_attractiveness == approx(0.1, rel=0.1)
```

**Test 5 — accelerating revenue scores higher than decelerating**
```python
def test_revenue_acceleration_positive_for_improving_series():
    # growth rates: [0.10, 0.15, 0.20] = accelerating
    assert _revenue_acceleration([0.10, 0.15, 0.20]) > 0
    # growth rates: [0.20, 0.15, 0.10] = decelerating
    assert _revenue_acceleration([0.20, 0.15, 0.10]) < 0
```

---

## Acceptance criteria

- [ ] `freshness_penalty` is non-zero for data older than 90 days.
- [ ] `coverage_penalty` reflects the fraction of missing pillars.
- [ ] `business_quality_score` does not include valuation.
- [ ] `valuation_attractiveness` is a separate field.
- [ ] Combined ranking in PR4 correctly uses both fields.
- [ ] `confidence_notes` in explanation includes freshness/coverage caveats when applicable.
- [ ] All five new tests pass.
- [ ] Existing fundamentals tests pass.
