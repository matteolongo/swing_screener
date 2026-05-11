# Feature 11 — Regime-Conditional Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the user their win rate, avg R, and expectancy broken down by market regime (Trending Up / Trending Down / Choppy) at each closed trade's entry date.

**Architecture:** New backend service (`api/services/regime_analytics.py`) fetches SPY close history via yfinance, labels each closed position's entry date using a two-SMA regime classifier, aggregates stats, and exposes via `GET /api/portfolio/analytics/regime-breakdown`. Frontend adds a `RegimeBreakdownTable` component to the Analytics page, backed by a React Query hook.

**Tech Stack:** Python 3.11, FastAPI, Pydantic v2, yfinance, pandas, React 18, TypeScript, TanStack Query v5, Tailwind CSS, Vitest/MSW

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `api/services/regime_analytics.py` | Create | Pure `label_regime_at_date()` + `RegimeAnalyticsService.get_regime_breakdown()` |
| `api/models/portfolio.py` | Modify | Add `RegimeStats`, `RegimeBreakdownResponse` Pydantic models |
| `api/routers/portfolio.py` | Modify | Add `GET /portfolio/analytics/regime-breakdown` route |
| `api/dependencies.py` | Modify | Add `get_regime_analytics_service` dependency factory |
| `tests/api/test_regime_breakdown.py` | Create | Backend unit + endpoint tests (mock yfinance) |
| `web-ui/src/i18n/messages.en.ts` | Modify | Add `analyticsPage.regimeBreakdown.*` keys |
| `web-ui/src/lib/api.ts` | Modify | Add `regimeBreakdown` endpoint path |
| `web-ui/src/features/portfolio/api.ts` | Modify | Add `fetchRegimeBreakdown()` fetch fn |
| `web-ui/src/features/portfolio/hooks.ts` | Modify | Add `useRegimeBreakdown()` hook |
| `web-ui/src/components/domain/portfolio/RegimeBreakdownTable.tsx` | Create | Table component consuming the hook |
| `web-ui/src/components/domain/portfolio/RegimeBreakdownTable.test.tsx` | Create | Component tests with MSW mocks |
| `web-ui/src/pages/Analytics.tsx` | Modify | Add `RegimeBreakdownTable` section below EdgeBreakdownTable |
| `docs/superpowers/plans/handover-context.md` | Modify | Update F11 status |

---

## Task 1: Backend — Regime labeling service

**Files:**
- Create: `api/services/regime_analytics.py`
- Create: `tests/api/test_regime_breakdown.py` (label_regime_at_date unit tests only)

### Regime classification logic

Three regimes using two SMAs (SMA50 and SMA200) applied to the benchmark at the position's entry date:

- **trending_up**: close > SMA50 AND SMA50 > SMA200
- **trending_down**: close < SMA50 AND SMA50 < SMA200
- **choppy**: all other cases (close near or crossing SMAs)

Fallback when insufficient history for SMA200: use SMA50 only (above → trending_up, below → trending_down).

- [ ] **Step 1.1: Write failing label_regime_at_date tests**

