# Time Stop Nudge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Read `docs/superpowers/plans/handover-context.md` before starting.

**Goal:** Show an ambient warning badge on position rows when a trade has been open too long without adequate profit, prompting the trader to make a deliberate exit/hold decision — without forcing an automatic close.

**Architecture:** Add two config fields (`time_stop_days`, `time_stop_min_r`) to `ManageConfig` in `src/swing_screener/portfolio/state.py` and `config/defaults.yaml`. Add `days_open: int` and `time_stop_warning: bool` to `PositionWithMetrics` in the API layer. The backend computes both fields in `_build_position_with_metrics()`. The frontend `PositionWithMetrics` type gains these fields and the position row component shows a coloured badge when `timeStopWarning` is `true`.

**Important distinction:** The hard `CLOSE_TIME_EXIT` action already exists in `ManageConfig` (fires in the daily review CLI workflow when `bars_since >= max_holding_days`). This feature is a **separate soft nudge** — a UI badge visible at all times in the Book page. It does NOT trigger any automatic close. It uses its own config fields (`time_stop_days` and `time_stop_min_r`) so thresholds can differ from `max_holding_days`.

**Tech Stack:** Python/FastAPI backend, React 18/TypeScript frontend

---

## Implementation status - 2026-05-04

Status: implemented on `codex/time-stop-nudge`.

Branch stack:

- Branch: `codex/time-stop-nudge`
- Base: `codex/concentration-warning`
- PR: pending

What changed:

- Added `time_stop_days` and `time_stop_min_r` manage settings with defaults of 15 days and 0.5R.
- Added `days_open` and `time_stop_warning` to portfolio position metrics.
- Daily review position rows now receive the same stale-trade warning payload.
- Book position rows and Today action rows show a small amber stale-trade badge when the warning is active.
- Strategy advanced manage settings expose the two soft time-stop thresholds.
- Local persistence mode mirrors the same derived fields.

Validation run:

- `pytest tests/api/test_time_stop_nudge.py -v`
- `cd web-ui && npx vitest run src/components/domain/workspace/PortfolioTable.test.tsx`
- `cd web-ui && npm run typecheck`

---

## File map

| File | Change |
|---|---|
| `src/swing_screener/portfolio/state.py` | Add `time_stop_days: int` and `time_stop_min_r: float` to `ManageConfig` |
| `config/defaults.yaml` | Add `time_stop_days: 15` and `time_stop_min_r: 0.5` under `manage:` |
| `api/models/portfolio.py` | Add `days_open: int` and `time_stop_warning: bool` to `PositionWithMetrics` |
| `api/services/portfolio_service.py` | Compute `days_open` and `time_stop_warning` in `_build_position_with_metrics()` |
| `web-ui/src/features/portfolio/api.ts` | Add `daysOpen`, `timeStopWarning` to `PositionWithMetricsApiResponse` and `PositionWithMetrics`; transform in `transformPositionWithMetrics()` |
| `web-ui/src/i18n/messages.en.ts` | Add `book.positions.timeStopWarning` key |
| `web-ui/src/components/domain/portfolio/PositionRow.tsx` (or wherever position rows render) | Render badge when `timeStopWarning` is true |
| `tests/api/test_time_stop_nudge.py` | Backend tests |

---

### Task 1: Backend — config fields, model fields, and computed values

**Files:**
- Modify: `src/swing_screener/portfolio/state.py`
- Modify: `config/defaults.yaml`
- Modify: `api/models/portfolio.py`
- Modify: `api/services/portfolio_service.py`
- Test: `tests/api/test_time_stop_nudge.py`

- [ ] **Step 1: Write the failing test**

Create `tests/api/test_time_stop_nudge.py`:

```python
"""Tests for the time-stop nudge feature."""
import json
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from api.main import app
import api.dependencies as deps

def make_position(entry_date_str: str, r_now_approx: float = 0.0) -> dict:
    """Build a minimal open position dict. exit_price=None => open."""
    entry_price = 100.0
    stop_price = 90.0  # 1R = 10
    shares = 10
    # Make current_price reproduce r_now_approx: current = entry + r_now * (entry - stop)
    current_price = entry_price + r_now_approx * (entry_price - stop_price)
    return {
        "position_id": "POS-TST-001",
        "ticker": "TEST",
        "status": "open",
        "entry_date": entry_date_str,
        "entry_price": entry_price,
        "stop_price": stop_price,
        "shares": shares,
        "initial_risk": 100.0,
        "current_price": current_price,
        "notes": "",
        "tags": [],
    }

@pytest.fixture
def client_with_old_flat_position(tmp_path, monkeypatch):
    """Position open 20 days at 0R — should trigger warning with defaults."""
    entry_date = (date.today() - timedelta(days=20)).isoformat()
    pos = make_position(entry_date, r_now_approx=0.0)
    positions_file = tmp_path / "positions.json"
    orders_file = tmp_path / "orders.json"
    positions_file.write_text(json.dumps({"asof": date.today().isoformat(), "positions": [pos]}))
    orders_file.write_text(json.dumps({"asof": date.today().isoformat(), "orders": []}))
    monkeypatch.setattr(deps, "_positions_path", positions_file)
    monkeypatch.setattr(deps, "_orders_path", orders_file)
    return TestClient(app)

@pytest.fixture
def client_with_new_profitable_position(tmp_path, monkeypatch):
    """Position open 5 days at 2R — should NOT trigger warning."""
    entry_date = (date.today() - timedelta(days=5)).isoformat()
    pos = make_position(entry_date, r_now_approx=2.0)
    positions_file = tmp_path / "positions.json"
    orders_file = tmp_path / "orders.json"
    positions_file.write_text(json.dumps({"asof": date.today().isoformat(), "positions": [pos]}))
    orders_file.write_text(json.dumps({"asof": date.today().isoformat(), "orders": []}))
    monkeypatch.setattr(deps, "_positions_path", positions_file)
    monkeypatch.setattr(deps, "_orders_path", orders_file)
    return TestClient(app)

def test_position_includes_days_open(client_with_old_flat_position):
    response = client_with_old_flat_position.get("/api/portfolio/positions")
    assert response.status_code == 200
    positions = response.json()["positions"]
    assert len(positions) == 1
    assert "days_open" in positions[0]
    assert positions[0]["days_open"] >= 20

def test_time_stop_warning_fires_for_old_flat_position(client_with_old_flat_position):
    response = client_with_old_flat_position.get("/api/portfolio/positions")
    positions = response.json()["positions"]
    assert positions[0]["time_stop_warning"] is True

def test_time_stop_warning_absent_for_new_profitable_position(client_with_new_profitable_position):
    response = client_with_new_profitable_position.get("/api/portfolio/positions")
    positions = response.json()["positions"]
    assert positions[0]["time_stop_warning"] is False
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/api/test_time_stop_nudge.py -v
```
Expected: FAIL — `days_open` not in response

- [ ] **Step 3: Add config fields to ManageConfig**

In `src/swing_screener/portfolio/state.py`, in class `ManageConfig` (around line 50):

```python
# Existing fields:
max_holding_days: int = 20  # time exit (hard close in daily review workflow)

# Add below:
time_stop_days: int = 15   # soft nudge threshold (UI badge only — no automatic close)
time_stop_min_r: float = 0.5  # minimum R to avoid nudge even after time_stop_days
```

- [ ] **Step 4: Add config defaults**

In `config/defaults.yaml`, under the `manage:` section, add after `max_holding_days`:

```yaml
manage:
  # ... existing keys ...
  max_holding_days: 20
  time_stop_days: 15       # days open before soft nudge appears
  time_stop_min_r: 0.5     # nudge suppressed when r_now >= this value
```

- [ ] **Step 5: Add fields to PositionWithMetrics model**

In `api/models/portfolio.py`, in class `PositionWithMetrics` (after `total_risk`):

```python
days_open: int = Field(default=0, description="Calendar days since entry_date")
time_stop_warning: bool = Field(default=False, description="True when trade is stale and underperforming")
```

- [ ] **Step 6: Compute fields in _build_position_with_metrics**

In `api/services/portfolio_service.py`, in `_build_position_with_metrics()`, after the `r_now` calculation and before the `return PositionWithMetrics(...)`:

```python
from datetime import date as _date

# Compute days_open
days_open = 0
entry_date_str = str(position.get("entry_date") or "")
if entry_date_str:
    try:
        entry_dt = _date.fromisoformat(entry_date_str)
        days_open = (_date.today() - entry_dt).days
    except ValueError:
        pass

# Read time-stop config (defaults from ManageConfig if not in strategy config)
from swing_screener.portfolio.state import ManageConfig as _ManageConfig
_manage_defaults = _ManageConfig()
from swing_screener.settings import get_settings_manager as _get_sm
_sm_manage = getattr(getattr(_get_sm().get(), "manage", None), "__dict__", {})
time_stop_days = int(_sm_manage.get("time_stop_days", _manage_defaults.time_stop_days))
time_stop_min_r = float(_sm_manage.get("time_stop_min_r", _manage_defaults.time_stop_min_r))
r_now_val = calculate_r_now(state_position, current_price_for_metrics)
time_stop_warning = (
    state_position.status == "open"
    and days_open >= time_stop_days
    and r_now_val < time_stop_min_r
)
```

Then in the `return PositionWithMetrics(...)` call, add:
```python
days_open=days_open,
time_stop_warning=time_stop_warning,
```

Note: `r_now_val` is already computed above — remove the duplicate `r_now=calculate_r_now(...)` in the return and use `r_now=r_now_val`.

- [ ] **Step 7: Run tests**

```bash
pytest tests/api/test_time_stop_nudge.py -v
```
Expected: 3 PASSED

