# Earnings Proximity Warning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Read `docs/superpowers/plans/handover-context.md` before starting.

**Goal:** Surface a warning on the trade plan panel and order creation modal when the next earnings date is within 10 calendar days, so the user can avoid entering trades with imminent gap risk.

**Architecture:** New backend endpoint `GET /api/portfolio/earnings-proximity/{ticker}` fetches next earnings date from `yfinance` (already in the dependency tree), caches result in-memory per ticker per calendar day, and returns `{ ticker, next_earnings_date, days_until, warning: bool }`. Frontend fetches this when a candidate is selected and shows a non-blocking amber banner. Graceful degradation: if yfinance fetch fails, return `{ warning: false }` silently.

**Tech Stack:** Python `yfinance` (already installed), FastAPI, React 18/TypeScript, MSW tests

---

## Implementation status - 2026-05-04

Status: implemented in draft PR https://github.com/matteolongo/swing_screener/pull/235.

Branch stack:

- Branch: `codex/earnings-warning`
- Base: `codex/account-equity`
- Head commit: `85abbefc`

Implemented commits:

- `1f071301 feat: add earnings proximity endpoint`
- `85abbefc feat: add earnings warning banner`

What changed:

- Added `GET /api/portfolio/earnings-proximity/{ticker}`.
- Added `EarningsProximityResponse` and `PortfolioService.get_earnings_proximity()`.
- Fetches the next earnings date from `yfinance.Ticker(...).calendar`.
- Caches earnings proximity responses in memory by ticker for the current calendar day.
- Returns `warning: false` without blocking the workflow when earnings data cannot be fetched.
- Added frontend endpoint mapping, `fetchEarningsProximity()`, and `useEarningsProximity()`.
- Added `EarningsWarningBanner` using the implemented `earningsWarning.message`, `earningsWarning.messageToday`, and `earningsWarning.messageSingular` i18n keys.
- Mounted the banner in the shared order review experience, so it appears in both the trade plan panel and candidate order modal.
- Added cache-hit test coverage proving `yfinance.Ticker` is called only once for the same ticker on the same day.

How to inspect in the UI:

- Run the backend and frontend.
- Open `http://localhost:5173/today`.
- Select a screener candidate and open the order/trade plan surface.
- If the selected ticker has earnings within 10 calendar days, an amber banner appears above the order review.
- If earnings are unknown, farther away, or the provider fails, nothing is shown.

Validation run:

- `pytest tests/api/test_earnings_proximity.py -v`
- `pytest -q`
- `cd web-ui && npm run typecheck`
- `cd web-ui && npx vitest run src/components/domain/screener/EarningsWarningBanner.test.tsx`
- `cd web-ui && npx vitest run src/components/domain/orders/CandidateOrderModal.test.tsx src/components/domain/workspace/ActionPanel.test.tsx src/components/domain/screener/EarningsWarningBanner.test.tsx`
- `cd web-ui && npx vitest run`

Review notes:

- Compare PR #235 against `codex/account-equity`.
- The warning is informational only; order creation remains allowed.
- The backend currently depends on Yahoo/yfinance calendar availability and intentionally degrades silently to avoid noisy false blockers.

## File map

| File | Change |
|---|---|
| `api/models/portfolio.py` | Add `EarningsProximityResponse` model |
| `api/routers/portfolio.py` | Add `GET /earnings-proximity/{ticker}` |
| `api/services/portfolio_service.py` | Add `get_earnings_proximity(ticker)` with in-memory cache |
| `web-ui/src/lib/api.ts` | Add endpoint path |
| `web-ui/src/features/portfolio/api.ts` | Add `fetchEarningsProximity(ticker)` |
| `web-ui/src/features/portfolio/hooks.ts` | Add `useEarningsProximity(ticker)` |
| `web-ui/src/i18n/messages.en.ts` | Add warning strings |
| `web-ui/src/components/domain/screener/TradePlanPanel.tsx` | Mount warning banner |
| `web-ui/src/components/domain/screener/EarningsWarningBanner.tsx` | New component |
| `web-ui/src/components/domain/screener/EarningsWarningBanner.test.tsx` | Tests |

---

### Task 1: Backend — earnings proximity endpoint

**Files:**
- Modify: `api/models/portfolio.py`
- Modify: `api/services/portfolio_service.py`
- Modify: `api/routers/portfolio.py`
- Test: `tests/api/test_earnings_proximity.py`

- [ ] **Step 1: Write the failing test**

Create `tests/api/test_earnings_proximity.py`:

```python
"""Tests for earnings proximity endpoint."""
import pytest
from unittest.mock import patch, MagicMock
from datetime import date, timedelta
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_earnings_within_10_days_returns_warning():
    near_date = (date.today() + timedelta(days=5)).isoformat()
    mock_ticker = MagicMock()
    mock_ticker.calendar = {"Earnings Date": [near_date]}
    with patch("yfinance.Ticker", return_value=mock_ticker):
        response = client.get("/api/portfolio/earnings-proximity/AAPL")
    assert response.status_code == 200
    data = response.json()
    assert data["warning"] is True
    assert data["days_until"] == 5
    assert data["next_earnings_date"] == near_date

def test_earnings_beyond_10_days_no_warning():
    far_date = (date.today() + timedelta(days=30)).isoformat()
    mock_ticker = MagicMock()
    mock_ticker.calendar = {"Earnings Date": [far_date]}
    with patch("yfinance.Ticker", return_value=mock_ticker):
        response = client.get("/api/portfolio/earnings-proximity/AAPL")
    assert response.status_code == 200
    data = response.json()
    assert data["warning"] is False

def test_yfinance_failure_returns_no_warning():
    with patch("yfinance.Ticker", side_effect=Exception("network error")):
        response = client.get("/api/portfolio/earnings-proximity/AAPL")
    assert response.status_code == 200
    data = response.json()
    assert data["warning"] is False
    assert data["next_earnings_date"] is None
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/api/test_earnings_proximity.py -v
```
Expected: FAIL — endpoint not found

- [ ] **Step 3: Add model to `api/models/portfolio.py`**

After the `DegiroStatus` class, add:
```python
class EarningsProximityResponse(BaseModel):
    ticker: str
    next_earnings_date: Optional[str] = None  # YYYY-MM-DD or None
    days_until: Optional[int] = None
    warning: bool = False
```

- [ ] **Step 4: Add service method to `api/services/portfolio_service.py`**

Add at module level (above the class, after imports):
```python
_earnings_cache: dict[str, tuple[str, "EarningsProximityResponse"]] = {}
# key = ticker, value = (date_fetched, response)
```

Add method to `PortfolioService`:
```python
def get_earnings_proximity(self, ticker: str) -> "EarningsProximityResponse":
    from api.utils.files import get_today_str
    from api.models.portfolio import EarningsProximityResponse
    today = get_today_str()

    if ticker in _earnings_cache:
        cached_date, cached_response = _earnings_cache[ticker]
        if cached_date == today:
            return cached_response

    try:
        import yfinance as yf
        from datetime import date
        info = yf.Ticker(ticker)
        cal = info.calendar or {}
        earnings_dates = cal.get("Earnings Date", [])
        if not earnings_dates:
            result = EarningsProximityResponse(ticker=ticker, warning=False)
            _earnings_cache[ticker] = (today, result)
            return result

        # Find next upcoming earnings date
        today_dt = date.fromisoformat(today)
        upcoming = [
            d for d in earnings_dates
            if date.fromisoformat(str(d)[:10]) >= today_dt
        ]
        if not upcoming:
            result = EarningsProximityResponse(ticker=ticker, warning=False)
            _earnings_cache[ticker] = (today, result)
            return result

        next_date = str(upcoming[0])[:10]
        days_until = (date.fromisoformat(next_date) - today_dt).days
        warning = days_until <= 10
        result = EarningsProximityResponse(
            ticker=ticker,
            next_earnings_date=next_date,
            days_until=days_until,
            warning=warning,
        )
    except Exception:
        result = EarningsProximityResponse(ticker=ticker, warning=False)

    _earnings_cache[ticker] = (today, result)
    return result
```

- [ ] **Step 5: Add route to `api/routers/portfolio.py`**

Add import at top:
```python
from api.models.portfolio import (
    ...
    EarningsProximityResponse,
)
```

Add endpoint (before DeGiro section):
```python
@router.get("/earnings-proximity/{ticker}", response_model=EarningsProximityResponse)
async def get_earnings_proximity(
    ticker: str,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Check if a ticker has earnings within the warning window (10 days)."""
    return service.get_earnings_proximity(ticker.upper())
```

- [ ] **Step 6: Run tests**

```bash
pytest tests/api/test_earnings_proximity.py -v
```
Expected: 3 PASSED

- [ ] **Step 7: Run full backend suite**

```bash
pytest -q
```

- [ ] **Step 8: Commit**

```bash
git add api/models/portfolio.py api/services/portfolio_service.py api/routers/portfolio.py tests/api/test_earnings_proximity.py
git commit -m "feat: add earnings proximity endpoint with yfinance and in-memory cache"
```

---

### Task 2: Frontend — EarningsWarningBanner component

**Files:**
- Modify: `web-ui/src/lib/api.ts`
- Modify: `web-ui/src/features/portfolio/api.ts`
- Modify: `web-ui/src/features/portfolio/hooks.ts`
- Modify: `web-ui/src/i18n/messages.en.ts`
- Create: `web-ui/src/components/domain/screener/EarningsWarningBanner.tsx`
- Create: `web-ui/src/components/domain/screener/EarningsWarningBanner.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `web-ui/src/components/domain/screener/EarningsWarningBanner.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import EarningsWarningBanner from './EarningsWarningBanner';
import { t } from '@/i18n/t';