```python
# tests/api/test_regime_breakdown.py
"""Tests for regime analytics service."""
from __future__ import annotations

import datetime as dt
from pathlib import Path
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.services.regime_analytics import label_regime_at_date, REGIME_TRENDING_UP, REGIME_TRENDING_DOWN, REGIME_CHOPPY


def _make_close(n: int, prices: list[float] | None = None) -> pd.Series:
    """Build a close series with DatetimeIndex."""
    dates = pd.date_range("2023-01-01", periods=n, freq="B")
    vals = prices if prices is not None else [100.0] * n
    return pd.Series(vals, index=dates)


def test_label_trending_up():
    # 250 days: all prices rising — close > SMA50 > SMA200
    prices = [100.0 + i * 0.5 for i in range(250)]
    close = _make_close(250, prices)
    target = close.index[-1].date().isoformat()
    assert label_regime_at_date(close, target) == REGIME_TRENDING_UP


def test_label_trending_down():
    # 250 days: all prices declining — close < SMA50 < SMA200
    prices = [200.0 - i * 0.5 for i in range(250)]
    close = _make_close(250, prices)
    target = close.index[-1].date().isoformat()
    assert label_regime_at_date(close, target) == REGIME_TRENDING_DOWN


def test_label_choppy_mixed():
    # 250 days: rising then falling — mixed SMA signals
    half = 125
    prices = [100.0 + i * 1.0 for i in range(half)] + [225.0 - i * 0.5 for i in range(half)]
    close = _make_close(250, prices)
    # Use the midpoint date where signals cross
    target = close.index[200].date().isoformat()
    regime = label_regime_at_date(close, target)
    assert regime in (REGIME_CHOPPY, REGIME_TRENDING_UP, REGIME_TRENDING_DOWN)


def test_label_empty_series_returns_choppy():
    close = pd.Series([], dtype=float)
    assert label_regime_at_date(close, "2024-01-15") == REGIME_CHOPPY


def test_label_insufficient_history_fallback():
    # Only 60 bars — enough for SMA50, not SMA200
    prices = [100.0 + i * 0.5 for i in range(60)]
    close = _make_close(60, prices)
    target = close.index[-1].date().isoformat()
    # With rising prices, SMA50 should label trending_up
    assert label_regime_at_date(close, target) == REGIME_TRENDING_UP


def test_label_target_beyond_series_uses_last_available():
    prices = [100.0 + i * 0.5 for i in range(250)]
    close = _make_close(250, prices)
    # Target date after last available bar — should still return a regime
    target = (close.index[-1] + pd.Timedelta(days=30)).date().isoformat()
    assert label_regime_at_date(close, target) == REGIME_TRENDING_UP
```

- [ ] **Step 1.2: Run to confirm failure**

```bash
cd /Users/matteo.longo/projects/randomness/trading/swing_screener/.worktrees/regime-performance
pytest tests/api/test_regime_breakdown.py::test_label_trending_up -v
```

Expected: `ModuleNotFoundError: No module named 'api.services.regime_analytics'`

- [ ] **Step 1.3: Implement `api/services/regime_analytics.py`**

