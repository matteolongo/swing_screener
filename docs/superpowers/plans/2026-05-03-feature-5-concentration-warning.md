# Portfolio Concentration Warning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Read `docs/superpowers/plans/handover-context.md` before starting.

**Goal:** Show the user when their open risk is over-concentrated in a single country/exchange, so they don't stack correlated bets unknowingly.

**Architecture:** Country is derived from ticker suffix (`.AS` = NL, `.PA` = FR, `.DE` = DE, `.MC` = ES, `.MI` = IT, `.ST` = SE, no suffix = US). Concentration is `sum(initial_risk for positions in group) / total_open_risk * 100`. Added as a new field on `PortfolioSummary`. Frontend shows a concentration row on the portfolio summary; order creation modal warns if new order would push a group over 60%.

**Tech Stack:** Python backend (pure calculation, no new data source), React 18/TypeScript frontend, config for threshold

---

## Implementation Status - 2026-05-04

**Branch:** `codex/concentration-warning`  
**Base:** `codex/earnings-warning`  
**PR:** https://github.com/matteolongo/swing_screener/pull/236  
**Status:** Draft PR opened, implemented.

**Implemented:**
- Backend `PortfolioSummary` now includes `concentration` groups sorted by open risk share.
- Country/exchange grouping is derived from ticker suffixes and uses the configured `max_concentration_pct` threshold.
- Book > Positions now shows a `ConcentrationBar` below the portfolio risk chips when open risk exists.
- Local persistence mode computes the same concentration summary shape as the API path.

**Validation run:**
- `pytest tests/api/test_concentration.py -v`
- `cd web-ui && npx vitest run src/components/domain/portfolio/ConcentrationBar.test.tsx`
- `cd web-ui && npm run typecheck`
- `pytest -q`
- `cd web-ui && npx vitest run`

---

## File map

| File | Change |
|---|---|
| `api/models/portfolio.py` | Add `ConcentrationGroup`, `concentration` to `PortfolioSummary` |
| `api/services/portfolio_service.py` | Compute concentration in `get_portfolio_summary` |
| `config/defaults.yaml` | Add `max_concentration_pct: 60` under `risk:` |
| `web-ui/src/i18n/messages.en.ts` | Add concentration strings |
| `web-ui/src/features/portfolio/types.ts` | Add concentration types |
| `web-ui/src/components/domain/portfolio/ConcentrationBar.tsx` | New — shows top concentration group |
| `web-ui/src/components/domain/portfolio/ConcentrationBar.test.tsx` | Tests |
| `web-ui/src/pages/Book.tsx` or portfolio summary area | Mount ConcentrationBar |

---

### Task 1: Backend — compute concentration and add to PortfolioSummary

**Files:**
- Modify: `api/models/portfolio.py`
- Modify: `api/services/portfolio_service.py`
- Modify: `config/defaults.yaml`
- Test: `tests/api/test_concentration.py`

- [x] **Step 1: Write the failing test**

Create `tests/api/test_concentration.py`:

```python
"""Tests for portfolio concentration warning."""
import json
import pytest
from fastapi.testclient import TestClient
from api.main import app
import api.dependencies as deps

NL_POSITIONS = [
    {
        "position_id": "POS-SBMO", "ticker": "SBMO.AS", "status": "open",
        "entry_date": "2026-01-01", "entry_price": 34.0, "stop_price": 33.0,
        "shares": 10, "initial_risk": 10.0, "notes": "", "tags": [],
    },
    {
        "position_id": "POS-ALLF", "ticker": "ALLF.AS", "status": "open",
        "entry_date": "2026-01-01", "entry_price": 10.0, "stop_price": 9.0,
        "shares": 5, "initial_risk": 5.0, "notes": "", "tags": [],
    },
    {
        "position_id": "POS-AAPL", "ticker": "AAPL", "status": "open",
        "entry_date": "2026-01-01", "entry_price": 100.0, "stop_price": 95.0,
        "shares": 1, "initial_risk": 5.0, "notes": "", "tags": [],
    },
]
# NL risk = 15, US risk = 5, total = 20, NL concentration = 75%

@pytest.fixture
def client_with_positions(tmp_path, monkeypatch):
    positions_file = tmp_path / "positions.json"
    orders_file = tmp_path / "orders.json"
    positions_file.write_text(json.dumps({"asof": "2026-01-01", "positions": NL_POSITIONS}))
    orders_file.write_text(json.dumps({"asof": "2026-01-01", "orders": []}))
    monkeypatch.setattr(deps, "_positions_path", positions_file)
    monkeypatch.setattr(deps, "_orders_path", orders_file)
    return TestClient(app)

def test_concentration_included_in_summary(client_with_positions):
    response = client_with_positions.get("/api/portfolio/summary")
    assert response.status_code == 200
    data = response.json()
    assert "concentration" in data
    assert len(data["concentration"]) > 0

def test_concentration_correct_pct(client_with_positions):
    response = client_with_positions.get("/api/portfolio/summary")
    data = response.json()
    groups = {g["country"]: g for g in data["concentration"]}
    assert "NL" in groups
    assert abs(groups["NL"]["risk_pct"] - 75.0) < 1.0

def test_concentration_warning_flag_when_above_threshold(client_with_positions):
    response = client_with_positions.get("/api/portfolio/summary")
    data = response.json()
    groups = {g["country"]: g for g in data["concentration"]}
    assert groups["NL"]["warning"] is True  # 75% > 60% threshold
```

