# Account Equity Auto-Update — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Read `docs/superpowers/plans/handover-context.md` before starting.

**Goal:** Account size used for position sizing updates to reflect realized P&L from closed trades, so risk-per-trade is always calculated against actual current equity.

**Architecture:** Add `realized_pnl` to `PortfolioSummary` (computed from closed positions). Add `account_size_mode: "base" | "equity"` to config. The `get_portfolio_summary` service method uses effective equity when mode is `"equity"`. Settings page exposes the toggle. Header shows which mode is active.

**Tech Stack:** Python/FastAPI backend, YAML config via `get_settings_manager()`, React 18/TypeScript frontend

---

## Implementation status - 2026-05-03

Status: backend and display UI implemented in draft PR https://github.com/matteolongo/swing_screener/pull/234.

Branch stack:

- Branch: `codex/account-equity`
- Base: `codex/edge-breakdown`
- Head commit: `afeb7773`

Implemented commits:

- `ebcf54b9 feat: add realized P&L and effective account size to portfolio summary`
- `afeb7773 feat: show effective account equity in portfolio UI`

What changed:

- Backend `PortfolioSummary` now includes `realized_pnl` and `effective_account_size`.
- Realized P&L is computed from closed positions.
- `account_size_mode` config support was added for base vs equity mode.
- Open risk percentage and available capital use effective equity when equity mode is active.
- Frontend portfolio summary types now expose `realizedPnl` and `effectiveAccountSize`.
- The top header risk summary shows effective `Equity` and `Realized P&L`.
- Book -> Positions shows `Equity` and `Realized P&L` chips, and portfolio heat uses effective equity.
- Local persistence mirrors the same fields so frontend tests and local mode stay consistent.

How to inspect in the UI:

- Run the backend and frontend.
- Open `http://localhost:5173/book`.
- On wide screens, inspect the top-right header risk summary for `Equity` and `Realized P&L`.
- In `Book -> Positions`, inspect the risk strip for the `Equity` and `Realized P&L` chips.
- If there are no closed trades with realized P&L, effective equity will equal the base account and realized P&L will be zero.

Validation run:

- `pytest tests/api/test_account_equity.py -v`
- `pytest -q`
- `cd web-ui && npm run typecheck`
- `cd web-ui && npx vitest run`

Review notes:

- Compare PR #234 against `codex/edge-breakdown`.
- The Settings UI toggle mentioned in the original architecture is not implemented yet.
- The next plan upgrade should add a dedicated atomic task for the Settings toggle, including persistence rules, i18n, and tests.
- Review whether realized P&L should include all known transaction costs. The implemented logic subtracts exit fees where available.

## File map

| File | Change |
|---|---|
| `api/models/portfolio.py` | Add `realized_pnl`, `effective_account_size` to `PortfolioSummary` |
| `api/services/portfolio_service.py` | Compute `realized_pnl` from closed positions in `get_portfolio_summary` |
| `api/routers/portfolio.py` | Pass effective account size based on mode |
| `config/defaults.yaml` | Add `account_size_mode: equity` under `risk:` |
| `web-ui/src/i18n/messages.en.ts` | Add settings and header strings |
| `web-ui/src/features/portfolio/api.ts` | Portfolio summary response now includes new fields |
| `web-ui/src/types/portfolio.ts` (or wherever PortfolioSummary type lives — check `web-ui/src/features/portfolio/types.ts`) | Add `realizedPnl`, `effectiveAccountSize` |
| `web-ui/src/pages/Strategy.tsx` or Settings area | Add mode toggle |

---

### Task 1: Backend — compute realized P&L and add to PortfolioSummary

**Files:**
- Modify: `api/models/portfolio.py`
- Modify: `api/services/portfolio_service.py`
- Test: `tests/api/test_account_equity.py`

- [ ] **Step 1: Write the failing test**

Create `tests/api/test_account_equity.py`:

```python
"""Tests for account equity auto-update feature."""
import json
import pytest
from fastapi.testclient import TestClient
from api.main import app
import api.dependencies as deps

POSITIONS = [
    {
        "position_id": "POS-001", "ticker": "AAPL", "status": "closed",
        "entry_date": "2026-01-01", "entry_price": 100.0, "stop_price": 95.0,
        "shares": 10, "initial_risk": 50.0, "exit_price": 120.0,
        "exit_date": "2026-01-15", "notes": "", "tags": [],
        # P&L = (120 - 100) * 10 = +200
    },
    {
        "position_id": "POS-002", "ticker": "MSFT", "status": "closed",
        "entry_date": "2026-01-05", "entry_price": 200.0, "stop_price": 190.0,
        "shares": 5, "initial_risk": 50.0, "exit_price": 185.0,
        "exit_date": "2026-01-20", "notes": "", "tags": [],
        # P&L = (185 - 200) * 5 = -75
    },
]

@pytest.fixture
def client_with_closed_positions(tmp_path, monkeypatch):
    positions_file = tmp_path / "positions.json"
    orders_file = tmp_path / "orders.json"
    positions_file.write_text(json.dumps({"asof": "2026-01-20", "positions": POSITIONS}))
    orders_file.write_text(json.dumps({"asof": "2026-01-20", "orders": []}))
    monkeypatch.setattr(deps, "_positions_path", positions_file)
    monkeypatch.setattr(deps, "_orders_path", orders_file)
    return TestClient(app)

def test_portfolio_summary_includes_realized_pnl(client_with_closed_positions):
    response = client_with_closed_positions.get("/api/portfolio/summary")
    assert response.status_code == 200
    data = response.json()
    assert "realized_pnl" in data
    # 200 - 75 = 125
    assert abs(data["realized_pnl"] - 125.0) < 0.01

def test_portfolio_summary_includes_effective_account_size(client_with_closed_positions):
    response = client_with_closed_positions.get("/api/portfolio/summary")
    data = response.json()
    assert "effective_account_size" in data
    # effective = base + realized_pnl (when mode is "equity")
    # base account_size from config — we just check it's > 0
    assert data["effective_account_size"] > 0
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/api/test_account_equity.py -v
```
Expected: FAIL — `realized_pnl` not in response