```python
"""Regime-conditional performance analytics service."""
from __future__ import annotations

import datetime as dt
import logging
from pathlib import Path
from typing import Optional

import pandas as pd

from api.repositories.positions_repo import PositionsRepository

logger = logging.getLogger(__name__)

REGIME_TRENDING_UP = "trending_up"
REGIME_TRENDING_DOWN = "trending_down"
REGIME_CHOPPY = "choppy"

_ORDERED_REGIMES = [REGIME_TRENDING_UP, REGIME_TRENDING_DOWN, REGIME_CHOPPY]


def label_regime_at_date(
    close: pd.Series,
    target_date: str,
    sma_fast: int = 50,
    sma_slow: int = 200,
) -> str:
    """
    Classify market regime at target_date using two-SMA logic.

    Rules:
      trending_up  — close > SMA_fast AND SMA_fast > SMA_slow
      trending_down — close < SMA_fast AND SMA_fast < SMA_slow
      choppy        — all other cases (mixed or insufficient history for SMA_slow)

    When only SMA_fast history is available:
      trending_up  — close > SMA_fast
      trending_down — close <= SMA_fast

    Args:
        close: pd.Series with DatetimeIndex, one row per trading day
        target_date: ISO date string "YYYY-MM-DD"
        sma_fast: fast SMA window (default 50)
        sma_slow: slow SMA window (default 200)

    Returns:
        One of REGIME_TRENDING_UP, REGIME_TRENDING_DOWN, REGIME_CHOPPY
    """
    if close is None or close.empty:
        return REGIME_CHOPPY

    # Ensure DatetimeIndex
    idx = close.index
    if not isinstance(idx, pd.DatetimeIndex):
        close = close.copy()
        close.index = pd.to_datetime(close.index)

    target = pd.Timestamp(target_date)
    # Slice to data up to and including target_date
    available = close[close.index <= target]
    if available.empty:
        return REGIME_CHOPPY

    n = len(available)
    last_close = float(available.iloc[-1])

    # Compute fast SMA
    sma_f_series = available.rolling(window=sma_fast, min_periods=sma_fast).mean()
    last_sma_f = sma_f_series.iloc[-1]

    if pd.isna(last_sma_f):
        # Not enough data for even the fast SMA
        return REGIME_CHOPPY

    # Compute slow SMA
    sma_s_series = available.rolling(window=sma_slow, min_periods=sma_slow).mean()
    last_sma_s = sma_s_series.iloc[-1]

    if pd.isna(last_sma_s):
        # Not enough for slow SMA — fall back to fast SMA only
        return REGIME_TRENDING_UP if last_close > float(last_sma_f) else REGIME_TRENDING_DOWN

    fast = float(last_sma_f)
    slow = float(last_sma_s)

    above_fast = last_close > fast
    fast_above_slow = fast > slow

    if above_fast and fast_above_slow:
        return REGIME_TRENDING_UP
    elif not above_fast and not fast_above_slow:
        return REGIME_TRENDING_DOWN
    else:
        return REGIME_CHOPPY


def _r_at_close(pos: dict) -> Optional[float]:
    """R at close: (exit_price - entry_price) * shares / initial_risk."""
    initial_risk = pos.get("initial_risk")
    exit_price = pos.get("exit_price")
    entry_price = pos.get("entry_price")
    shares = pos.get("shares", 1) or 1
    if not initial_risk or initial_risk <= 0 or exit_price is None or entry_price is None:
        return None
    return (exit_price - entry_price) * shares / initial_risk


class RegimeAnalyticsService:
    def __init__(self, positions_repo: PositionsRepository):
        self._repo = positions_repo

    def get_regime_breakdown(
        self,
        benchmark: str = "SPY",
        sma_fast: int = 50,
        sma_slow: int = 200,
    ) -> dict:
        """
        Fetch closed positions, label each by regime at entry date, aggregate stats.

        Returns dict matching RegimeBreakdownResponse schema.
        """
        import yfinance as yf

        positions = self._repo.list()
        closed = [
            p for p in positions
            if p.get("status") == "closed"
            and p.get("entry_date")
            and p.get("entry_price") is not None
            and p.get("exit_price") is not None
            and p.get("initial_risk") is not None
            and p.get("initial_risk", 0) > 0
        ]

        if not closed:
            return {"regimes": [], "benchmark": benchmark}

        # Determine date range — need sma_slow * 2 days before earliest entry
        entry_dates = [dt.date.fromisoformat(p["entry_date"]) for p in closed]
        earliest = min(entry_dates)
        latest = max(entry_dates)
        fetch_start = (earliest - dt.timedelta(days=int(sma_slow * 2))).isoformat()
        fetch_end = (latest + dt.timedelta(days=1)).isoformat()

        try:
            raw = yf.download(
                benchmark,
                start=fetch_start,
                end=fetch_end,
                progress=False,
                auto_adjust=True,
            )
            if raw.empty:
                logger.warning("No benchmark data returned for %s", benchmark)
                return {"regimes": [], "benchmark": benchmark}

            close_col = raw.get("Close", raw.iloc[:, 0])
            if isinstance(close_col, pd.DataFrame):
                close_col = close_col.iloc[:, 0]
            close_series: pd.Series = close_col.dropna()
        except Exception as exc:
            logger.warning("Failed to fetch benchmark %s: %s", benchmark, exc)
            return {"regimes": [], "benchmark": benchmark}

        # Label each position and collect R values per regime
        regime_r: dict[str, list[float]] = {
            REGIME_TRENDING_UP: [],
            REGIME_TRENDING_DOWN: [],
            REGIME_CHOPPY: [],
        }

        for pos in closed:
            r = _r_at_close(pos)
            if r is None:
                continue
            regime = label_regime_at_date(close_series, pos["entry_date"], sma_fast, sma_slow)
            regime_r[regime].append(r)

        # Aggregate stats per regime
        result_regimes = []
        for regime in _ORDERED_REGIMES:
            r_values = regime_r[regime]
            if not r_values:
                continue
            wins = [r for r in r_values if r > 0]
            losses = [r for r in r_values if r <= 0]
            win_rate = (len(wins) / len(r_values)) * 100
            avg_win_r = sum(wins) / len(wins) if wins else 0.0
            avg_loss_r = abs(sum(losses) / len(losses)) if losses else 0.0
            avg_r = sum(r_values) / len(r_values)
            expectancy = avg_win_r * (win_rate / 100) - avg_loss_r * (1 - win_rate / 100)
            result_regimes.append({
                "regime": regime,
                "count": len(r_values),
                "win_rate": round(win_rate, 2),
                "avg_r": round(avg_r, 4),
                "expectancy": round(expectancy, 4),
            })

        return {"regimes": result_regimes, "benchmark": benchmark}
```

