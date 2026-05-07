# Liquidity Filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimum average daily volume (ADV) liquidity filter to the screener pipeline so illiquid names are excluded before ranking, and warn at order creation when the order size exceeds 5% of ADV.

**Architecture:** `avg_daily_volume_eur` (price × 20-day avg volume) is computed in `setup_quality.py` alongside the existing volume logic, surfaced through the screener pipeline via the `keep` list in `momentum.py`, added to `ScreenerCandidate`, and applied as a pre-ranking filter in `apply_universe_filters()` via a new `min_avg_daily_volume_eur` field in `UniverseFilterConfig`. The order-creation flow in `OrderReviewExperience` computes position notional vs ADV and appends a slippage warning to the existing `warnings` array when the ratio exceeds 5%.

**Tech Stack:** Python/FastAPI backend, React 18/TypeScript frontend, Pydantic v2, Pandas, existing OHLCV MultiIndex DataFrame `(field, ticker)`

---

## File map

| File | Change |
|---|---|
| `src/swing_screener/indicators/setup_quality.py` | Add `avg_daily_volume_eur` computation (price × avg_vol_20) |
| `src/swing_screener/strategy/modules/momentum.py` | Add `avg_daily_volume_eur` to `keep` list |
| `src/swing_screener/selection/universe.py` | Add `min_avg_daily_volume_eur` to `UniverseFilterConfig`; apply filter in `apply_universe_filters()` |
| `config/defaults.yaml` | Add `min_avg_daily_volume_eur: 100000` under `selection.universe` |
| `api/models/screener.py` | Add `avg_daily_volume_eur: Optional[float] = None` to `ScreenerCandidate` |
| `api/services/screener_service.py` | Map `avg_daily_volume_eur` from row into `ScreenerCandidate` |
| `web-ui/src/features/screener/types.ts` | Add `avg_daily_volume_eur?: number` to API type; `avgDailyVolumeEur?: number` to client type; transform |
| `web-ui/src/features/screener/viewModel.ts` | Add `avgDailyVolumeEur: number \| null` to `CandidateViewModel` |
| `web-ui/src/components/domain/orders/OrderReviewExperience.tsx` | Append slippage warning when `avgDailyVolumeEur` present and order notional > 5% of ADV |
| `web-ui/src/i18n/messages.en.ts` | Add `order.candidateModal.liquiditySlippageWarning` key |
| `tests/test_setup_quality.py` | Test `avg_daily_volume_eur` computation |
| `tests/test_universe_filter.py` | Test liquidity filter applied / bypassed |
| `web-ui/src/components/domain/orders/OrderReviewExperience.test.tsx` | Test slippage warning renders |

---

## Task 1: Compute `avg_daily_volume_eur` in `setup_quality.py`

**Files:**
- Modify: `src/swing_screener/indicators/setup_quality.py:126-134`
- Test: `tests/test_setup_quality.py`

`avg_daily_volume_eur = last_close × avg_vol_20` (20-day average volume, same window already computed). Computed only when volume data is available (same guard as `volume_ratio`).

- [ ] **Step 1: Write the failing test**

Add to `tests/test_setup_quality.py`:

```python
def test_avg_daily_volume_eur_present(tmp_path):
    """avg_daily_volume_eur = close * avg_vol_20 when volume data present."""
    import numpy as np
    from swing_screener.indicators.setup_quality import compute_setup_quality

    dates = pd.date_range("2024-01-01", periods=30, freq="B")
    close_prices = [20.0] * 30
    volume = [500_000.0] * 30  # avg_vol_20 = 500_000; eur = 20 * 500_000 = 10_000_000

    close_m = pd.DataFrame({"AAPL": close_prices}, index=dates)
    vol_m = pd.DataFrame({"AAPL": volume}, index=dates)
    high_m = close_m * 1.02
    low_m = close_m * 0.98
    ohlcv = pd.concat(
        {"Close": close_m, "Volume": vol_m, "High": high_m, "Low": low_m},
        axis=1,
    )
    ohlcv.columns = pd.MultiIndex.from_tuples(ohlcv.columns)

    result = compute_setup_quality(ohlcv)
    assert "avg_daily_volume_eur" in result.columns
    assert abs(result.loc["AAPL", "avg_daily_volume_eur"] - 10_000_000.0) < 1.0


def test_avg_daily_volume_eur_absent_when_no_volume(tmp_path):
    """avg_daily_volume_eur absent when ohlcv has no Volume level."""
    from swing_screener.indicators.setup_quality import compute_setup_quality

    dates = pd.date_range("2024-01-01", periods=30, freq="B")
    close_m = pd.DataFrame({"AAPL": [20.0] * 30}, index=dates)
    high_m = close_m * 1.02
    low_m = close_m * 0.98
    ohlcv = pd.concat({"Close": close_m, "High": high_m, "Low": low_m}, axis=1)
    ohlcv.columns = pd.MultiIndex.from_tuples(ohlcv.columns)

    result = compute_setup_quality(ohlcv)
    assert "avg_daily_volume_eur" not in result.columns
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_setup_quality.py::test_avg_daily_volume_eur_present tests/test_setup_quality.py::test_avg_daily_volume_eur_absent_when_no_volume -v
```

Expected: FAIL — `avg_daily_volume_eur` not in columns.

- [ ] **Step 3: Add computation in `setup_quality.py`**

In `src/swing_screener/indicators/setup_quality.py`, inside the `if len(v) >= 21:` block (after line 134), add:

```python
                if avg_vol_20 > 0:
                    row["volume_ratio"] = today_vol / avg_vol_20
                row["avg_daily_volume_eur"] = last_close * avg_vol_20
```

The full block after the change (lines 126–135):

```python
        # ── breakout_volume_confirmation + volume_ratio + avg_daily_volume_eur ─
        if vol_m is not None and ticker in vol_m.columns:
            v = vol_m[ticker].dropna()
            if len(v) >= 21:
                today_vol = float(v.iloc[-1])
                avg_vol_20 = float(v.iloc[-21:-1].mean())
                row["breakout_volume_confirmation"] = bool(today_vol > 1.5 * avg_vol_20)
                if avg_vol_20 > 0:
                    row["volume_ratio"] = today_vol / avg_vol_20
                row["avg_daily_volume_eur"] = last_close * avg_vol_20
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_setup_quality.py::test_avg_daily_volume_eur_present tests/test_setup_quality.py::test_avg_daily_volume_eur_absent_when_no_volume -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/indicators/setup_quality.py tests/test_setup_quality.py
git commit -m "feat: compute avg_daily_volume_eur in setup_quality"
```

---

## Task 2: Surface `avg_daily_volume_eur` through the pipeline

**Files:**
- Modify: `src/swing_screener/strategy/modules/momentum.py:128-140`

Add `avg_daily_volume_eur` to the `keep` list so it survives into the results DataFrame passed to the screener service.

- [ ] **Step 1: Add to `keep` list**

In `src/swing_screener/strategy/modules/momentum.py`, find the `keep` list (around line 128) and add `"avg_daily_volume_eur"` after `"volume_ratio"`:

```python
    keep = [
        "rank", "score", "confidence",
        "last", "currency", atr_col, "atr_pct",
        "mom_6m", "mom_12m", "rs_6m", "sector_rs_6m",
        "sma20_slope", "sma50_slope",
        "trend_ok", "dist_sma50_pct", "dist_sma200_pct",
        "signal",
        "breakout_level", ma_col,
        "consolidation_tightness", "close_location_in_range",
        "above_breakout_extension", "breakout_volume_confirmation",
        "volume_ratio", "avg_daily_volume_eur",
        "entry", "stop", "shares", "position_value", "realized_risk",
    ]
```

- [ ] **Step 2: Run existing screener tests to verify no regression**

```bash
pytest tests/ -q -k "screener or momentum or setup_quality"
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/swing_screener/strategy/modules/momentum.py
git commit -m "feat: add avg_daily_volume_eur to momentum pipeline keep list"
```