- [ ] **Step 3: Add fields to PortfolioSummary in `api/models/portfolio.py`**

After `win_rate` field (line ~311), add:
```python
realized_pnl: float = Field(default=0.0, description="Total realized P&L from closed positions")
effective_account_size: float = Field(default=0.0, description="Account size adjusted for realized P&L when mode=equity")
```

- [ ] **Step 4: Add `account_size_mode` to config defaults**

In `config/defaults.yaml`, under the `risk:` section (near `account_size`):
```yaml
risk:
  account_size: 50000
  account_size_mode: equity   # "base" or "equity"
  risk_per_trade_pct: 2.0
  # ... existing keys ...
```

- [ ] **Step 5: Compute realized_pnl in `get_portfolio_summary` service method**

In `api/services/portfolio_service.py`, in `get_portfolio_summary()` (line ~363), before the existing summary computation, add:

```python
# Compute realized P&L from all closed positions
all_positions_resp = self.list_positions()  # no status filter = all
realized_pnl = 0.0
for pos in all_positions_resp.positions:
    if pos.status == "closed" and pos.exit_price is not None:
        trade_pnl = (pos.exit_price - pos.entry_price) * pos.shares
        realized_pnl += trade_pnl
        if pos.exit_fee_eur is not None:
            realized_pnl -= abs(pos.exit_fee_eur)

# Resolve effective account size
settings = get_settings_manager().get()
mode = getattr(settings.risk, "account_size_mode", "equity")
effective_account_size = account_size + realized_pnl if mode == "equity" else account_size
```

Then in the `PortfolioSummary(...)` return at end, add:
```python
realized_pnl=realized_pnl,
effective_account_size=effective_account_size,
```

Also update `open_risk_percent` to use `effective_account_size` instead of `account_size`:
```python
open_risk_percent = (open_risk / effective_account_size * 100.0) if effective_account_size > 0 else 0.0
```

Import `get_settings_manager` at top if not already present:
```python
from swing_screener.settings import get_settings_manager
```

- [ ] **Step 6: Run tests**

```bash
pytest tests/api/test_account_equity.py -v
```
Expected: 2 PASSED

- [ ] **Step 7: Run full backend suite**

```bash
pytest -q
```

- [ ] **Step 8: Commit**

```bash
git add api/models/portfolio.py api/services/portfolio_service.py config/defaults.yaml tests/api/test_account_equity.py
git commit -m "feat: add realized P&L and effective account size to portfolio summary"
```

---

### Task 2: Frontend — display effective account size in header

**Files:**
- Modify: `web-ui/src/i18n/messages.en.ts`
- Identify and modify the header component that shows account size (search for `account_size` or `Account` in `web-ui/src/`)
- Modify: `web-ui/src/features/portfolio/types.ts` (or wherever PortfolioSummary frontend type lives)

- [ ] **Step 1: Find the header and summary type**

```bash
grep -rn "account_size\|accountSize\|PortfolioSummary" web-ui/src/features/portfolio/types.ts web-ui/src/components/ | head -20
```

- [ ] **Step 2: Add new fields to frontend PortfolioSummary type**

In the portfolio summary type file, add:
```typescript
realizedPnl: number;
effectiveAccountSize: number;
```

And in the `transformPortfolioSummary` function (or equivalent):
```typescript
realizedPnl: api.realized_pnl ?? 0,
effectiveAccountSize: api.effective_account_size ?? api.account_size,
```

- [ ] **Step 3: Add i18n strings**

```typescript
// In messages.en.ts, add to relevant section:
portfolioHeader: {
  effectiveEquity: 'Equity',
  baseAccount: 'Base',
  realizedPnl: 'Realized P&L',
  equityModeHint: 'Account size + realized P&L from closed trades',
},
```

- [ ] **Step 4: Update header to show effective equity**

In the header component (found in step 1), replace the raw `account_size` display with `effectiveAccountSize`:
```tsx
<span title={t('portfolioHeader.equityModeHint')}>
  {t('portfolioHeader.effectiveEquity')} {formatCurrency(summary.effectiveAccountSize)}
</span>
```

- [ ] **Step 5: Run full suite**

```bash
pytest -q && cd web-ui && npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add web-ui/src/
git commit -m "feat: show effective account equity in header"
```