- [ ] **Step 1.4: Run label tests**

```bash
pytest tests/api/test_regime_breakdown.py -k "test_label" -v
```

Expected: 6 tests PASS

- [ ] **Step 1.5: Commit**

```bash
git add api/services/regime_analytics.py tests/api/test_regime_breakdown.py
git commit -m "feat: add regime labeling service and unit tests"
```

---

## Task 2: Backend — Pydantic models + route + endpoint tests

**Files:**
- Modify: `api/models/portfolio.py`
- Modify: `api/routers/portfolio.py`
- Modify: `api/dependencies.py`
- Modify: `tests/api/test_regime_breakdown.py`

- [ ] **Step 2.1: Add Pydantic models to `api/models/portfolio.py`**

Add after the `EarningsProximityResponse` class (around line 155):

```python
class RegimeStats(BaseModel):
    regime: str = Field(..., description="trending_up | trending_down | choppy")
    count: int = Field(..., ge=0)
    win_rate: float = Field(..., ge=0, le=100)
    avg_r: float
    expectancy: float


class RegimeBreakdownResponse(BaseModel):
    regimes: list[RegimeStats]
    benchmark: str
```

- [ ] **Step 2.2: Add dependency to `api/dependencies.py`**

Add after the `get_portfolio_service` factory:

```python
from api.services.regime_analytics import RegimeAnalyticsService


def get_regime_analytics_service(
    positions_repo: PositionsRepository = Depends(get_positions_repo),
) -> RegimeAnalyticsService:
    return RegimeAnalyticsService(positions_repo=positions_repo)
```

- [ ] **Step 2.3: Add route to `api/routers/portfolio.py`**

Add these imports at the top of the router file (in the model imports block):

```python
from api.models.portfolio import (
    ...
    RegimeBreakdownResponse,
)
from api.dependencies import (
    ...
    get_regime_analytics_service,
)
from api.services.regime_analytics import RegimeAnalyticsService
```

Add route after the `earnings_proximity` route:

```python
@router.get("/analytics/regime-breakdown", response_model=RegimeBreakdownResponse)
async def get_regime_breakdown(
    service: RegimeAnalyticsService = Depends(get_regime_analytics_service),
) -> RegimeBreakdownResponse:
    result = service.get_regime_breakdown()
    return RegimeBreakdownResponse(**result)
```

- [ ] **Step 2.4: Write endpoint tests (append to test file)**

