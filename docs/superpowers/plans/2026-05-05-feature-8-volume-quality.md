# Volume Quality Signal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Read `docs/superpowers/plans/handover-context.md` before starting.

**Goal:** Surface `volume_ratio` (today's volume ÷ 20-bar avg) on screener candidates so the trader can see whether a breakout is backed by real conviction or thin volume.

**Architecture:** Add `volume_ratio: float` to `compute_setup_quality()` alongside the existing `breakout_volume_confirmation` bool — the raw numbers are already computed there. Add the field to the `keep` list in the momentum module so it survives into the results DataFrame. Map it through the API model and service layer. On the frontend, thread it through `ScreenerCandidateAPI → ScreenerCandidate → CandidateViewModel` and display it in two places: a metric box in the expanded details row, and a small colour dot next to the signal badge in the screener table.

**Tech Stack:** Python/FastAPI backend, React 18/TypeScript frontend, existing OHLCV MultiIndex DataFrame

---

## Volume quality thresholds

| `volume_ratio` | Label | Dot colour |
|---|---|---|
| ≥ 1.5× | strong | green (`bg-emerald-500`) |
| 0.9 – 1.49× | — (neutral) | no dot |
| < 0.9× | weak | amber (`bg-amber-400`) |

---

## File map

| File | Change |
|---|---|
| `src/swing_screener/indicators/setup_quality.py` | Add `volume_ratio` beside `breakout_volume_confirmation` |
| `src/swing_screener/strategy/modules/momentum.py` | Add `"volume_ratio"` to `keep` column list |
| `api/models/screener.py` | Add `volume_ratio: Optional[float] = None` to `ScreenerCandidate` |
| `api/services/screener_service.py` | Extract `volume_ratio` from results row in candidate loop |
| `tests/test_setup_quality.py` | Add `volume_ratio` coverage (ratio value, missing-volume case) |
| `tests/api/test_volume_quality.py` | Model field presence + service-level smoke |
| `web-ui/src/features/screener/types.ts` | Add `volumeRatio?: number` to both API + UI types; transform |
| `web-ui/src/features/screener/viewModel.ts` | Add `volumeRatio: number \| null` to `CandidateViewModel` |
| `web-ui/src/i18n/messages.en.ts` | Add `screener.details.volumeRatio.*` keys |
| `web-ui/src/components/domain/screener/ScreenerCandidateDetailsRow.tsx` | Add volume ratio metric box |
| `web-ui/src/components/domain/screener/ScreenerCandidatesTable.tsx` | Add colour dot next to signal badge |
| `web-ui/src/components/domain/screener/ScreenerCandidateDetailsRow.test.tsx` | New test file |

---

### Task 1: Backend — compute and propagate `volume_ratio`

**Files:**
- Modify: `src/swing_screener/indicators/setup_quality.py`
- Modify: `src/swing_screener/strategy/modules/momentum.py`
- Modify: `api/models/screener.py`
- Modify: `api/services/screener_service.py`
- Test: `tests/test_setup_quality.py`
- Test: `tests/api/test_volume_quality.py`

- [ ] **Step 1: Write failing unit tests for `compute_setup_quality`**

Append to `tests/test_setup_quality.py`:

```python
# ── volume_ratio tests ────────────────────────────────────────────────────────

def test_volume_ratio_computed_when_volume_available() -> None:
    """When 21+ bars of volume are present, volume_ratio must equal today / avg_20."""
    n = 30
    close = list(np.linspace(100.0, 110.0, n))
    # Avg of first 20 bars of volume = 1000. Today (bar 29) = 2000 → ratio = 2.0
    volume = [1_000.0] * (n - 1) + [2_000.0]

    ohlcv = _make_ohlcv(close, volume=volume, ticker="VOL")
    result = compute_setup_quality(ohlcv, ["VOL"])

    assert "VOL" in result.index
    assert "volume_ratio" in result.columns
    ratio = result.loc["VOL", "volume_ratio"]
    assert not math.isnan(ratio)
    # today_vol=2000, avg of previous 20 bars=1000 → ratio≈2.0
    assert abs(ratio - 2.0) < 0.05, f"Expected ≈2.0 got {ratio}"


def test_volume_ratio_absent_when_no_volume() -> None:
    """When volume column is absent, volume_ratio must not appear (or be NaN only)."""
    close = list(np.linspace(100.0, 110.0, 30))
    ohlcv = _make_ohlcv(close, ticker="NOVOL2")  # no volume

    result = compute_setup_quality(ohlcv, ["NOVOL2"])

    assert "NOVOL2" in result.index
    if "volume_ratio" in result.columns:
        assert math.isnan(result.loc["NOVOL2", "volume_ratio"])


def test_volume_ratio_absent_when_insufficient_volume_bars() -> None:
    """Fewer than 21 volume bars → volume_ratio must be absent or NaN."""
    n = 10  # only 10 bars total
    close = list(np.linspace(100.0, 110.0, n))
    volume = [1_000.0] * n

    ohlcv = _make_ohlcv(close, volume=volume, ticker="SHORT")
    result = compute_setup_quality(ohlcv, ["SHORT"])

    assert "SHORT" in result.index
    if "volume_ratio" in result.columns:
        assert math.isnan(result.loc["SHORT", "volume_ratio"]), \
            "volume_ratio must be NaN when fewer than 21 bars available"
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/test_setup_quality.py::test_volume_ratio_computed_when_volume_available tests/test_setup_quality.py::test_volume_ratio_absent_when_no_volume tests/test_setup_quality.py::test_volume_ratio_absent_when_insufficient_volume_bars -v
```

Expected: FAIL — `volume_ratio` not in result columns

- [ ] **Step 3: Add `volume_ratio` to `compute_setup_quality`**

In `src/swing_screener/indicators/setup_quality.py`, locate the block at the end of the per-ticker loop that computes `breakout_volume_confirmation` (around line 126):

```python
        # ── breakout_volume_confirmation (optional) ───────────────────────
        if vol_m is not None and ticker in vol_m.columns:
            v = vol_m[ticker].dropna()
            if len(v) >= 21:
                today_vol = float(v.iloc[-1])
                avg_vol_20 = float(v.iloc[-21:-1].mean())
                row["breakout_volume_confirmation"] = bool(today_vol > 1.5 * avg_vol_20)
```

Replace with:

```python
        # ── breakout_volume_confirmation + volume_ratio (optional) ────────
        if vol_m is not None and ticker in vol_m.columns:
            v = vol_m[ticker].dropna()
            if len(v) >= 21:
                today_vol = float(v.iloc[-1])
                avg_vol_20 = float(v.iloc[-21:-1].mean())
                row["breakout_volume_confirmation"] = bool(today_vol > 1.5 * avg_vol_20)
                if avg_vol_20 > 0:
                    row["volume_ratio"] = round(today_vol / avg_vol_20, 2)
```

- [ ] **Step 4: Run unit tests**

```bash
pytest tests/test_setup_quality.py::test_volume_ratio_computed_when_volume_available tests/test_setup_quality.py::test_volume_ratio_absent_when_no_volume tests/test_setup_quality.py::test_volume_ratio_absent_when_insufficient_volume_bars -v
```

Expected: 3 PASSED

- [ ] **Step 5: Add `volume_ratio` to momentum `keep` list**

In `src/swing_screener/strategy/modules/momentum.py`, find the `keep` list (around line 128). It currently ends with:

```python
        "entry", "stop", "shares", "position_value", "realized_risk",
    ]
```

Add `"volume_ratio"` before `"entry"`:

```python
        "volume_ratio",
        "entry", "stop", "shares", "position_value", "realized_risk",
    ]
```

- [ ] **Step 6: Add `volume_ratio` to `ScreenerCandidate` model**

In `api/models/screener.py`, in class `ScreenerCandidate`, after `breakout_volume_confirmation`:

```python
    breakout_volume_confirmation: Optional[bool] = None
    volume_ratio: Optional[float] = None
```

- [ ] **Step 7: Extract `volume_ratio` in screener service**

In `api/services/screener_service.py`, inside the candidate construction loop, after the `breakout_volume_confirmation` extraction (around line 1005):

```python
                        breakout_volume_confirmation=(
                            bool(row.get("breakout_volume_confirmation"))
                            if not _is_na_scalar(row.get("breakout_volume_confirmation"))
                            else None
                        ),
```

Add immediately after:

```python
                        volume_ratio=_safe_optional_float(row.get("volume_ratio")),
```

This line goes inside the `ScreenerCandidate(...)` constructor call alongside the other fields.

- [ ] **Step 8: Write API model test**

Create `tests/api/test_volume_quality.py`:

```python
"""Tests for volume_ratio field propagation through the screener model."""
from __future__ import annotations

import pytest
from api.models.screener import ScreenerCandidate


def test_screener_candidate_accepts_volume_ratio() -> None:
    """ScreenerCandidate must accept volume_ratio and default to None."""
    c = ScreenerCandidate(
        ticker="TEST",
        close=100.0,
        sma_20=95.0,
        sma_50=90.0,
        sma_200=80.0,
        atr=2.0,
        momentum_6m=0.1,
        momentum_12m=0.15,
        rel_strength=0.05,
        score=0.8,
        confidence=0.75,
        rank=1,
    )
    assert c.volume_ratio is None


def test_screener_candidate_stores_volume_ratio() -> None:
    """volume_ratio is stored and serialised correctly."""
    c = ScreenerCandidate(
        ticker="TEST",
        close=100.0,
        sma_20=95.0,
        sma_50=90.0,
        sma_200=80.0,
        atr=2.0,
        momentum_6m=0.1,
        momentum_12m=0.15,
        rel_strength=0.05,
        score=0.8,
        confidence=0.75,
        rank=1,
        volume_ratio=1.87,
    )
    assert c.volume_ratio == pytest.approx(1.87)
    payload = c.model_dump()
    assert payload["volume_ratio"] == pytest.approx(1.87)
```

- [ ] **Step 9: Run API model tests**

```bash
pytest tests/api/test_volume_quality.py -v
```

Expected: 2 PASSED

- [ ] **Step 10: Run full backend suite**

```bash
pytest -q
```

- [ ] **Step 11: Commit**

```bash
git add src/swing_screener/indicators/setup_quality.py \
        src/swing_screener/strategy/modules/momentum.py \
        api/models/screener.py \
        api/services/screener_service.py \
        tests/test_setup_quality.py \
        tests/api/test_volume_quality.py
git commit -m "feat: add volume_ratio to screener candidate output"
```

---

### Task 2: Frontend — wire `volumeRatio` through types and viewModel

**Files:**
- Modify: `web-ui/src/features/screener/types.ts`
- Modify: `web-ui/src/features/screener/viewModel.ts`

- [ ] **Step 1: Add to `ScreenerCandidateAPI` (snake_case)**

In `web-ui/src/features/screener/types.ts`, in interface `ScreenerCandidateAPI` (around line 196), after `combined_priority_score`:

```typescript
  volume_ratio?: number;
```

- [ ] **Step 2: Add to `ScreenerCandidate` (camelCase)**

In the same file, in interface `ScreenerCandidate` (around line 94), after `combinedPriorityScore`:

```typescript
  volumeRatio?: number;
```

- [ ] **Step 3: Add to the transform in `transformScreenerResponse`**

In `transformScreenerResponse` (around line 404), in the candidates map, after `combinedPriorityScore`:

```typescript
      volumeRatio: c.volume_ratio ?? undefined,
```

- [ ] **Step 4: Add to `CandidateViewModel`**

In `web-ui/src/features/screener/viewModel.ts`, in interface `CandidateViewModel` (after `fundamentalsSummary`):

```typescript
  volumeRatio: number | null;
```

- [ ] **Step 5: Populate in `toCandidateViewModel`**

In `toCandidateViewModel`, in the return object (after `fundamentalsSummary`):

```typescript
    volumeRatio: candidate.volumeRatio ?? null,
```

- [ ] **Step 6: Run typecheck**

```bash
cd web-ui && npm run typecheck
```

Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add web-ui/src/features/screener/types.ts web-ui/src/features/screener/viewModel.ts
git commit -m "feat: thread volumeRatio through screener types and viewModel"
```

---

### Task 3: Frontend — add i18n strings

**Files:**
- Modify: `web-ui/src/i18n/messages.en.ts`

- [ ] **Step 1: Add keys**

In `web-ui/src/i18n/messages.en.ts`, in the `screener.details` section (around line 1056):

```typescript
    details: {
      title: 'Details for {{ticker}}',
      advancedMetrics: 'Advanced Metrics',
      overlayInfo: 'Overlay Information',
      secondaryActions: 'More Analysis',
      noOverlayData: 'No overlay data available',
      volumeRatio: {
        label: 'Volume',
        strong: '{{value}}× avg (strong)',
        weak: '{{value}}× avg (weak)',
        neutral: '{{value}}× avg',
        dotStrongTitle: 'High-volume breakout — strong conviction',
        dotWeakTitle: 'Low-volume breakout — higher failure rate',
      },
    },
```

- [ ] **Step 2: Run typecheck**

```bash
cd web-ui && npm run typecheck
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/i18n/messages.en.ts
git commit -m "feat: add volume quality i18n strings to screener details"
```

---

### Task 4: Frontend — show volume ratio in details row

**Files:**
- Modify: `web-ui/src/components/domain/screener/ScreenerCandidateDetailsRow.tsx`
- Create: `web-ui/src/components/domain/screener/ScreenerCandidateDetailsRow.test.tsx`

- [ ] **Step 1: Write failing test**

Create `web-ui/src/components/domain/screener/ScreenerCandidateDetailsRow.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import ScreenerCandidateDetailsRow from './ScreenerCandidateDetailsRow';
import type { CandidateViewModel } from '@/features/screener/viewModel';
import type { ScreenerCandidate } from '@/features/screener/types';
import { t } from '@/i18n/t';

function makeVm(volumeRatio: number | null): CandidateViewModel {
  const original: ScreenerCandidate = {
    ticker: 'TEST',
    currency: 'USD',
    close: 100,
    sma20: 95,
    sma50: 90,
    sma200: 80,
    atr: 2,
    momentum6m: 0.1,
    momentum12m: 0.15,
    relStrength: 0.05,
    score: 0.8,
    confidence: 0.75,
    rank: 1,
    volumeRatio: volumeRatio ?? undefined,
  };
  return {
    ticker: 'TEST',
    currency: 'USD',
    name: 'Test Corp',
    sector: 'Technology',
    lastBar: '2026-05-05T00:00:00',
    close: 100,
    confidence: 0.75,
    rank: 1,
    priorityRank: 1,
    rawRank: 1,
    verdict: 'UNKNOWN',
    entry: null,
    stop: null,
    rr: null,
    riskUsd: null,
    score: 0.8,
    atr: 2,
    momentum6m: 0.1,
    momentum12m: 0.15,
    relStrength: 0.05,
    fundamentalsCoverageStatus: null,
    fundamentalsFreshnessStatus: null,
    fundamentalsSummary: null,
    fixes: [],
    sameSymbol: null,
    volumeRatio,
    original,
  };
}

describe('ScreenerCandidateDetailsRow — volume ratio', () => {
  it('shows volume ratio metric box when volumeRatio is present', () => {
    renderWithProviders(<ScreenerCandidateDetailsRow candidate={makeVm(1.87)} />);
    // Should show the label
    expect(screen.getByText(t('screener.details.volumeRatio.label'))).toBeInTheDocument();
    // Should show the value formatted as "1.87× avg (strong)" since 1.87 >= 1.5
    expect(screen.getByText(t('screener.details.volumeRatio.strong', { value: '1.87' }))).toBeInTheDocument();
  });

  it('shows weak label when volumeRatio < 0.9', () => {
    renderWithProviders(<ScreenerCandidateDetailsRow candidate={makeVm(0.7)} />);
    expect(screen.getByText(t('screener.details.volumeRatio.weak', { value: '0.70' }))).toBeInTheDocument();
  });

  it('shows neutral label when volumeRatio is between 0.9 and 1.5', () => {
    renderWithProviders(<ScreenerCandidateDetailsRow candidate={makeVm(1.2)} />);
    expect(screen.getByText(t('screener.details.volumeRatio.neutral', { value: '1.20' }))).toBeInTheDocument();
  });

  it('does not show volume label when volumeRatio is null', () => {
    renderWithProviders(<ScreenerCandidateDetailsRow candidate={makeVm(null)} />);
    expect(screen.queryByText(t('screener.details.volumeRatio.label'))).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd web-ui && npx vitest run src/components/domain/screener/ScreenerCandidateDetailsRow.test.tsx
```

Expected: FAIL — no volume metric in component

- [ ] **Step 3: Add volume ratio metric box to details row**

In `web-ui/src/components/domain/screener/ScreenerCandidateDetailsRow.tsx`, add a helper function before the component:

```typescript
function volumeLabel(ratio: number): string {
  if (ratio >= 1.5) return t('screener.details.volumeRatio.strong', { value: ratio.toFixed(2) });
  if (ratio < 0.9) return t('screener.details.volumeRatio.weak', { value: ratio.toFixed(2) });
  return t('screener.details.volumeRatio.neutral', { value: ratio.toFixed(2) });
}
```

Then in the `<div className="grid ...">` containing the metric boxes, add a 6th box after the RS box:

```tsx
{candidate.volumeRatio != null && (
  <div className="rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
      {t('screener.details.volumeRatio.label')}
    </p>
    <div
      className={`font-mono mt-1 text-base ${
        candidate.volumeRatio >= 1.5
          ? 'text-emerald-600 dark:text-emerald-400'
          : candidate.volumeRatio < 0.9
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-gray-900 dark:text-gray-100'
      }`}
    >
      {volumeLabel(candidate.volumeRatio)}
    </div>
  </div>
)}
```

- [ ] **Step 4: Run tests**

```bash
cd web-ui && npx vitest run src/components/domain/screener/ScreenerCandidateDetailsRow.test.tsx
```

Expected: 4 PASSED

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/components/domain/screener/ScreenerCandidateDetailsRow.tsx \
        web-ui/src/components/domain/screener/ScreenerCandidateDetailsRow.test.tsx
git commit -m "feat: show volume ratio metric in screener candidate details row"
```

---

### Task 5: Frontend — add volume quality dot in screener table

**Files:**
- Modify: `web-ui/src/components/domain/screener/ScreenerCandidatesTable.tsx`

- [ ] **Step 1: Add volume dot to the Signal column**

In `web-ui/src/components/domain/screener/ScreenerCandidatesTable.tsx`, find the Signal column cell (around line 155):

```tsx
              {/* Signal */}
              <td className="py-1.5 px-3">
                {badge ? (
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap ${badge.className}`}>
                    {badge.label}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </td>
```

Replace with:

```tsx
              {/* Signal */}
              <td className="py-1.5 px-3">
                <div className="flex items-center gap-1">
                  {badge ? (
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap ${badge.className}`}>
                      {badge.label}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                  {vm.volumeRatio != null && vm.volumeRatio >= 1.5 && (
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"
                      title={t('screener.details.volumeRatio.dotStrongTitle')}
                      aria-label={t('screener.details.volumeRatio.dotStrongTitle')}
                    />
                  )}
                  {vm.volumeRatio != null && vm.volumeRatio < 0.9 && (
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"
                      title={t('screener.details.volumeRatio.dotWeakTitle')}
                      aria-label={t('screener.details.volumeRatio.dotWeakTitle')}
                    />
                  )}
                </div>
              </td>
```

- [ ] **Step 2: Run typecheck**

```bash
cd web-ui && npm run typecheck
```

Expected: 0 errors

- [ ] **Step 3: Run full frontend suite**

```bash
cd web-ui && npx vitest run
```

Expected: all PASSED (no regressions in table tests)

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/components/domain/screener/ScreenerCandidatesTable.tsx
git commit -m "feat: show volume quality dot next to signal badge in screener table"
```

---

### Task 6: Final validation

- [ ] **Step 1: Run full backend suite**

```bash
pytest -q
```

Expected: all PASSED

- [ ] **Step 2: Run full frontend suite**

```bash
cd web-ui && npx vitest run
```

Expected: all PASSED

- [ ] **Step 3: Typecheck**

```bash
cd web-ui && npm run typecheck
```

Expected: 0 errors

---

## Self-review

**Spec coverage check:**

| Requirement | Covered by |
|---|---|
| `volume_ratio: float` (today / 20-bar avg) in screener output | Task 1 Steps 3, 6, 7 |
| Pure calculation from existing OHLCV — no new data source | Task 1 Step 3 (setup_quality.py) |
| Volume ratio displayed in trade plan panel | Task 4 (ScreenerCandidateDetailsRow) |
| "Volume: 1.8× avg (strong)" / "Volume: 0.7× avg (weak)" labels | Task 3 + Task 4 |
| Weak volume caution note in details panel | Task 4 (amber colour, weak label) |
| Volume quality dot (green/amber) next to signal tag in list | Task 5 |
| Field absent when volume data unavailable | Task 1 Step 3 (guarded by `avg_vol_20 > 0`) |

**Placeholder scan:** None found.

**Type consistency:** `volumeRatio` used consistently as camelCase across `ScreenerCandidate`, `CandidateViewModel`, and components. API shape uses `volume_ratio` (snake_case). Transform maps `c.volume_ratio → volumeRatio`.