- [ ] **Step 8: Run full backend suite**

```bash
pytest -q
```

- [ ] **Step 9: Commit**

```bash
git add src/swing_screener/portfolio/state.py config/defaults.yaml api/models/portfolio.py api/services/portfolio_service.py tests/api/test_time_stop_nudge.py
git commit -m "feat: add days_open and time_stop_warning to position metrics"
```

---

### Task 2: Frontend — display time stop warning badge

**Files:**
- Modify: `web-ui/src/features/portfolio/api.ts`
- Modify: `web-ui/src/i18n/messages.en.ts`
- Identify and modify the position row component (search `web-ui/src/` for where `rNow` or `ticker` is rendered in a list — likely `web-ui/src/components/domain/portfolio/`)

- [ ] **Step 1: Find the position row component**

```bash
grep -rn "rNow\|time_stop\|timeStop" web-ui/src/components/domain/portfolio/ | head -20
```

Note which file renders individual position rows.

- [ ] **Step 2: Add fields to frontend types**

In `web-ui/src/features/portfolio/api.ts`:

In `PositionWithMetricsApiResponse` interface (after `fees_eur`):
```typescript
days_open?: number;
time_stop_warning?: boolean;
```

In `PositionWithMetrics` interface (after `feesEur`):
```typescript
daysOpen: number;
timeStopWarning: boolean;
```

In `transformPositionWithMetrics()` (after `feesEur: data.fees_eur ?? 0`):
```typescript
daysOpen: data.days_open ?? 0,
timeStopWarning: data.time_stop_warning ?? false,
```

- [ ] **Step 3: Add i18n string**

In `web-ui/src/i18n/messages.en.ts`, locate the `book` section (search for `book:`) and add in the positions subsection:

```typescript
timeStopWarning: 'Stale trade — consider closing or setting a reason to hold',
timeStopBadge: 'Stale',
```

- [ ] **Step 4: Write a failing test**

Find the position row component filename from Step 1 (e.g. `PositionRow.tsx`). Create a test file next to it (e.g. `PositionRow.test.tsx`):

```typescript
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
// Adjust import path based on actual component found in Step 1:
import PositionRow from './PositionRow';
import type { PositionWithMetrics } from '@/features/portfolio/api';

function makePosition(overrides: Partial<PositionWithMetrics> = {}): PositionWithMetrics {
  return {
    ticker: 'TEST',
    status: 'open',
    entryDate: '2026-01-01',
    entryPrice: 100,
    stopPrice: 90,
    shares: 10,
    pnl: 0,
    pnlPercent: 0,
    rNow: 0,
    entryValue: 1000,
    currentValue: 1000,
    perShareRisk: 10,
    totalRisk: 100,
    feesEur: 0,
    daysOpen: 0,
    timeStopWarning: false,
    notes: '',
    tags: [],
    ...overrides,
  };
}

describe('PositionRow — time stop warning badge', () => {
  it('does not show warning badge when timeStopWarning is false', () => {
    renderWithProviders(<PositionRow position={makePosition({ timeStopWarning: false })} />);
    expect(screen.queryByText(t('book.positions.timeStopBadge'))).not.toBeInTheDocument();
  });

  it('shows warning badge when timeStopWarning is true', () => {
    renderWithProviders(<PositionRow position={makePosition({ timeStopWarning: true })} />);
    expect(screen.getByText(t('book.positions.timeStopBadge'))).toBeInTheDocument();
  });

  it('badge has accessible title with full warning text', () => {
    renderWithProviders(<PositionRow position={makePosition({ timeStopWarning: true })} />);
    const badge = screen.getByTitle(t('book.positions.timeStopWarning'));
    expect(badge).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run to confirm failure**

```bash
cd web-ui && npx vitest run src/components/domain/portfolio/PositionRow.test.tsx
```
Expected: FAIL — component renders without badge

- [ ] **Step 6: Add the warning badge to the position row component**

In the position row component found in Step 1, add the badge conditionally. The badge should be:
- Small, amber/yellow coloured (indicates warning, not critical error)
- Shown next to the ticker or position ID
- Has `title` attribute for the full tooltip text

```tsx
{position.timeStopWarning && (
  <span
    className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
    title={t('book.positions.timeStopWarning')}
  >
    {t('book.positions.timeStopBadge')}
  </span>
)}
```

- [ ] **Step 7: Run tests**

```bash
cd web-ui && npx vitest run src/components/domain/portfolio/PositionRow.test.tsx
```
Expected: 3 PASSED

- [ ] **Step 8: Run full suite**

```bash
pytest -q && cd web-ui && npx vitest run
```

- [ ] **Step 9: Commit**

```bash
git add web-ui/src/features/portfolio/api.ts web-ui/src/i18n/messages.en.ts web-ui/src/components/domain/portfolio/
git commit -m "feat: show time stop warning badge on stale position rows"
```