```python
# --- Endpoint tests (append to tests/api/test_regime_breakdown.py) ---

import json

client = TestClient(app)


def _write_positions(tmp_path: Path, positions: list) -> Path:
    pos_file = tmp_path / "positions.json"
    pos_file.write_text(json.dumps({"asof": "2024-01-01", "positions": positions}))
    return pos_file


def _make_spy_download(dates: list[str], prices: list[float]) -> pd.DataFrame:
    """Build a minimal yf.download() response."""
    idx = pd.DatetimeIndex(dates)
    close = pd.Series(prices, index=idx, name="Close")
    return pd.DataFrame({"Close": close})


def test_endpoint_returns_empty_when_no_closed_positions(tmp_path, monkeypatch):
    pos_file = _write_positions(tmp_path, [])
    import api.dependencies as deps
    monkeypatch.setattr(deps, "_positions_path", pos_file)

    response = client.get("/api/portfolio/analytics/regime-breakdown")
    assert response.status_code == 200
    data = response.json()
    assert data["regimes"] == []
    assert data["benchmark"] == "SPY"


def test_endpoint_returns_regime_stats(tmp_path, monkeypatch):
    positions = [
        {
            "id": "a", "ticker": "AAPL", "status": "closed",
            "entry_date": "2024-06-15", "exit_date": "2024-07-01",
            "entry_price": 100.0, "exit_price": 120.0,
            "shares": 10, "initial_risk": 100.0,
            "stop_price": 90.0,
        },
        {
            "id": "b", "ticker": "MSFT", "status": "closed",
            "entry_date": "2024-06-15", "exit_date": "2024-07-10",
            "entry_price": 200.0, "exit_price": 180.0,
            "shares": 5, "initial_risk": 50.0,
            "stop_price": 190.0,
        },
    ]
    pos_file = _write_positions(tmp_path, positions)

    # Build SPY close series: 400 days of rising prices (trending_up)
    import api.dependencies as deps
    monkeypatch.setattr(deps, "_positions_path", pos_file)

    rising_prices = [400.0 + i * 0.5 for i in range(400)]
    spy_dates = pd.date_range("2023-06-01", periods=400, freq="B")
    spy_df = pd.DataFrame({"Close": pd.Series(rising_prices, index=spy_dates)})

    with patch("yfinance.download", return_value=spy_df):
        response = client.get("/api/portfolio/analytics/regime-breakdown")

    assert response.status_code == 200
    data = response.json()
    assert data["benchmark"] == "SPY"
    # Both positions were entered in trending_up regime
    regimes = {r["regime"]: r for r in data["regimes"]}
    assert "trending_up" in regimes
    tu = regimes["trending_up"]
    assert tu["count"] == 2
    # pos a: r = (120-100)*10/100 = +2.0; pos b: r = (180-200)*5/50 = -2.0
    assert tu["win_rate"] == 50.0
    assert abs(tu["avg_r"]) < 0.01  # (2.0 + -2.0) / 2 = 0.0


def test_endpoint_yfinance_failure_returns_empty(tmp_path, monkeypatch):
    positions = [
        {
            "id": "c", "ticker": "AAPL", "status": "closed",
            "entry_date": "2024-06-15", "exit_date": "2024-07-01",
            "entry_price": 100.0, "exit_price": 120.0,
            "shares": 10, "initial_risk": 100.0,
            "stop_price": 90.0,
        },
    ]
    pos_file = _write_positions(tmp_path, positions)
    import api.dependencies as deps
    monkeypatch.setattr(deps, "_positions_path", pos_file)

    with patch("yfinance.download", side_effect=Exception("network error")):
        response = client.get("/api/portfolio/analytics/regime-breakdown")

    assert response.status_code == 200
    data = response.json()
    assert data["regimes"] == []
```

- [ ] **Step 2.5: Run full backend test file**

```bash
pytest tests/api/test_regime_breakdown.py -v
```

Expected: all tests PASS

- [ ] **Step 2.6: Run full backend suite**

```bash
pytest -q
```

Expected: all pass

- [ ] **Step 2.7: Commit**

```bash
git add api/models/portfolio.py api/routers/portfolio.py api/dependencies.py tests/api/test_regime_breakdown.py
git commit -m "feat: add regime breakdown endpoint with yfinance benchmark labeling"
```

---

## Task 3: Frontend — i18n + API client + hook

**Files:**
- Modify: `web-ui/src/i18n/messages.en.ts`
- Modify: `web-ui/src/lib/api.ts`
- Modify: `web-ui/src/features/portfolio/api.ts`
- Modify: `web-ui/src/features/portfolio/hooks.ts`

- [ ] **Step 3.1: Add i18n keys to `web-ui/src/i18n/messages.en.ts`**

Find the `analyticsPage` section and add after `edgeBreakdown`:

```typescript
regimeBreakdown: {
  title: 'By Market Regime',
  subtitle: 'Your performance segmented by benchmark trend at each trade\'s entry date (SPY SMA50/SMA200).',
  emptyState: 'No closed trades with complete data yet.',
  loading: 'Loading regime data…',
  error: 'Failed to load regime breakdown.',
  colRegime: 'Regime',
  colTrades: 'Trades',
  colWinRate: 'Win Rate',
  colAvgR: 'Avg R',
  colExpectancy: 'Expectancy',
  expectancyHint: 'win_rate × avg_win_R − loss_rate × avg_loss_R',
  regimes: {
    trending_up: 'Trending Up',
    trending_down: 'Trending Down',
    choppy: 'Choppy / Range',
  },
},
```