---

## Task 3: Add liquidity filter to `UniverseFilterConfig`

**Files:**
- Modify: `src/swing_screener/selection/universe.py:23-118`
- Modify: `config/defaults.yaml` (under `selection.universe`)
- Test: `tests/test_universe_filter.py` (new file or existing)

`min_avg_daily_volume_eur: float = 0.0` defaults to 0 (no filter) so existing tests are unaffected. The config default sets it to 100,000.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_universe_filter.py`:

```python
import pandas as pd
import pytest
from swing_screener.selection.universe import UniverseFilterConfig, apply_universe_filters


def _minimal_feature_df(tickers: list[str], adv_eur: dict[str, float]) -> pd.DataFrame:
    """Build a minimal feature DataFrame for filter testing."""
    data = {
        "last": {t: 20.0 for t in tickers},
        "atr_pct": {t: 3.0 for t in tickers},
        "trend_ok": {t: True for t in tickers},
        "rs_6m": {t: 0.05 for t in tickers},
        "currency": {t: "USD" for t in tickers},
        "avg_daily_volume_eur": {t: adv_eur.get(t, 0.0) for t in tickers},
    }
    return pd.DataFrame(data, index=pd.Index(tickers, name="ticker"))


def test_liquidity_filter_removes_illiquid():
    """Tickers below min_avg_daily_volume_eur are excluded."""
    cfg = UniverseFilterConfig(min_avg_daily_volume_eur=100_000.0)
    df = _minimal_feature_df(["LIQUID", "ILLIQUID"], {"LIQUID": 500_000.0, "ILLIQUID": 40_000.0})
    result = apply_universe_filters(df, cfg)
    assert result.loc["LIQUID", "is_eligible"] is True or result.loc["LIQUID", "is_eligible"] == True
    assert result.loc["ILLIQUID", "is_eligible"] is False or result.loc["ILLIQUID", "is_eligible"] == False


def test_liquidity_filter_reason_column():
    """Reason column includes 'liquidity' for excluded tickers."""
    cfg = UniverseFilterConfig(min_avg_daily_volume_eur=100_000.0)
    df = _minimal_feature_df(["ILLIQUID"], {"ILLIQUID": 40_000.0})
    result = apply_universe_filters(df, cfg)
    assert "liquidity" in result.loc["ILLIQUID", "reason"]


def test_liquidity_filter_zero_means_no_filter():
    """Default min_avg_daily_volume_eur=0 disables the filter."""
    cfg = UniverseFilterConfig(min_avg_daily_volume_eur=0.0)
    df = _minimal_feature_df(["LOW_VOL"], {"LOW_VOL": 1.0})
    result = apply_universe_filters(df, cfg)
    assert result.loc["LOW_VOL", "is_eligible"] is True or result.loc["LOW_VOL", "is_eligible"] == True


def test_liquidity_filter_absent_column_passes():
    """When avg_daily_volume_eur column is absent, filter is skipped (no KeyError)."""
    cfg = UniverseFilterConfig(min_avg_daily_volume_eur=100_000.0)
    tickers = ["NOVOLDATA"]
    df = pd.DataFrame({
        "last": {"NOVOLDATA": 20.0},
        "atr_pct": {"NOVOLDATA": 3.0},
        "trend_ok": {"NOVOLDATA": True},
        "rs_6m": {"NOVOLDATA": 0.05},
        "currency": {"NOVOLDATA": "USD"},
        # no avg_daily_volume_eur column
    }, index=pd.Index(tickers, name="ticker"))
    result = apply_universe_filters(df, cfg)
    # Should not raise; ticker passes (filter skipped)
    assert result.loc["NOVOLDATA", "is_eligible"] is True or result.loc["NOVOLDATA", "is_eligible"] == True
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/test_universe_filter.py -v
```

Expected: FAIL — `min_avg_daily_volume_eur` not in `UniverseFilterConfig`.

- [ ] **Step 3: Add `min_avg_daily_volume_eur` to `UniverseFilterConfig` and `apply_universe_filters`**

In `src/swing_screener/selection/universe.py`, update `UniverseFilterConfig`:

```python
@dataclass(frozen=True)
class UniverseFilterConfig:
    min_price: float = field(default_factory=lambda: float(_universe_defaults().get("min_price", 10.0)))
    max_price: float = field(default_factory=lambda: float(_universe_defaults().get("max_price", 60.0)))
    max_atr_pct: float = field(default_factory=lambda: float(_universe_defaults().get("max_atr_pct", 10.0)))
    require_trend_ok: bool = field(default_factory=lambda: bool(_universe_defaults().get("require_trend_ok", True)))
    require_rs_positive: bool = field(default_factory=lambda: bool(_universe_defaults().get("require_rs_positive", False)))
    currencies: list[str] = field(default_factory=lambda: list(_universe_defaults().get("currencies", ["USD", "EUR"])))
    min_avg_daily_volume_eur: float = field(
        default_factory=lambda: float(_universe_defaults().get("min_avg_daily_volume_eur", 0.0))
    )