- [x] **Step 2: Run to confirm failure**

```bash
pytest tests/api/test_concentration.py -v
```
Expected: FAIL — `concentration` not in response

- [x] **Step 3: Add models to `api/models/portfolio.py`**

After `EarningsProximityResponse`, add:
```python
class ConcentrationGroup(BaseModel):
    country: str
    risk_amount: float
    risk_pct: float  # 0–100
    position_count: int
    warning: bool

# Add to PortfolioSummary (after win_rate):
concentration: list[ConcentrationGroup] = Field(default_factory=list)
```

- [x] **Step 4: Add country derivation helper and concentration computation**

In `api/services/portfolio_service.py`, add module-level function:
```python
def _country_from_ticker(ticker: str) -> str:
    """Derive country code from ticker suffix."""
    SUFFIX_MAP = {
        ".AS": "NL", ".PA": "FR", ".DE": "DE", ".MC": "ES",
        ".MI": "IT", ".ST": "SE", ".L": "UK", ".BR": "BE",
        ".LS": "PT", ".HE": "FI", ".CO": "DK", ".OL": "NO",
    }
    upper = ticker.upper()
    for suffix, country in SUFFIX_MAP.items():
        if upper.endswith(suffix):
            return country
    return "US"
```

In `get_portfolio_summary`, after computing `open_risk`, add:
```python
# Compute concentration by country
from collections import defaultdict
country_risk: dict[str, float] = defaultdict(float)
country_count: dict[str, int] = defaultdict(int)
for position in positions:
    if position.total_risk > 0:
        country = _country_from_ticker(position.ticker)
        country_risk[country] += position.total_risk
        country_count[country] += 1

settings = get_settings_manager().get()
max_conc_pct = float(getattr(settings.risk, "max_concentration_pct", 60.0))
concentration_groups = []
for country, risk_amount in sorted(country_risk.items(), key=lambda x: -x[1]):
    risk_pct = (risk_amount / open_risk * 100.0) if open_risk > 0 else 0.0
    concentration_groups.append(ConcentrationGroup(
        country=country,
        risk_amount=risk_amount,
        risk_pct=risk_pct,
        position_count=country_count[country],
        warning=risk_pct >= max_conc_pct,
    ))
```

Add `concentration=concentration_groups` to the `PortfolioSummary(...)` return.

Import `ConcentrationGroup` at top of service file.

- [x] **Step 5: Add config to `config/defaults.yaml`**

Under `risk:`, add:
```yaml
max_concentration_pct: 60
```

- [x] **Step 6: Run tests**

```bash
pytest tests/api/test_concentration.py -v
```
Expected: 3 PASSED

- [x] **Step 7: Commit**

```bash
git add api/models/portfolio.py api/services/portfolio_service.py config/defaults.yaml tests/api/test_concentration.py
git commit -m "feat: add portfolio concentration by country to portfolio summary"
```

---

### Task 2: Frontend — ConcentrationBar component

**Files:**
- Modify: `web-ui/src/i18n/messages.en.ts`
- Modify: `web-ui/src/features/portfolio/types.ts` (add concentration types)
- Create: `web-ui/src/components/domain/portfolio/ConcentrationBar.tsx`
- Create: `web-ui/src/components/domain/portfolio/ConcentrationBar.test.tsx`

- [x] **Step 1: Write the failing test**