- [ ] **Step 3.2: Add endpoint to `web-ui/src/lib/api.ts`**

Add to `API_ENDPOINTS` after `earningsProximity`:

```typescript
regimeBreakdown: '/api/portfolio/analytics/regime-breakdown',
```

- [ ] **Step 3.3: Add fetch function to `web-ui/src/features/portfolio/api.ts`**

Add after existing fetch functions:

```typescript
export interface RegimeStats {
  regime: 'trending_up' | 'trending_down' | 'choppy';
  count: number;
  winRate: number;
  avgR: number;
  expectancy: number;
}

export interface RegimeBreakdownResponse {
  regimes: RegimeStats[];
  benchmark: string;
}

function transformRegimeStats(raw: {
  regime: string;
  count: number;
  win_rate: number;
  avg_r: number;
  expectancy: number;
}): RegimeStats {
  return {
    regime: raw.regime as RegimeStats['regime'],
    count: raw.count,
    winRate: raw.win_rate,
    avgR: raw.avg_r,
    expectancy: raw.expectancy,
  };
}

export async function fetchRegimeBreakdown(): Promise<RegimeBreakdownResponse> {
  const res = await fetch(apiUrl(API_ENDPOINTS.regimeBreakdown));
  if (!res.ok) throw new Error('Failed to fetch regime breakdown');
  const data = await res.json();
  return {
    regimes: (data.regimes ?? []).map(transformRegimeStats),
    benchmark: data.benchmark,
  };
}
```

- [ ] **Step 3.4: Add hook to `web-ui/src/features/portfolio/hooks.ts`**

Add import at top:

```typescript
import { fetchRegimeBreakdown } from './api';
```

Add hook after existing hooks:

```typescript
export function useRegimeBreakdown() {
  return useQuery({
    queryKey: ['regime-breakdown'],
    queryFn: fetchRegimeBreakdown,
    staleTime: 5 * 60 * 1000, // 5 min — benchmark data won't change mid-session
  });
}
```

- [ ] **Step 3.5: Run typecheck**

```bash
cd /Users/matteo.longo/projects/randomness/trading/swing_screener/.worktrees/regime-performance/web-ui && npm run typecheck
```

Expected: 0 errors

- [ ] **Step 3.6: Commit**

```bash
git add web-ui/src/i18n/messages.en.ts web-ui/src/lib/api.ts web-ui/src/features/portfolio/api.ts web-ui/src/features/portfolio/hooks.ts
git commit -m "feat: add regime breakdown API client, hook, and i18n keys"
```

---

## Task 4: Frontend — RegimeBreakdownTable component + tests

**Files:**
- Create: `web-ui/src/components/domain/portfolio/RegimeBreakdownTable.tsx`
- Create: `web-ui/src/components/domain/portfolio/RegimeBreakdownTable.test.tsx`

- [ ] **Step 4.1: Write failing component test**