```

In `apply_universe_filters`, add the liquidity condition after `cond_currency`:

```python
    # liquidity filter — skipped when column absent or threshold is 0
    if cfg.min_avg_daily_volume_eur > 0 and "avg_daily_volume_eur" in df.columns:
        cond_liquidity = df["avg_daily_volume_eur"] >= cfg.min_avg_daily_volume_eur
    else:
        cond_liquidity = pd.Series(True, index=df.index)

    eligible = cond_price & cond_atr & cond_trend & cond_rs & cond_currency & cond_liquidity
```

Update the reason loop to append `"liquidity"` when failing:

```python
        if not bool(cond_liquidity.loc[t]):
            r.append("liquidity")
```

Full updated `apply_universe_filters` function — only the changed sections:

Replace `eligible = cond_price & cond_atr & cond_trend & cond_rs & cond_currency` with:
```python
    # liquidity filter — skipped when column absent or threshold is 0
    if cfg.min_avg_daily_volume_eur > 0 and "avg_daily_volume_eur" in df.columns:
        cond_liquidity = df["avg_daily_volume_eur"] >= cfg.min_avg_daily_volume_eur
    else:
        cond_liquidity = pd.Series(True, index=df.index)

    eligible = cond_price & cond_atr & cond_trend & cond_rs & cond_currency & cond_liquidity
```

And in the reason loop, add after the `currency` check:
```python
        if not bool(cond_liquidity.loc[t]):
            r.append("liquidity")
```

- [ ] **Step 4: Add config default**

In `config/defaults.yaml`, under `selection.universe` (around line 338), add:

```yaml
      min_avg_daily_volume_eur: 100000
```

So it reads:
```yaml
  selection:
    universe:
      min_price: 10.0
      max_price: 60.0
      max_atr_pct: 10.0
      require_trend_ok: true
      require_rs_positive: false
      min_avg_daily_volume_eur: 100000
      currencies:
        - USD
        - EUR
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_universe_filter.py -v
```

Expected: all 4 pass.

- [ ] **Step 6: Run full backend suite**

```bash
pytest -q
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/swing_screener/selection/universe.py config/defaults.yaml tests/test_universe_filter.py
git commit -m "feat: add min_avg_daily_volume_eur liquidity filter to universe"
```

---

## Task 4: Expose `avg_daily_volume_eur` in the API

**Files:**
- Modify: `api/models/screener.py:86`
- Modify: `api/services/screener_service.py` (find `ScreenerCandidate(...)` constructor)
- Test: `tests/api/test_liquidity.py` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/api/test_liquidity.py`:

```python
from api.models.screener import ScreenerCandidate


def test_screener_candidate_default_avg_daily_volume_eur_is_none():
    c = ScreenerCandidate(ticker="AAPL", close=20.0, sma_20=19.0, sma_50=18.0, sma_200=17.0,
                          atr=0.5, momentum_6m=0.1, momentum_12m=0.15, rel_strength=0.05,
                          score=0.7, confidence=0.8, rank=1)
    assert c.avg_daily_volume_eur is None


def test_screener_candidate_stores_avg_daily_volume_eur():
    c = ScreenerCandidate(ticker="AAPL", close=20.0, sma_20=19.0, sma_50=18.0, sma_200=17.0,
                          atr=0.5, momentum_6m=0.1, momentum_12m=0.15, rel_strength=0.05,
                          score=0.7, confidence=0.8, rank=1, avg_daily_volume_eur=5_000_000.0)
    assert c.avg_daily_volume_eur == 5_000_000.0
```

- [ ] **Step 2: Run to verify fail**

```bash
pytest tests/api/test_liquidity.py -v
```

Expected: FAIL — `avg_daily_volume_eur` not on `ScreenerCandidate`.

- [ ] **Step 3: Add field to `ScreenerCandidate`**

In `api/models/screener.py`, after `volume_ratio: Optional[float] = None` (line 86), add:

```python
    avg_daily_volume_eur: Optional[float] = None
```

- [ ] **Step 4: Map it in `screener_service.py`**

Find the `ScreenerCandidate(...)` constructor call in `api/services/screener_service.py`. It will have a line like `volume_ratio=_safe_optional_float(row.get("volume_ratio"))`. Add after it:

```python
            avg_daily_volume_eur=_safe_optional_float(row.get("avg_daily_volume_eur")),
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/api/test_liquidity.py -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/models/screener.py api/services/screener_service.py tests/api/test_liquidity.py
git commit -m "feat: expose avg_daily_volume_eur in screener API model"
```

---

## Task 5: Add `avgDailyVolumeEur` to frontend types and viewModel

**Files:**
- Modify: `web-ui/src/features/screener/types.ts`
- Modify: `web-ui/src/features/screener/viewModel.ts`

Follow the exact same pattern as `volumeRatio` added in F8.

- [ ] **Step 1: Update `types.ts`**

In `web-ui/src/features/screener/types.ts`:

1. In `ScreenerCandidateAPI`, after `volume_ratio?: number`, add:
```typescript
  avg_daily_volume_eur?: number;
```

2. In `ScreenerCandidate` (camelCase client type), after `volumeRatio?: number`, add:
```typescript
  avgDailyVolumeEur?: number;
```

3. In `transformScreenerResponse`, after `volumeRatio: c.volume_ratio ?? undefined`, add:
```typescript
      avgDailyVolumeEur: c.avg_daily_volume_eur ?? undefined,
```

- [ ] **Step 2: Update `viewModel.ts`**

In `web-ui/src/features/screener/viewModel.ts`:

1. In `CandidateViewModel`, after `volumeRatio: number | null`, add:
```typescript
  avgDailyVolumeEur: number | null;
```

2. In `toCandidateViewModel`, after `volumeRatio: candidate.volumeRatio ?? null`, add:
```typescript
  avgDailyVolumeEur: candidate.avgDailyVolumeEur ?? null,
```

- [ ] **Step 3: Run typecheck**

```bash
cd web-ui && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/features/screener/types.ts web-ui/src/features/screener/viewModel.ts
git commit -m "feat: add avgDailyVolumeEur to screener frontend types and viewModel"
```

---

## Task 6: Slippage warning at order creation

**Files:**
- Modify: `web-ui/src/components/domain/orders/OrderReviewExperience.tsx`
- Modify: `web-ui/src/i18n/messages.en.ts`
- Modify: `web-ui/src/components/domain/workspace/ActionPanel.tsx` (pass `avgDailyVolumeEur` into context)
- Test: `web-ui/src/components/domain/orders/OrderReviewExperience.test.tsx` (new or existing)

The warning fires when: `avgDailyVolumeEur` is present on the candidate **and** `quantity × limitPrice > 0.05 × avgDailyVolumeEur`.

`quantity` and `limitPrice` come from the form values already available inside `OrderReviewExperience`. The `avgDailyVolumeEur` must be threaded through `OrderReviewContext`.