Create `web-ui/src/components/domain/portfolio/ConcentrationBar.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import ConcentrationBar from './ConcentrationBar';
import { t } from '@/i18n/t';

const highConcentration = [
  { country: 'NL', riskAmount: 75, riskPct: 75, positionCount: 3, warning: true },
  { country: 'US', riskAmount: 25, riskPct: 25, positionCount: 1, warning: false },
];

const lowConcentration = [
  { country: 'NL', riskAmount: 40, riskPct: 40, positionCount: 2, warning: false },
  { country: 'US', riskAmount: 60, riskPct: 60, positionCount: 3, warning: false },
];

describe('ConcentrationBar', () => {
  it('renders nothing when no concentration data', () => {
    const { container } = renderWithProviders(<ConcentrationBar groups={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows top concentration group', () => {
    renderWithProviders(<ConcentrationBar groups={highConcentration} />);
    expect(screen.getByText(/NL/)).toBeInTheDocument();
    expect(screen.getByText(/75%/)).toBeInTheDocument();
  });

  it('shows amber styling when warning is true', () => {
    renderWithProviders(<ConcentrationBar groups={highConcentration} />);
    const el = screen.getByText(/NL/).closest('[data-warning]');
    expect(el).toHaveAttribute('data-warning', 'true');
  });

  it('shows no warning styling when below threshold', () => {
    renderWithProviders(<ConcentrationBar groups={lowConcentration} />);
    // US is top at 60%, no warning
    expect(screen.queryByText(/concentrated/i)).not.toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run to confirm failure**

```bash
cd web-ui && npx vitest run src/components/domain/portfolio/ConcentrationBar.test.tsx
```
Expected: FAIL

- [x] **Step 3: Add i18n strings**

```typescript
// In messages.en.ts:
concentrationBar: {
  label: '{count} positions in {country} ({pct}% of open risk)',
  warningLabel: 'Concentrated in {country} — {pct}% of open risk',
},
```

- [x] **Step 4: Add types to frontend portfolio types**

In `web-ui/src/features/portfolio/types.ts` or wherever `PortfolioSummary` frontend type lives:
```typescript
export interface ConcentrationGroup {
  country: string;
  riskAmount: number;
  riskPct: number;
  positionCount: number;
  warning: boolean;
}
// Add to PortfolioSummary frontend type:
concentration: ConcentrationGroup[];
```

In the transform function, add:
```typescript
concentration: (api.concentration ?? []).map(g => ({
  country: g.country,
  riskAmount: g.risk_amount,
  riskPct: g.risk_pct,
  positionCount: g.position_count,
  warning: g.warning,
})),
```

- [x] **Step 5: Implement ConcentrationBar**

Create `web-ui/src/components/domain/portfolio/ConcentrationBar.tsx`:

```typescript
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import type { ConcentrationGroup } from '@/features/portfolio/types';

interface Props {
  groups: ConcentrationGroup[];
}

export default function ConcentrationBar({ groups }: Props) {
  if (groups.length === 0) return null;
  const top = groups[0]; // already sorted by risk desc from backend

  const label = top.warning
    ? t('concentrationBar.warningLabel', { country: top.country, pct: Math.round(top.riskPct) })
    : t('concentrationBar.label', { count: top.positionCount, country: top.country, pct: Math.round(top.riskPct) });

  return (
    <div
      data-warning={top.warning ? 'true' : 'false'}
      className={cn(
        'flex items-center gap-2 text-sm px-3 py-1.5 rounded-md',
        top.warning
          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700'
          : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
      )}
    >
      <span>{label}</span>
    </div>
  );
}
```

- [x] **Step 6: Run tests**

```bash
cd web-ui && npx vitest run src/components/domain/portfolio/ConcentrationBar.test.tsx
```
Expected: 4 PASSED

- [x] **Step 7: Mount on portfolio summary**

Find where `PortfolioSummary` data is displayed (grep for `portfolioSummary` or `usePortfolioSummary` in `web-ui/src/components/domain/portfolio/`). Add:
```tsx
import ConcentrationBar from './ConcentrationBar';
// ...
<ConcentrationBar groups={summary.concentration} />
```

- [x] **Step 8: Run full suite**

```bash
pytest -q && cd web-ui && npx vitest run
```

- [x] **Step 9: Commit**

```bash
git add api/ config/ tests/ web-ui/src/
git commit -m "feat: add portfolio concentration warning component"
```