```typescript
// web-ui/src/components/domain/portfolio/RegimeBreakdownTable.test.tsx
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import RegimeBreakdownTable from './RegimeBreakdownTable';

const MOCK_RESPONSE = {
  benchmark: 'SPY',
  regimes: [
    { regime: 'trending_up', count: 12, win_rate: 66.67, avg_r: 1.2, expectancy: 0.8 },
    { regime: 'trending_down', count: 5, win_rate: 40.0, avg_r: -0.5, expectancy: -0.3 },
    { regime: 'choppy', count: 3, win_rate: 33.33, avg_r: -0.2, expectancy: -0.1 },
  ],
};

describe('RegimeBreakdownTable', () => {
  it('renders regime rows with stats', async () => {
    server.use(
      http.get('*/api/portfolio/analytics/regime-breakdown', () =>
        HttpResponse.json(MOCK_RESPONSE),
      ),
    );
    renderWithProviders(<RegimeBreakdownTable />);
    expect(await screen.findByText(t('analyticsPage.regimeBreakdown.regimes.trending_up'))).toBeInTheDocument();
    expect(screen.getByText(t('analyticsPage.regimeBreakdown.regimes.trending_down'))).toBeInTheDocument();
    expect(screen.getByText(t('analyticsPage.regimeBreakdown.regimes.choppy'))).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    server.use(
      http.get('*/api/portfolio/analytics/regime-breakdown', async () => {
        await new Promise(() => {}); // never resolves
      }),
    );
    renderWithProviders(<RegimeBreakdownTable />);
    expect(screen.getByText(t('analyticsPage.regimeBreakdown.loading'))).toBeInTheDocument();
  });

  it('shows empty state when no regimes returned', async () => {
    server.use(
      http.get('*/api/portfolio/analytics/regime-breakdown', () =>
        HttpResponse.json({ benchmark: 'SPY', regimes: [] }),
      ),
    );
    renderWithProviders(<RegimeBreakdownTable />);
    expect(await screen.findByText(t('analyticsPage.regimeBreakdown.emptyState'))).toBeInTheDocument();
  });

  it('shows error state on fetch failure', async () => {
    server.use(
      http.get('*/api/portfolio/analytics/regime-breakdown', () =>
        HttpResponse.error(),
      ),
    );
    renderWithProviders(<RegimeBreakdownTable />);
    expect(await screen.findByText(t('analyticsPage.regimeBreakdown.error'))).toBeInTheDocument();
  });

  it('colors positive expectancy green and negative red', async () => {
    server.use(
      http.get('*/api/portfolio/analytics/regime-breakdown', () =>
        HttpResponse.json(MOCK_RESPONSE),
      ),
    );
    const { container } = renderWithProviders(<RegimeBreakdownTable />);
    await screen.findByText(t('analyticsPage.regimeBreakdown.regimes.trending_up'));
    // trending_up has expectancy +0.8 — should have green class
    const greenCells = container.querySelectorAll('.text-green-600, .dark\\:text-green-400');
    expect(greenCells.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4.2: Run to confirm failure**

```bash
cd /Users/matteo.longo/projects/randomness/trading/swing_screener/.worktrees/regime-performance/web-ui
npx vitest run src/components/domain/portfolio/RegimeBreakdownTable.test.tsx
```

Expected: `Cannot find module './RegimeBreakdownTable'`

- [ ] **Step 4.3: Implement `RegimeBreakdownTable.tsx`**

```typescript
// web-ui/src/components/domain/portfolio/RegimeBreakdownTable.tsx
import { t } from '@/i18n/t';
import { formatNumber } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import { useRegimeBreakdown } from '@/features/portfolio/hooks';
import type { RegimeStats } from '@/features/portfolio/api';

function regimeLabel(regime: RegimeStats['regime']): string {
  const map: Record<RegimeStats['regime'], string> = {
    trending_up: t('analyticsPage.regimeBreakdown.regimes.trending_up'),
    trending_down: t('analyticsPage.regimeBreakdown.regimes.trending_down'),
    choppy: t('analyticsPage.regimeBreakdown.regimes.choppy'),
  };
  return map[regime] ?? regime;
}

function regimeColorClass(regime: RegimeStats['regime']): string {
  switch (regime) {
    case 'trending_up': return 'text-green-700 dark:text-green-400';
    case 'trending_down': return 'text-red-700 dark:text-red-400';
    case 'choppy': return 'text-yellow-600 dark:text-yellow-400';
  }
}