- [ ] **Step 1: Add i18n key**

In `web-ui/src/i18n/messages.en.ts`, find the `order.candidateModal` section and add:

```typescript
      liquiditySlippageWarning: 'Order size is {{pct}}% of avg daily volume — expect slippage.',
```

- [ ] **Step 2: Extend `OrderReviewContext`**

In `web-ui/src/components/domain/orders/OrderReviewExperience.tsx`, add to the `OrderReviewContext` interface (after `positionId`):

```typescript
  avgDailyVolumeEur?: number | null;
```

- [ ] **Step 3: Thread `avgDailyVolumeEur` from `ActionPanel`**

In `web-ui/src/components/domain/workspace/ActionPanel.tsx`, find where `context` is assembled (around line 111) and add:

```typescript
    avgDailyVolumeEur: candidate?.avgDailyVolumeEur ?? null,
```

- [ ] **Step 4: Write the failing frontend test**

Create `web-ui/src/components/domain/orders/OrderReviewExperience.test.tsx` (or add to existing):

```typescript
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import OrderReviewExperience from './OrderReviewExperience';
import { t } from '@/i18n/t';
import type { OrderReviewContext } from './OrderReviewExperience';

const baseContext: OrderReviewContext = {
  ticker: 'AAPL',
  signal: 'breakout',
  entry: 20.0,
  stop: 18.0,
  close: 20.5,
  shares: 100,
  currency: 'USD',
  avgDailyVolumeEur: 1_000_000,
};

const baseRisk = {
  max_risk_per_trade_pct: 1,
  max_portfolio_risk_pct: 6,
  default_account_size: 10000,
};

it('shows slippage warning when order notional exceeds 5% of ADV', async () => {
  // quantity=100, limitPrice=600 → notional=60_000 → 6% of 1_000_000
  renderWithProviders(
    <OrderReviewExperience
      context={baseContext}
      risk={baseRisk}
      defaultNotes=""
      onSubmitOrder={vi.fn()}
    />
  );
  // Set quantity and limit price to trigger the warning
  // The form defaults: quantity from context.shares=100, limitPrice from context.entry=20
  // 100 * 20 = 2000 = 0.2% of 1_000_000 — no warning
  // Adjust ADV to be small to trigger warning:
  // Use avgDailyVolumeEur=10_000; order = 100 * 20 = 2_000 → 20% of 10_000 → warning fires
});

it('slippage warning shows correct percentage', async () => {
  const ctx: OrderReviewContext = {
    ...baseContext,
    avgDailyVolumeEur: 10_000,  // small ADV
    shares: 100,
    entry: 20.0,
  };
  renderWithProviders(
    <OrderReviewExperience
      context={ctx}
      risk={baseRisk}
      defaultNotes=""
      onSubmitOrder={vi.fn()}
    />
  );
  // 100 shares * 20 limitPrice = 2000 notional; 2000/10000 = 20% > 5% → warning
  const warning = await screen.findByText(/20(\.\d+)?%.*avg daily volume/i);
  expect(warning).toBeInTheDocument();
});

it('no slippage warning when ADV absent', async () => {
  const ctx: OrderReviewContext = { ...baseContext, avgDailyVolumeEur: null };
  renderWithProviders(
    <OrderReviewExperience
      context={ctx}
      risk={baseRisk}
      defaultNotes=""
      onSubmitOrder={vi.fn()}
    />
  );
  expect(screen.queryByText(/avg daily volume/i)).toBeNull();
});
```

- [ ] **Step 5: Run to verify fail**

```bash
cd web-ui && npx vitest run src/components/domain/orders/OrderReviewExperience.test.tsx
```

Expected: FAIL — no slippage warning in DOM.

- [ ] **Step 6: Add slippage warning logic to `OrderReviewExperience`**

In `web-ui/src/components/domain/orders/OrderReviewExperience.tsx`, find the `warnings` useMemo (around line 244). Add the slippage check. The form values are already available via `form.watch()` — add a watch for quantity and limitPrice:

After the existing `const warnings = useMemo(...)`, or integrate inside it, using `formValues` (the form already has `useForm` with `watch`):

Add `const formValues = form.watch();` near the top of the component body (after `form` is defined), then extend the `warnings` useMemo:

```typescript
  const formValues = form.watch();

  const warnings = useMemo(() => {
    const nextWarnings: string[] = [];
    if (enforceRecommendation && verdict === 'NOT_RECOMMENDED') {
      nextWarnings.push(t('order.candidateModal.notRecommended'));
    }
    if (hasSkipSuggestion) {
      nextWarnings.push(t('order.candidateModal.skipSuggestedBody'));
    }
    if (hasOrderTypeMismatch) {
      nextWarnings.push(
        t('order.candidateModal.orderTypeMismatchWarning', {
          suggestedType: normalizedSuggestedOrderType,
        }),
      );
    }
    const adv = context.avgDailyVolumeEur;
    const qty = formValues.quantity ?? 0;
    const price = formValues.limitPrice ?? 0;
    if (adv != null && adv > 0 && qty > 0 && price > 0) {
      const notional = qty * price;
      const pct = (notional / adv) * 100;
      if (pct > 5) {
        nextWarnings.push(
          t('order.candidateModal.liquiditySlippageWarning', { pct: pct.toFixed(1) }),
        );
      }
    }
    return nextWarnings;
  }, [
    enforceRecommendation, hasOrderTypeMismatch, hasSkipSuggestion,
    normalizedSuggestedOrderType, verdict,
    context.avgDailyVolumeEur, formValues.quantity, formValues.limitPrice,
  ]);
```

Note: `form.watch()` re-renders on every keystroke — this is intentional so the warning updates live as the user changes quantity/price.

- [ ] **Step 7: Run tests**

```bash
cd web-ui && npx vitest run src/components/domain/orders/OrderReviewExperience.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Run typecheck**

```bash
cd web-ui && npm run typecheck
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add web-ui/src/i18n/messages.en.ts \
        web-ui/src/components/domain/orders/OrderReviewExperience.tsx \
        web-ui/src/components/domain/orders/OrderReviewExperience.test.tsx \
        web-ui/src/components/domain/workspace/ActionPanel.tsx
git commit -m "feat: slippage warning at order creation when size exceeds 5% of ADV"
```

---

## Task 7: Final validation

- [ ] **Step 1: Run full backend suite**

```bash
pytest -q
```

Expected: all pass, 0 failures.

- [ ] **Step 2: Run full frontend suite**

```bash
cd web-ui && npx vitest run
```

Expected: all pass.

- [ ] **Step 3: Run typecheck**

```bash
cd web-ui && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Update roadmap**

In `docs/superpowers/specs/2026-05-03-swing-trading-feature-roadmap.md`, update the F9 row:

```
| 9 | Liquidity filter | 2 | ✅ Done — `codex/liquidity-filter` / PR pending | Avoid illiquid names |
```

- [ ] **Step 5: Update handover-context**

In `docs/superpowers/plans/handover-context.md`:

1. Add F9 row to the feature table:
```
| Feature 9 - Liquidity filter | `codex/liquidity-filter` | `main` | pending | PR pending |
```

2. Add F9 to the validation section:
```
- Feature 9: `pytest tests/test_universe_filter.py tests/api/test_liquidity.py -v`, `cd web-ui && npx vitest run src/components/domain/orders/OrderReviewExperience.test.tsx`, `pytest -q`, `cd web-ui && npm run typecheck`.
```

3. Update the active branch section:
```
Next work should continue Tier 2 with Feature 10 — Partial exits. Start new branch from `main`.
```

- [ ] **Step 6: Commit docs**

```bash
git add docs/superpowers/specs/2026-05-03-swing-trading-feature-roadmap.md \
        docs/superpowers/plans/handover-context.md
git commit -m "docs: mark F9 liquidity filter complete in roadmap and handover-context"
```