describe('EarningsWarningBanner', () => {
  it('shows warning when earnings are within 10 days', async () => {
    server.use(
      http.get('*/api/portfolio/earnings-proximity/AAPL', () =>
        HttpResponse.json({
          ticker: 'AAPL',
          next_earnings_date: '2026-05-08',
          days_until: 5,
          warning: true,
        })
      )
    );
    renderWithProviders(<EarningsWarningBanner ticker="AAPL" />);
    expect(await screen.findByText(/5 days/i)).toBeInTheDocument();
  });

  it('renders nothing when no warning', async () => {
    server.use(
      http.get('*/api/portfolio/earnings-proximity/AAPL', () =>
        HttpResponse.json({ ticker: 'AAPL', warning: false, next_earnings_date: null, days_until: null })
      )
    );
    const { container } = renderWithProviders(<EarningsWarningBanner ticker="AAPL" />);
    // Wait for query to settle
    await new Promise(r => setTimeout(r, 100));
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when ticker is undefined', () => {
    const { container } = renderWithProviders(<EarningsWarningBanner ticker={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd web-ui && npx vitest run src/components/domain/screener/EarningsWarningBanner.test.tsx
```
Expected: FAIL — component not found

- [ ] **Step 3: Add endpoint to `web-ui/src/lib/api.ts`**

```typescript
earningsProximity: (ticker: string) => `/api/portfolio/earnings-proximity/${ticker}`,
```

- [ ] **Step 4: Add fetch function to `web-ui/src/features/portfolio/api.ts`**

```typescript
export interface EarningsProximity {
  ticker: string;
  nextEarningsDate: string | null;
  daysUntil: number | null;
  warning: boolean;
}

export async function fetchEarningsProximity(ticker: string): Promise<EarningsProximity> {
  const res = await fetch(API_ENDPOINTS.earningsProximity(ticker));
  if (!res.ok) return { ticker, nextEarningsDate: null, daysUntil: null, warning: false };
  const data = await res.json();
  return {
    ticker: data.ticker,
    nextEarningsDate: data.next_earnings_date ?? null,
    daysUntil: data.days_until ?? null,
    warning: data.warning,
  };
}
```

- [ ] **Step 5: Add hook to `web-ui/src/features/portfolio/hooks.ts`**

```typescript
export function useEarningsProximity(ticker: string | undefined) {
  return useQuery({
    queryKey: ['earnings-proximity', ticker],
    queryFn: () => fetchEarningsProximity(ticker as string),
    enabled: Boolean(ticker),
    staleTime: 1000 * 60 * 60 * 8, // 8 hours — earnings dates don't change intraday
    retry: false,
  });
}
```

- [ ] **Step 6: Add i18n strings to `web-ui/src/i18n/messages.en.ts`**

```typescript
earningsWarning: {
  message: 'Earnings in {days} days — gap risk is elevated',
  messageSingular: 'Earnings tomorrow — gap risk is elevated',
},
```

- [ ] **Step 7: Implement EarningsWarningBanner**

Create `web-ui/src/components/domain/screener/EarningsWarningBanner.tsx`:

```typescript
import { useEarningsProximity } from '@/features/portfolio/hooks';
import { t } from '@/i18n/t';

interface Props {
  ticker: string | undefined;
}

export default function EarningsWarningBanner({ ticker }: Props) {
  const { data } = useEarningsProximity(ticker);

  if (!data?.warning || !data.daysUntil) return null;

  const message = data.daysUntil === 1
    ? t('earningsWarning.messageSingular')
    : t('earningsWarning.message', { days: data.daysUntil });

  return (
    <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
      <span aria-hidden="true">⚠</span>
      <span>{message}</span>
    </div>
  );
}
```

- [ ] **Step 8: Run tests**

```bash
cd web-ui && npx vitest run src/components/domain/screener/EarningsWarningBanner.test.tsx
```
Expected: 3 PASSED

- [ ] **Step 9: Commit**

```bash
git add web-ui/src/lib/api.ts web-ui/src/features/portfolio/api.ts web-ui/src/features/portfolio/hooks.ts web-ui/src/i18n/messages.en.ts web-ui/src/components/domain/screener/EarningsWarningBanner.tsx web-ui/src/components/domain/screener/EarningsWarningBanner.test.tsx
git commit -m "feat: add EarningsWarningBanner component and hook"
```

---

### Task 3: Wire EarningsWarningBanner into the trade plan panel

**Files:**
- Identify: `web-ui/src/components/domain/screener/TradePlanPanel.tsx` (or equivalent — search with `grep -rn "TradePlan\|trade_plan\|tradePlan" web-ui/src/`)
- Modify: the panel component that shows after a screener candidate is selected

- [ ] **Step 1: Find the trade plan panel**

```bash
grep -rn "TradePlan\|trade.plan\|entry_price.*stop_price\|limit_price.*stop" web-ui/src/components/ web-ui/src/pages/ | grep -v test | head -20
```

- [ ] **Step 2: Import and mount banner**

Add import to the trade plan component:
```typescript
import EarningsWarningBanner from './EarningsWarningBanner';
```

Mount near the top of the panel content, passing the selected ticker:
```tsx
<EarningsWarningBanner ticker={selectedTicker} />
```

- [ ] **Step 3: Run full suite**

```bash
pytest -q && cd web-ui && npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/components/domain/screener/
git commit -m "feat: mount earnings warning banner in trade plan panel"
```