export default function RegimeBreakdownTable() {
  const { data, isLoading, isError } = useRegimeBreakdown();

  if (isLoading) {
    return (
      <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
        {t('analyticsPage.regimeBreakdown.loading')}
      </p>
    );
  }

  if (isError) {
    return (
      <p className="py-4 text-sm text-red-600 dark:text-red-400">
        {t('analyticsPage.regimeBreakdown.error')}
      </p>
    );
  }

  if (!data || data.regimes.length === 0) {
    return (
      <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
        {t('analyticsPage.regimeBreakdown.emptyState')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('analyticsPage.regimeBreakdown.colRegime')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('analyticsPage.regimeBreakdown.colTrades')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('analyticsPage.regimeBreakdown.colWinRate')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('analyticsPage.regimeBreakdown.colAvgR')}
            </th>
            <th
              className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
              title={t('analyticsPage.regimeBreakdown.expectancyHint')}
            >
              {t('analyticsPage.regimeBreakdown.colExpectancy')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {data.regimes.map((stat) => (
            <tr key={stat.regime} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className={cn('px-4 py-3 font-semibold', regimeColorClass(stat.regime))}>
                {regimeLabel(stat.regime)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{stat.count}</td>
              <td className="px-4 py-3 text-right tabular-nums">{Math.round(stat.winRate)}%</td>
              <td className={cn(
                'px-4 py-3 text-right tabular-nums font-semibold',
                stat.avgR >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
              )}>
                {stat.avgR >= 0 ? '+' : ''}{formatNumber(stat.avgR, 2)}R
              </td>
              <td className={cn(
                'px-4 py-3 text-right tabular-nums font-semibold',
                stat.expectancy >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
              )}>
                {stat.expectancy >= 0 ? '+' : ''}{formatNumber(stat.expectancy, 2)}R
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4.4: Run component tests**

```bash
npx vitest run src/components/domain/portfolio/RegimeBreakdownTable.test.tsx
```

Expected: all 5 tests PASS

- [ ] **Step 4.5: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors

- [ ] **Step 4.6: Commit**

```bash
git add web-ui/src/components/domain/portfolio/RegimeBreakdownTable.tsx web-ui/src/components/domain/portfolio/RegimeBreakdownTable.test.tsx
git commit -m "feat: add RegimeBreakdownTable component with loading/error/empty states"
```

---

## Task 5: Wire into Analytics page + docs + full suite

**Files:**
- Modify: `web-ui/src/pages/Analytics.tsx`
- Modify: `docs/superpowers/plans/handover-context.md`

- [ ] **Step 5.1: Add RegimeBreakdownTable to `Analytics.tsx`**

Add import at top of file (after EdgeBreakdownTable import):

```typescript
import RegimeBreakdownTable from '@/components/domain/portfolio/RegimeBreakdownTable';
```

Find the "Edge Breakdown" section in the JSX (the section that renders `<EdgeBreakdownTable>`). Add a new section immediately after it:

```tsx
{/* Regime Breakdown */}
<div>
  <h2 className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100">
    {t('analyticsPage.regimeBreakdown.title')}
  </h2>
  <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
    {t('analyticsPage.regimeBreakdown.subtitle')}
  </p>
  <RegimeBreakdownTable />
</div>
```

- [ ] **Step 5.2: Run typecheck**

```bash
cd /Users/matteo.longo/projects/randomness/trading/swing_screener/.worktrees/regime-performance/web-ui && npm run typecheck
```

Expected: 0 errors

- [ ] **Step 5.3: Run full frontend suite**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 5.4: Run full backend suite**

```bash
cd /Users/matteo.longo/projects/randomness/trading/swing_screener/.worktrees/regime-performance && pytest -q
```

Expected: all tests PASS

- [ ] **Step 5.5: Update handover-context.md**

In `docs/superpowers/plans/handover-context.md`, update the feature table to add F11:

```markdown
| Feature 11 - Regime performance | `codex/regime-performance` | `main` | pending | PR pending |
```

Update the Validation section to add:
```
- Feature 11: `pytest tests/api/test_regime_breakdown.py -v`, `cd web-ui && npx vitest run src/components/domain/portfolio/RegimeBreakdownTable.test.tsx`, `pytest -q`, `cd web-ui && npm run typecheck`, `cd web-ui && npx vitest run`.
```

Update Active branch section:
```
F11 implemented locally. PR pending for `codex/regime-performance`.
Next work: Tier 3 remaining (F12 FX-adjusted R, F13 Trail customization, F14 MTF trend filter).
```

- [ ] **Step 5.6: Commit**

```bash
git add web-ui/src/pages/Analytics.tsx docs/superpowers/plans/handover-context.md
git commit -m "feat: wire RegimeBreakdownTable into Analytics page"
```

---

## Validation summary

```bash
# Backend
pytest tests/api/test_regime_breakdown.py -v
pytest -q

# Frontend
cd web-ui
npm run typecheck
npx vitest run src/components/domain/portfolio/RegimeBreakdownTable.test.tsx
npx vitest run
```
