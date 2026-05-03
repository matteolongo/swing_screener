# Symbol Intelligence UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Suppress re-entry candidates that fail automated gate rules, surface past trade history in the analysis canvas, and require a manual intent confirmation before order setup on any re-entry.

**Architecture:** Backend enriches screener candidates with `PriorTradeContext` + `ReentryGateResult` at run time; frontend renders re-entry badges, gates order setup behind a checklist modal, and shows a History tab in the analysis canvas panel.

**Tech Stack:** Python / Pydantic / FastAPI (backend); React 18 / TypeScript / React Query / Zustand / Vitest (frontend)

---

## File Map

**Create:**
- `api/services/prior_trade_annotator.py` — attaches `PriorTradeContext` to candidates
- `api/services/reentry_gate_evaluator.py` — evaluates 7 rules, returns `ReentryGateResult`
- `tests/api/test_prior_trade_annotator.py`
- `tests/api/test_reentry_gate_evaluator.py`
- `web-ui/src/components/domain/workspace/SymbolTradeHistory.tsx`
- `web-ui/src/components/domain/workspace/SymbolTradeHistory.test.tsx`
- `web-ui/src/components/domain/recommendation/ReentryChecklistModal.tsx`
- `web-ui/src/components/domain/recommendation/ReentryChecklistModal.test.tsx`

**Modify:**
- `api/models/screener.py` — add `PriorTradeContext`, `ReentryCheckResult`, `ReentryGateResult`; add fields to `ScreenerCandidate`
- `api/models/portfolio.py` — add `SymbolHistoryResponse`
- `api/services/screener_service.py` — wire annotator + evaluator after `SameSymbolReentryEvaluator`
- `api/services/portfolio_service.py` — add `get_symbol_history(ticker)` method
- `api/routers/portfolio.py` — add `GET /portfolio/symbol-history/{ticker}`
- `web-ui/src/features/screener/types.ts` — add `PriorTradeContext`, `ReentryCheckResult`, `ReentryGateResult`, API shapes, transform
- `web-ui/src/components/domain/workspace/types.ts` — add `'history'` to `WorkspaceAnalysisTab`; add `priorTrades`/`reentryGate` to `SymbolAnalysisCandidate`
- `web-ui/src/features/portfolio/api.ts` — add `fetchSymbolHistory`
- `web-ui/src/features/portfolio/hooks.ts` — add `useSymbolHistory`
- `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx` — add History tab
- `web-ui/src/pages/Today.tsx` — `CandidateItem` gets re-entry badge + modal trigger
- `web-ui/src/components/domain/screener/ScreenerCandidateIdentityCell.tsx` — re-entry badge + ADD_ON/MANAGE_ONLY improvements
- `web-ui/src/i18n/resources.ts` — new keys
- `web-ui/src/features/screener/types.test.ts` — extend transform test with new fields

---

## Task 1: Backend models — `PriorTradeContext`, `ReentryGateResult`

**Files:**
- Modify: `api/models/screener.py`

- [ ] **Step 1: Write failing test**

Create `tests/api/test_prior_trade_annotator.py` with just the import check first:

```python
# tests/api/test_prior_trade_annotator.py
from __future__ import annotations
from api.models.screener import PriorTradeContext, ReentryCheckResult, ReentryGateResult


def test_prior_trade_context_model():
    ctx = PriorTradeContext(
        last_exit_date="2026-03-01",
        last_exit_price=110.0,
        last_entry_price=100.0,
        last_r_outcome=2.5,
        was_profitable=True,
        trade_count=1,
    )
    assert ctx.was_profitable is True
    assert ctx.trade_count == 1


def test_reentry_gate_result_suppression():
    gate = ReentryGateResult(
        suppressed=True,
        checks={
            "thesis_valid": ReentryCheckResult(passed=False, reason="No recommendation"),
            "new_setup_present": ReentryCheckResult(passed=True, reason="Structural"),
        },
    )
    assert gate.suppressed is True
    assert gate.checks["thesis_valid"].passed is False
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/api/test_prior_trade_annotator.py -v
```
Expected: `ImportError` — `PriorTradeContext` not found.

- [ ] **Step 3: Add models to `api/models/screener.py`**

Add after the `SameSymbolCandidateContext` class (around line 31) and add fields to `ScreenerCandidate` (after line 75 `same_symbol` field):

```python
class PriorTradeContext(BaseModel):
    last_exit_date: str
    last_exit_price: float
    last_entry_price: float
    last_r_outcome: float       # R multiple at exit (negative = loss)
    was_profitable: bool
    trade_count: int            # total closed trades for this ticker


class ReentryCheckResult(BaseModel):
    passed: bool
    reason: str


class ReentryGateResult(BaseModel):
    suppressed: bool
    checks: dict[str, ReentryCheckResult]
```

Add to `ScreenerCandidate` after the `same_symbol` field:

```python
    prior_trades: Optional[PriorTradeContext] = None
    reentry_gate: Optional[ReentryGateResult] = None
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/api/test_prior_trade_annotator.py -v
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add api/models/screener.py tests/api/test_prior_trade_annotator.py
git commit -m "feat: add PriorTradeContext and ReentryGateResult models to ScreenerCandidate"
```

---

## Task 2: `PriorTradeAnnotator` service

**Files:**
- Create: `api/services/prior_trade_annotator.py`
- Modify: `tests/api/test_prior_trade_annotator.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/api/test_prior_trade_annotator.py`:

```python
import pytest
from api.models.screener import ScreenerCandidate
from api.services.prior_trade_annotator import PriorTradeAnnotator


def _make_candidate(ticker: str = "AAPL") -> ScreenerCandidate:
    return ScreenerCandidate(
        ticker=ticker,
        close=150.0,
        sma_20=148.0,
        sma_50=145.0,
        sma_200=140.0,
        atr=3.0,
        momentum_6m=0.15,
        momentum_12m=0.20,
        rel_strength=1.1,
        score=0.8,
        confidence=75.0,
        rank=1,
    )


def _make_closed_position(
    ticker: str = "AAPL",
    entry_price: float = 100.0,
    exit_price: float = 110.0,
    stop_price: float = 95.0,
    initial_risk: float = 25.0,   # (entry - stop) * shares
):
    from types import SimpleNamespace
    return SimpleNamespace(
        ticker=ticker,
        status="closed",
        entry_price=entry_price,
        exit_price=exit_price,
        stop_price=stop_price,
        initial_risk=initial_risk,
        exit_date="2026-03-01",
        shares=5,
    )


def test_annotator_attaches_prior_trades():
    annotator = PriorTradeAnnotator()
    candidate = _make_candidate("AAPL")
    closed = [_make_closed_position("AAPL", entry_price=100.0, exit_price=110.0, stop_price=95.0, initial_risk=25.0)]

    result = annotator.annotate([candidate], closed_positions=closed)

    assert result[0].prior_trades is not None
    assert result[0].prior_trades.was_profitable is True
    assert result[0].prior_trades.trade_count == 1
    assert result[0].prior_trades.last_exit_date == "2026-03-01"


def test_annotator_computes_r_outcome():
    annotator = PriorTradeAnnotator()
    candidate = _make_candidate("AAPL")
    # entry=100, exit=110, stop=95 → risk_per_share=5, gain=10 → R=2.0
    closed = [_make_closed_position("AAPL", entry_price=100.0, exit_price=110.0, stop_price=95.0, initial_risk=25.0)]

    result = annotator.annotate([candidate], closed_positions=closed)

    assert abs(result[0].prior_trades.last_r_outcome - 2.0) < 0.01


def test_annotator_loss_trade():
    annotator = PriorTradeAnnotator()
    candidate = _make_candidate("AAPL")
    # entry=100, exit=95 (stop hit), stop=95, risk_per_share=5, loss=-5 → R=-1.0
    closed = [_make_closed_position("AAPL", entry_price=100.0, exit_price=95.0, stop_price=95.0, initial_risk=25.0)]

    result = annotator.annotate([candidate], closed_positions=closed)

    assert result[0].prior_trades.was_profitable is False
    assert result[0].prior_trades.last_r_outcome < 0


def test_annotator_no_history_leaves_prior_trades_none():
    annotator = PriorTradeAnnotator()
    candidate = _make_candidate("MSFT")
    closed = [_make_closed_position("AAPL")]

    result = annotator.annotate([candidate], closed_positions=closed)

    assert result[0].prior_trades is None


def test_annotator_multiple_trades_uses_most_recent():
    annotator = PriorTradeAnnotator()
    candidate = _make_candidate("AAPL")
    older = _make_closed_position("AAPL", exit_price=108.0)
    older.exit_date = "2026-01-01"
    recent = _make_closed_position("AAPL", exit_price=115.0)
    recent.exit_date = "2026-03-15"

    result = annotator.annotate([candidate], closed_positions=[older, recent])

    assert result[0].prior_trades.last_exit_date == "2026-03-15"
    assert result[0].prior_trades.trade_count == 2
```

- [ ] **Step 2: Run to verify failure**

```bash
pytest tests/api/test_prior_trade_annotator.py -v
```
Expected: `ImportError` — `PriorTradeAnnotator` not found.

- [ ] **Step 3: Implement `PriorTradeAnnotator`**

Create `api/services/prior_trade_annotator.py`:

```python
"""Annotates screener candidates with closed-position history for the same ticker."""
from __future__ import annotations

import math
from typing import Optional

from api.models.screener import PriorTradeContext, ScreenerCandidate


def _safe_float(value: object) -> Optional[float]:
    if value is None:
        return None
    try:
        v = float(value)
        return v if math.isfinite(v) else None
    except (TypeError, ValueError):
        return None


def _compute_r_outcome(
    entry_price: float,
    exit_price: float,
    stop_price: float,
) -> float:
    """Return R multiple at exit. Negative = loss."""
    risk_per_share = entry_price - stop_price
    if risk_per_share <= 0:
        return 0.0
    gain_per_share = exit_price - entry_price
    return round(gain_per_share / risk_per_share, 4)


class PriorTradeAnnotator:
    """Attaches PriorTradeContext to candidates that have prior closed positions."""

    def annotate(
        self,
        candidates: list[ScreenerCandidate],
        *,
        closed_positions: list[object],
    ) -> list[ScreenerCandidate]:
        # Group closed positions by ticker (uppercase)
        by_ticker: dict[str, list[object]] = {}
        for pos in closed_positions:
            ticker = getattr(pos, "ticker", "").upper()
            by_ticker.setdefault(ticker, []).append(pos)

        for candidate in candidates:
            ticker = candidate.ticker.upper()
            history = by_ticker.get(ticker)
            if not history:
                continue

            # Sort by exit_date descending, most recent first
            sorted_history = sorted(
                history,
                key=lambda p: getattr(p, "exit_date", "") or "",
                reverse=True,
            )
            most_recent = sorted_history[0]

            entry_price = _safe_float(getattr(most_recent, "entry_price", None)) or 0.0
            exit_price = _safe_float(getattr(most_recent, "exit_price", None)) or 0.0
            stop_price = _safe_float(getattr(most_recent, "stop_price", None)) or 0.0

            r_outcome = _compute_r_outcome(entry_price, exit_price, stop_price)

            candidate.prior_trades = PriorTradeContext(
                last_exit_date=getattr(most_recent, "exit_date", "") or "",
                last_exit_price=exit_price,
                last_entry_price=entry_price,
                last_r_outcome=r_outcome,
                was_profitable=exit_price > entry_price,
                trade_count=len(history),
            )

        return candidates
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/api/test_prior_trade_annotator.py -v
```
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add api/services/prior_trade_annotator.py tests/api/test_prior_trade_annotator.py
git commit -m "feat: add PriorTradeAnnotator service with R-outcome calculation"
```

---

## Task 3: `ReentryGateEvaluator` service

**Files:**
- Create: `api/services/reentry_gate_evaluator.py`
- Create: `tests/api/test_reentry_gate_evaluator.py`

- [ ] **Step 1: Write failing tests**

Create `tests/api/test_reentry_gate_evaluator.py`:

```python
"""Tests for ReentryGateEvaluator."""
from __future__ import annotations

from api.models.recommendation import (
    ChecklistGate,
    Recommendation,
    RecommendationCosts,
    RecommendationEducation,
    RecommendationReason,
    RecommendationRisk,
)
from api.models.screener import PriorTradeContext, ScreenerCandidate
from api.services.reentry_gate_evaluator import ReentryGateEvaluator


def _make_recommendation(verdict: str = "RECOMMENDED", rr: float = 2.5) -> Recommendation:
    return Recommendation(
        verdict=verdict,
        reasons_short=["Valid setup"],
        reasons_detailed=[
            RecommendationReason(code="VALID", message="Setup is valid.", severity="info")
        ],
        risk=RecommendationRisk(
            entry=100.0,
            stop=95.0,
            target=110.0,
            rr=rr,
            risk_amount=25.0,
            risk_pct=0.0138,
            position_size=500.0,
            shares=5,
            invalidation_level=95.0,
        ),
        costs=RecommendationCosts(
            commission_estimate=0.0,
            fx_estimate=0.0,
            slippage_estimate=0.0,
            total_cost=0.0,
            fee_to_risk_pct=0.0,
        ),
        checklist=[ChecklistGate(gate_name="signal", passed=True, explanation="Signal active.")],
        education=RecommendationEducation(
            common_bias_warning="None",
            rule_reminder="Follow your plan.",
            pre_trade_checklist=[],
        ),
    )


def _make_candidate(
    ticker: str = "AAPL",
    rr: float = 2.5,
    stop: float = 95.0,
    recommendation: Recommendation | None = None,
) -> ScreenerCandidate:
    rec = recommendation if recommendation is not None else _make_recommendation(rr=rr)
    return ScreenerCandidate(
        ticker=ticker,
        close=100.0,
        sma_20=98.0,
        sma_50=95.0,
        sma_200=90.0,
        atr=3.0,
        momentum_6m=0.15,
        momentum_12m=0.20,
        rel_strength=1.1,
        score=0.8,
        confidence=75.0,
        rank=1,
        rr=rr,
        stop=stop,
        recommendation=rec,
        prior_trades=PriorTradeContext(
            last_exit_date="2026-03-01",
            last_exit_price=95.0,
            last_entry_price=100.0,
            last_r_outcome=-1.0,
            was_profitable=False,
            trade_count=1,
        ),
    )


def test_passes_all_checks_when_recommended_and_rr_sufficient():
    evaluator = ReentryGateEvaluator(rr_threshold=2.0)
    candidate = _make_candidate(rr=2.5)

    result = evaluator.evaluate([candidate])

    assert result[0].reentry_gate is not None
    assert result[0].reentry_gate.suppressed is False
    assert result[0].reentry_gate.checks["thesis_valid"].passed is True
    assert result[0].reentry_gate.checks["reward_sufficient"].passed is True


def test_suppresses_when_thesis_invalid():
    evaluator = ReentryGateEvaluator(rr_threshold=2.0)
    rec = _make_recommendation(verdict="NOT_RECOMMENDED", rr=2.5)
    candidate = _make_candidate(recommendation=rec)

    result = evaluator.evaluate([candidate])

    assert result[0].reentry_gate.suppressed is True
    assert result[0].reentry_gate.checks["thesis_valid"].passed is False


def test_suppresses_when_rr_below_threshold():
    evaluator = ReentryGateEvaluator(rr_threshold=2.0)
    rec = _make_recommendation(verdict="RECOMMENDED", rr=1.5)
    candidate = _make_candidate(rr=1.5, recommendation=rec)

    result = evaluator.evaluate([candidate])

    assert result[0].reentry_gate.suppressed is True
    assert result[0].reentry_gate.checks["reward_sufficient"].passed is False


def test_structural_checks_always_pass():
    evaluator = ReentryGateEvaluator(rr_threshold=2.0)
    candidate = _make_candidate(rr=2.5)
    candidate.stop = 95.0

    result = evaluator.evaluate([candidate])

    checks = result[0].reentry_gate.checks
    assert checks["new_setup_present"].passed is True
    assert checks["stop_defined"].passed is True
    assert checks["position_size_reset"].passed is True
    assert checks["timeframe_fits"].passed is True


def test_candidates_without_prior_trades_skip_evaluation():
    evaluator = ReentryGateEvaluator(rr_threshold=2.0)
    candidate = _make_candidate(rr=2.5)
    candidate.prior_trades = None

    result = evaluator.evaluate([candidate])

    assert result[0].reentry_gate is None


def test_negative_catalyst_suppresses_market_context():
    evaluator = ReentryGateEvaluator(rr_threshold=2.0, upcoming_earnings_tickers={"AAPL"})
    candidate = _make_candidate(rr=2.5)

    result = evaluator.evaluate([candidate])

    assert result[0].reentry_gate.suppressed is True
    assert result[0].reentry_gate.checks["market_context_clean"].passed is False
```

- [ ] **Step 2: Run to verify failure**

```bash
pytest tests/api/test_reentry_gate_evaluator.py -v
```
Expected: `ImportError`.

- [ ] **Step 3: Implement `ReentryGateEvaluator`**

Create `api/services/reentry_gate_evaluator.py`:

```python
"""Evaluates re-entry gate rules for screener candidates with prior trade history."""
from __future__ import annotations

from api.models.screener import ReentryCheckResult, ReentryGateResult, ScreenerCandidate

_SUPPRESS_KEYS = {"thesis_valid", "reward_sufficient", "market_context_clean"}

_STRUCTURAL_KEYS = {"new_setup_present", "stop_defined", "position_size_reset", "timeframe_fits"}


class ReentryGateEvaluator:
    """
    Evaluates 7 re-entry rules for candidates that have prior_trades attached.
    Candidates without prior_trades are left untouched (no gate applied).

    Rules that can cause suppression:
      - thesis_valid: recommendation.verdict == "RECOMMENDED"
      - reward_sufficient: candidate.rr >= rr_threshold
      - market_context_clean: ticker not in upcoming_earnings_tickers

    Structural rules (always pass — included for display only):
      - new_setup_present, stop_defined, position_size_reset, timeframe_fits
    """

    def __init__(
        self,
        *,
        rr_threshold: float = 2.0,
        upcoming_earnings_tickers: set[str] | None = None,
    ) -> None:
        self._rr_threshold = rr_threshold
        self._upcoming_earnings: set[str] = {t.upper() for t in (upcoming_earnings_tickers or set())}

    def evaluate(self, candidates: list[ScreenerCandidate]) -> list[ScreenerCandidate]:
        for candidate in candidates:
            if candidate.prior_trades is None:
                continue
            checks = self._run_checks(candidate)
            suppressed = any(
                not checks[key].passed for key in _SUPPRESS_KEYS if key in checks
            )
            candidate.reentry_gate = ReentryGateResult(suppressed=suppressed, checks=checks)
        return candidates

    def _run_checks(self, candidate: ScreenerCandidate) -> dict[str, ReentryCheckResult]:
        checks: dict[str, ReentryCheckResult] = {}

        # Structural — always pass
        for key in _STRUCTURAL_KEYS:
            checks[key] = ReentryCheckResult(passed=True, reason="Structural guarantee.")

        # thesis_valid
        rec = candidate.recommendation
        if rec is not None and rec.verdict == "RECOMMENDED":
            checks["thesis_valid"] = ReentryCheckResult(
                passed=True, reason="Recommendation verdict is RECOMMENDED."
            )
        else:
            verdict = rec.verdict if rec else "missing"
            checks["thesis_valid"] = ReentryCheckResult(
                passed=False,
                reason=f"Recommendation verdict is '{verdict}', not RECOMMENDED.",
            )

        # reward_sufficient
        rr = candidate.rr
        if rr is not None and rr >= self._rr_threshold:
            checks["reward_sufficient"] = ReentryCheckResult(
                passed=True,
                reason=f"R/R {rr:.2f} ≥ threshold {self._rr_threshold:.2f}.",
            )
        else:
            actual = f"{rr:.2f}" if rr is not None else "unknown"
            checks["reward_sufficient"] = ReentryCheckResult(
                passed=False,
                reason=f"R/R {actual} is below threshold {self._rr_threshold:.2f}.",
            )

        # market_context_clean
        if candidate.ticker.upper() in self._upcoming_earnings:
            checks["market_context_clean"] = ReentryCheckResult(
                passed=False,
                reason="Earnings within 5 calendar days — market context is not clean.",
            )
        else:
            checks["market_context_clean"] = ReentryCheckResult(
                passed=True, reason="No upcoming earnings detected."
            )

        return checks
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/api/test_reentry_gate_evaluator.py -v
```
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add api/services/reentry_gate_evaluator.py tests/api/test_reentry_gate_evaluator.py
git commit -m "feat: add ReentryGateEvaluator with thesis/reward/market-context rules"
```

---

## Task 4: Wire annotators into `ScreenerService` pipeline

**Files:**
- Modify: `api/services/screener_service.py`

The insertion point is after the `SameSymbolReentryEvaluator` block (around line 1064–1066). We also need to resolve `upcoming_earnings_tickers` from the intelligence storage for the gate evaluator.

- [ ] **Step 1: Add imports at the top of `api/services/screener_service.py`**

Find the existing imports block and add:

```python
from api.services.prior_trade_annotator import PriorTradeAnnotator
from api.services.reentry_gate_evaluator import ReentryGateEvaluator
```

- [ ] **Step 2: Insert annotator + evaluator after `SameSymbolReentryEvaluator` block**

Find this line in `screener_service.py` (around line 1064):
```python
            candidates = filtered_candidates
            candidates = _apply_cached_fundamentals_context(candidates)
```

Replace with:

```python
            candidates = filtered_candidates

            # ── Re-entry annotation + gate ────────────────────────────────
            closed_positions = [
                p for p in portfolio_positions
                if getattr(p, "status", None) == "closed"
            ]
            if closed_positions:
                annotator = PriorTradeAnnotator()
                candidates = annotator.annotate(candidates, closed_positions=closed_positions)

                # Resolve upcoming earnings for market_context_clean rule
                upcoming_earnings: set[str] = set()
                try:
                    import datetime as _dt
                    from swing_screener.intelligence.storage import IntelligenceStorage
                    _intel_storage = IntelligenceStorage()
                    _today = _dt.date.today()
                    for _offset in range(5):
                        _day = (_today + _dt.timedelta(days=_offset)).isoformat()
                        _catalyst_path = _intel_storage.signals_path(_day)
                        if _catalyst_path.exists():
                            import json as _json
                            _data = _json.loads(_catalyst_path.read_text())
                            for _signal in _data.get("signals", []):
                                _sym = _signal.get("symbol", "")
                                if _sym:
                                    upcoming_earnings.add(_sym.upper())
                except Exception:  # noqa: BLE001 — intelligence data is optional
                    pass

                rr_threshold = _safe_float(getattr(risk_cfg, "rr_target", 2.0)) or 2.0
                gate_evaluator = ReentryGateEvaluator(
                    rr_threshold=rr_threshold,
                    upcoming_earnings_tickers=upcoming_earnings,
                )
                candidates = gate_evaluator.evaluate(candidates)

                # Remove suppressed re-entry candidates
                reentry_suppressed = [c for c in candidates if c.reentry_gate and c.reentry_gate.suppressed]
                if reentry_suppressed:
                    warnings.append(
                        f"{len(reentry_suppressed)} re-entry candidate"
                        f"{'s' if len(reentry_suppressed) != 1 else ''} suppressed (gate rules not met)."
                    )
                candidates = [c for c in candidates if not (c.reentry_gate and c.reentry_gate.suppressed)]
            # ── End re-entry gate ─────────────────────────────────────────

            candidates = _apply_cached_fundamentals_context(candidates)
```

- [ ] **Step 3: Run screener smoke tests**

```bash
pytest tests/api/test_screener_endpoints.py tests/api/test_screener_run_manager.py -v
```
Expected: PASS (all existing tests pass).

- [ ] **Step 4: Commit**

```bash
git add api/services/screener_service.py
git commit -m "feat: wire PriorTradeAnnotator and ReentryGateEvaluator into screener pipeline"
```

---

## Task 5: `GET /portfolio/symbol-history/{ticker}` endpoint

**Files:**
- Modify: `api/models/portfolio.py`
- Modify: `api/services/portfolio_service.py`
- Modify: `api/routers/portfolio.py`
- Create (or extend): test coverage via existing `tests/api/test_portfolio_metrics_endpoints.py`

- [ ] **Step 1: Write failing test**

Create `tests/api/test_symbol_history_endpoint.py`:

```python
"""Tests for GET /api/portfolio/symbol-history/{ticker}."""
from __future__ import annotations

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from api.main import app


@pytest.fixture()
def client():
    return TestClient(app)


def _closed_position_payload():
    return {
        "ticker": "AAPL",
        "status": "closed",
        "entry_date": "2026-01-10",
        "entry_price": 100.0,
        "stop_price": 95.0,
        "shares": 5,
        "exit_date": "2026-02-01",
        "exit_price": 112.0,
        "notes": "",
    }


def test_symbol_history_returns_positions_for_ticker(client):
    mock_service = MagicMock()
    mock_service.get_symbol_history.return_value = {
        "ticker": "AAPL",
        "positions": [_closed_position_payload()],
        "open_count": 0,
        "closed_count": 1,
    }
    with patch("api.routers.portfolio.get_portfolio_service", return_value=lambda: mock_service):
        resp = client.get("/api/portfolio/symbol-history/AAPL")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ticker"] == "AAPL"
    assert data["closed_count"] == 1


def test_symbol_history_normalizes_ticker_to_uppercase(client):
    mock_service = MagicMock()
    mock_service.get_symbol_history.return_value = {
        "ticker": "AAPL",
        "positions": [],
        "open_count": 0,
        "closed_count": 0,
    }
    with patch("api.routers.portfolio.get_portfolio_service", return_value=lambda: mock_service):
        resp = client.get("/api/portfolio/symbol-history/aapl")
    assert resp.status_code == 200
    mock_service.get_symbol_history.assert_called_once_with("AAPL")
```

- [ ] **Step 2: Run to verify failure**

```bash
pytest tests/api/test_symbol_history_endpoint.py -v
```
Expected: failure — endpoint does not exist yet.

- [ ] **Step 3: Add `SymbolHistoryResponse` to `api/models/portfolio.py`**

Append at the bottom of `api/models/portfolio.py`:

```python
class SymbolHistoryResponse(BaseModel):
    ticker: str
    positions: list[Position]
    open_count: int
    closed_count: int
```

- [ ] **Step 4: Add `get_symbol_history` to `api/services/portfolio_service.py`**

Add this method to `PortfolioService` class (after the `list_positions` method):

```python
    def get_symbol_history(self, ticker: str) -> dict:
        """Return all positions for a specific ticker, ordered by entry date descending."""
        from api.models.portfolio import SymbolHistoryResponse
        all_positions = self._positions_repo.load_all()
        ticker_upper = ticker.upper()
        matching = [
            p for p in all_positions
            if p.get("ticker", "").upper() == ticker_upper
        ]
        # Sort by entry_date descending
        matching.sort(key=lambda p: p.get("entry_date", ""), reverse=True)
        positions = [Position(**p) for p in matching]
        open_count = sum(1 for p in positions if p.status == "open")
        closed_count = sum(1 for p in positions if p.status == "closed")
        return SymbolHistoryResponse(
            ticker=ticker_upper,
            positions=positions,
            open_count=open_count,
            closed_count=closed_count,
        )
```

- [ ] **Step 5: Add endpoint to `api/routers/portfolio.py`**

Add after the last existing endpoint, importing `SymbolHistoryResponse`:

First add to the import block at the top:
```python
from api.models.portfolio import (
    ...existing imports...,
    SymbolHistoryResponse,
)
```

Then add the endpoint:
```python
@router.get("/symbol-history/{ticker}", response_model=SymbolHistoryResponse)
async def get_symbol_history(
    ticker: str,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Get all positions for a specific ticker."""
    return service.get_symbol_history(ticker.upper())
```

- [ ] **Step 6: Run tests**

```bash
pytest tests/api/test_symbol_history_endpoint.py -v
```
Expected: PASS.

Also run full portfolio test suite:
```bash
pytest tests/api/test_portfolio_metrics_endpoints.py tests/api/test_position_close_endpoint.py -v
```
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add api/models/portfolio.py api/services/portfolio_service.py api/routers/portfolio.py tests/api/test_symbol_history_endpoint.py
git commit -m "feat: add GET /portfolio/symbol-history/{ticker} endpoint"
```

---

## Task 6: Frontend screener types — `PriorTradeContext`, `ReentryGateResult`, transform

**Files:**
- Modify: `web-ui/src/features/screener/types.ts`
- Modify: `web-ui/src/components/domain/workspace/types.ts`
- Modify: `web-ui/src/features/screener/types.test.ts`

- [ ] **Step 1: Write failing test**

In `web-ui/src/features/screener/types.test.ts`, add a second `describe` block:

```typescript
describe('transformScreenerResponse — prior_trades and reentry_gate', () => {
  it('maps prior_trades from API to camelCase', () => {
    const apiResponse: ScreenerResponseAPI = {
      asof_date: '2026-04-21',
      total_screened: 1,
      data_freshness: 'final_close',
      candidates: [
        {
          ticker: 'AAPL',
          close: 150, sma_20: 148, sma_50: 145, sma_200: 140,
          atr: 3, momentum_6m: 0.15, momentum_12m: 0.2,
          rel_strength: 1.1, score: 0.8, confidence: 75, rank: 1,
          prior_trades: {
            last_exit_date: '2026-03-01',
            last_exit_price: 110,
            last_entry_price: 100,
            last_r_outcome: 2.0,
            was_profitable: true,
            trade_count: 2,
          },
          reentry_gate: {
            suppressed: false,
            checks: {
              thesis_valid: { passed: true, reason: 'RECOMMENDED' },
              reward_sufficient: { passed: true, reason: 'R/R 2.5 >= 2.0' },
            },
          },
        },
      ],
    };

    const result = transformScreenerResponse(apiResponse);
    const c = result.candidates[0];

    expect(c.priorTrades?.wasProfit able).toBe(true);
    expect(c.priorTrades?.tradeCount).toBe(2);
    expect(c.priorTrades?.lastROutcome).toBe(2.0);
    expect(c.reentryGate?.suppressed).toBe(false);
    expect(c.reentryGate?.checks['thesis_valid'].passed).toBe(true);
  });

  it('leaves priorTrades and reentryGate undefined when absent', () => {
    const apiResponse: ScreenerResponseAPI = {
      asof_date: '2026-04-21',
      total_screened: 1,
      data_freshness: 'final_close',
      candidates: [
        {
          ticker: 'MSFT',
          close: 300, sma_20: 298, sma_50: 290, sma_200: 280,
          atr: 5, momentum_6m: 0.1, momentum_12m: 0.15,
          rel_strength: 1.0, score: 0.7, confidence: 70, rank: 2,
        },
      ],
    };

    const result = transformScreenerResponse(apiResponse);
    expect(result.candidates[0].priorTrades).toBeUndefined();
    expect(result.candidates[0].reentryGate).toBeUndefined();
  });
});
```

Note: there's a typo in the test above — fix `wasProfit able` → `wasProfitable`.

- [ ] **Step 2: Run to verify failure**

```bash
cd web-ui && npx vitest run src/features/screener/types.test.ts
```
Expected: TypeScript error — `prior_trades` not in `ScreenerCandidateAPI`.

- [ ] **Step 3: Add types to `web-ui/src/features/screener/types.ts`**

Add after the `SameSymbolCandidateContext` interface (around line 18):

```typescript
export interface PriorTradeContext {
  lastExitDate: string;
  lastExitPrice: number;
  lastEntryPrice: number;
  lastROutcome: number;
  wasProfitable: boolean;
  tradeCount: number;
}

export interface ReentryCheckResult {
  passed: boolean;
  reason: string;
}

export interface ReentryGateResult {
  suppressed: boolean;
  checks: Record<string, ReentryCheckResult>;
}

export interface PriorTradeContextAPI {
  last_exit_date: string;
  last_exit_price: number;
  last_entry_price: number;
  last_r_outcome: number;
  was_profitable: boolean;
  trade_count: number;
}

export interface ReentryCheckResultAPI {
  passed: boolean;
  reason: string;
}

export interface ReentryGateResultAPI {
  suppressed: boolean;
  checks: Record<string, ReentryCheckResultAPI>;
}
```

Add to `ScreenerCandidate` interface (after `combinedPriorityScore`):
```typescript
  priorTrades?: PriorTradeContext;
  reentryGate?: ReentryGateResult;
```

Add to `ScreenerCandidateAPI` interface (after `combined_priority_score`):
```typescript
  prior_trades?: PriorTradeContextAPI | null;
  reentry_gate?: ReentryGateResultAPI | null;
```

In `transformScreenerResponse`, add to the candidate mapping object (after `combinedPriorityScore`):
```typescript
      priorTrades: c.prior_trades
        ? {
            lastExitDate: c.prior_trades.last_exit_date,
            lastExitPrice: c.prior_trades.last_exit_price,
            lastEntryPrice: c.prior_trades.last_entry_price,
            lastROutcome: c.prior_trades.last_r_outcome,
            wasProfitable: c.prior_trades.was_profitable,
            tradeCount: c.prior_trades.trade_count,
          }
        : undefined,
      reentryGate: c.reentry_gate
        ? {
            suppressed: c.reentry_gate.suppressed,
            checks: Object.fromEntries(
              Object.entries(c.reentry_gate.checks).map(([k, v]) => [
                k,
                { passed: v.passed, reason: v.reason },
              ])
            ),
          }
        : undefined,
```

- [ ] **Step 4: Update `web-ui/src/components/domain/workspace/types.ts`**

Update `WorkspaceAnalysisTab`:
```typescript
export type WorkspaceAnalysisTab = 'overview' | 'fundamentals' | 'intelligence' | 'order' | 'history';
```

Add to `SymbolAnalysisCandidate` (after `decisionSummary`):
```typescript
  priorTrades?: PriorTradeContext;
  reentryGate?: ReentryGateResult;
```

Add the import at the top:
```typescript
import type { Recommendation } from '@/types/recommendation';
import type { DecisionSummary, SameSymbolCandidateContext, PriorTradeContext, ReentryGateResult } from '@/features/screener/types';
```

- [ ] **Step 5: Run tests**

```bash
cd web-ui && npx vitest run src/features/screener/types.test.ts
```
Expected: PASS (all tests including new ones).

```bash
cd web-ui && npm run typecheck
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add web-ui/src/features/screener/types.ts web-ui/src/components/domain/workspace/types.ts web-ui/src/features/screener/types.test.ts
git commit -m "feat: add PriorTradeContext and ReentryGateResult to frontend screener types"
```

---

## Task 7: `useSymbolHistory` hook + `fetchSymbolHistory`

**Files:**
- Modify: `web-ui/src/features/portfolio/api.ts`
- Modify: `web-ui/src/features/portfolio/hooks.ts`

- [ ] **Step 1: Write failing test**

In `web-ui/src/features/portfolio/hooks.test.tsx`, add a new test:

```typescript
describe('useSymbolHistory', () => {
  it('returns symbol history for a ticker', async () => {
    server.use(
      http.get('*/api/portfolio/symbol-history/AAPL', () =>
        HttpResponse.json({
          ticker: 'AAPL',
          positions: [],
          open_count: 0,
          closed_count: 0,
        })
      )
    );

    const { result } = renderHook(() => useSymbolHistory('AAPL'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.ticker).toBe('AAPL');
  });

  it('does not fetch when ticker is undefined', () => {
    const { result } = renderHook(() => useSymbolHistory(undefined), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });
});
```

Import `useSymbolHistory` at the top of the test file.

- [ ] **Step 2: Run to verify failure**

```bash
cd web-ui && npx vitest run src/features/portfolio/hooks.test.tsx
```
Expected: `ImportError` — `useSymbolHistory` not found.

- [ ] **Step 3: Add `fetchSymbolHistory` to `web-ui/src/features/portfolio/api.ts`**

Add at the bottom of the file:

```typescript
export interface SymbolHistoryResponse {
  ticker: string;
  positions: PositionApiResponse[];
  openCount: number;
  closedCount: number;
}

interface SymbolHistoryApiResponse {
  ticker: string;
  positions: PositionApiResponse[];
  open_count: number;
  closed_count: number;
}

export async function fetchSymbolHistory(ticker: string): Promise<SymbolHistoryResponse> {
  const res = await axios.get<SymbolHistoryApiResponse>(
    apiUrl(`/api/portfolio/symbol-history/${encodeURIComponent(ticker)}`)
  );
  return {
    ticker: res.data.ticker,
    positions: res.data.positions,
    openCount: res.data.open_count,
    closedCount: res.data.closed_count,
  };
}
```

- [ ] **Step 4: Add `useSymbolHistory` to `web-ui/src/features/portfolio/hooks.ts`**

Add at the bottom:

```typescript
import { fetchSymbolHistory, type SymbolHistoryResponse } from './api';

export function useSymbolHistory(ticker: string | undefined) {
  return useQuery<SymbolHistoryResponse>({
    queryKey: ['symbol-history', ticker],
    queryFn: () => fetchSymbolHistory(ticker!),
    enabled: !!ticker,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

- [ ] **Step 5: Run tests**

```bash
cd web-ui && npx vitest run src/features/portfolio/hooks.test.tsx
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web-ui/src/features/portfolio/api.ts web-ui/src/features/portfolio/hooks.ts
git commit -m "feat: add fetchSymbolHistory and useSymbolHistory hook"
```

---

## Task 8: `SymbolTradeHistory` component

**Files:**
- Create: `web-ui/src/components/domain/workspace/SymbolTradeHistory.tsx`
- Create: `web-ui/src/components/domain/workspace/SymbolTradeHistory.test.tsx`

- [ ] **Step 1: Write failing test**

Create `web-ui/src/components/domain/workspace/SymbolTradeHistory.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import SymbolTradeHistory from './SymbolTradeHistory';

const closedPosition = {
  ticker: 'AAPL',
  status: 'closed' as const,
  entry_date: '2026-01-10',
  entry_price: 100,
  stop_price: 95,
  shares: 5,
  exit_date: '2026-02-01',
  exit_price: 110,
  notes: '',
  position_id: 'pos-1',
  source_order_id: null,
  initial_risk: 25,
  max_favorable_price: null,
  current_price: null,
  exit_order_ids: null,
};

describe('SymbolTradeHistory', () => {
  it('shows past trades table with R outcome', async () => {
    server.use(
      http.get('*/api/portfolio/symbol-history/AAPL', () =>
        HttpResponse.json({
          ticker: 'AAPL',
          positions: [closedPosition],
          open_count: 0,
          closed_count: 1,
        })
      )
    );

    renderWithProviders(<SymbolTradeHistory ticker="AAPL" />);

    expect(await screen.findByText('AAPL')).toBeInTheDocument();
    expect(await screen.findByText('1 trade')).toBeInTheDocument();
  });

  it('shows empty state when no history', async () => {
    server.use(
      http.get('*/api/portfolio/symbol-history/MSFT', () =>
        HttpResponse.json({ ticker: 'MSFT', positions: [], open_count: 0, closed_count: 0 })
      )
    );

    renderWithProviders(<SymbolTradeHistory ticker="MSFT" />);

    expect(await screen.findByText(/no past trades/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd web-ui && npx vitest run src/components/domain/workspace/SymbolTradeHistory.test.tsx
```
Expected: module not found.

- [ ] **Step 3: Implement `SymbolTradeHistory`**

Create `web-ui/src/components/domain/workspace/SymbolTradeHistory.tsx`:

```typescript
import { useSymbolHistory } from '@/features/portfolio/hooks';
import { useScreenerRecurrence } from '@/features/screener/recurrenceHooks';
import { transformPosition } from '@/types/position';
import { cn } from '@/utils/cn';
import { formatNumber } from '@/utils/formatters';

interface SymbolTradeHistoryProps {
  ticker: string;
}

function ROutcome({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <span className={cn('font-semibold tabular-nums text-xs', isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
      {isPositive ? '+' : ''}{formatNumber(value, 2)}R
    </span>
  );
}

export default function SymbolTradeHistory({ ticker }: SymbolTradeHistoryProps) {
  const { data, isLoading } = useSymbolHistory(ticker);
  const recurrenceQuery = useScreenerRecurrence();
  const recurrence = recurrenceQuery.data?.find(r => r.ticker.toUpperCase() === ticker.toUpperCase());

  if (isLoading) {
    return <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading history…</div>;
  }

  const positions = (data?.positions ?? []).map(transformPosition);
  const closedPositions = positions.filter(p => p.status === 'closed');
  const openPositions = positions.filter(p => p.status === 'open');

  if (positions.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
        No past trades for {ticker}.
      </div>
    );
  }

  // Summary stats
  const wins = closedPositions.filter(p => (p.exitPrice ?? 0) > p.entryPrice);
  const winRate = closedPositions.length > 0 ? Math.round((wins.length / closedPositions.length) * 100) : 0;
  const rOutcomes = closedPositions.map(p => {
    const riskPerShare = p.entryPrice - p.stopPrice;
    if (riskPerShare <= 0 || !p.exitPrice) return 0;
    return (p.exitPrice - p.entryPrice) / riskPerShare;
  });
  const avgR = rOutcomes.length > 0 ? rOutcomes.reduce((a, b) => a + b, 0) / rOutcomes.length : 0;
  const tradeLabel = closedPositions.length === 1 ? '1 trade' : `${closedPositions.length} trades`;

  return (
    <div className="space-y-4 px-1">
      {/* Ticker heading */}
      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{ticker}</div>

      {/* Summary */}
      {closedPositions.length >= 2 && (
        <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded px-3 py-2">
          {tradeLabel} · win rate {winRate}% · avg outcome <ROutcome value={avgR} />
        </div>
      )}

      {/* Screener recurrence */}
      {recurrence && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Seen in screener {recurrence.daysSeen}×
          {recurrence.streak > 1 ? ` · ${recurrence.streak}-day streak` : ''}
          {recurrence.lastSeen ? ` · last seen ${recurrence.lastSeen}` : ''}
        </div>
      )}

      {/* Open position card */}
      {openPositions.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs space-y-1">
          <div className="font-semibold text-amber-700 dark:text-amber-400">Open position</div>
          {openPositions.map(p => (
            <div key={p.positionId} className="flex gap-3 text-gray-700 dark:text-gray-300">
              <span>Entry {formatNumber(p.entryPrice, 2)}</span>
              <span>Stop {formatNumber(p.stopPrice, 2)}</span>
              <span>{p.shares} shares</span>
            </div>
          ))}
        </div>
      )}

      {/* Closed trades table */}
      {closedPositions.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Past trades</div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {closedPositions.map((p, i) => {
              const riskPerShare = p.entryPrice - p.stopPrice;
              const rOutcome = riskPerShare > 0 && p.exitPrice
                ? (p.exitPrice - p.entryPrice) / riskPerShare
                : 0;
              return (
                <div key={p.positionId ?? i} className="py-2 text-xs text-gray-700 dark:text-gray-300 grid grid-cols-[auto_1fr_auto] gap-x-3 items-start">
                  <div>
                    <div className="tabular-nums text-gray-400 dark:text-gray-500">{p.entryDate}</div>
                    {p.exitDate && <div className="tabular-nums text-gray-400 dark:text-gray-500">→ {p.exitDate}</div>}
                  </div>
                  <div>
                    <div>Entry {formatNumber(p.entryPrice, 2)} → {p.exitPrice ? formatNumber(p.exitPrice, 2) : '—'}</div>
                    {p.notes && <div className="text-gray-400 dark:text-gray-500 truncate">{p.notes}</div>}
                    {p.lesson && <div className="text-gray-400 dark:text-gray-500 italic truncate">{p.lesson}</div>}
                  </div>
                  <ROutcome value={rOutcome} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd web-ui && npx vitest run src/components/domain/workspace/SymbolTradeHistory.test.tsx
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/components/domain/workspace/SymbolTradeHistory.tsx web-ui/src/components/domain/workspace/SymbolTradeHistory.test.tsx
git commit -m "feat: add SymbolTradeHistory component with R-outcome table and recurrence"
```

---

## Task 9: `ReentryChecklistModal` component

**Files:**
- Create: `web-ui/src/components/domain/recommendation/ReentryChecklistModal.tsx`
- Create: `web-ui/src/components/domain/recommendation/ReentryChecklistModal.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `web-ui/src/components/domain/recommendation/ReentryChecklistModal.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import ReentryChecklistModal from './ReentryChecklistModal';
import type { PriorTradeContext, ReentryGateResult } from '@/features/screener/types';

const priorTrades: PriorTradeContext = {
  lastExitDate: '2026-03-01',
  lastExitPrice: 95,
  lastEntryPrice: 100,
  lastROutcome: -1.0,
  wasProfitable: false,
  tradeCount: 1,
};

const reentryGate: ReentryGateResult = {
  suppressed: false,
  checks: {
    thesis_valid: { passed: true, reason: 'RECOMMENDED.' },
    new_setup_present: { passed: true, reason: 'Structural.' },
    stop_defined: { passed: true, reason: 'Structural.' },
    reward_sufficient: { passed: true, reason: 'R/R 2.5 >= 2.0.' },
    position_size_reset: { passed: true, reason: 'Structural.' },
    timeframe_fits: { passed: true, reason: 'Structural.' },
    market_context_clean: { passed: true, reason: 'No upcoming earnings.' },
  },
};

describe('ReentryChecklistModal', () => {
  it('renders ticker and prior trade summary', () => {
    renderWithProviders(
      <ReentryChecklistModal
        ticker="AAPL"
        priorTrades={priorTrades}
        reentryGate={reentryGate}
        onProceed={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByText(/AAPL/)).toBeInTheDocument();
    expect(screen.getByText(/Re-entry Checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/−1\.0R/)).toBeInTheDocument();
  });

  it('proceed button is disabled until manual checkbox is ticked', () => {
    renderWithProviders(
      <ReentryChecklistModal
        ticker="AAPL"
        priorTrades={priorTrades}
        reentryGate={reentryGate}
        onProceed={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    const proceed = screen.getByRole('button', { name: /proceed/i });
    expect(proceed).toBeDisabled();

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(proceed).toBeEnabled();
  });

  it('calls onProceed when proceed is clicked after checkbox', () => {
    const onProceed = vi.fn();
    renderWithProviders(
      <ReentryChecklistModal
        ticker="AAPL"
        priorTrades={priorTrades}
        reentryGate={reentryGate}
        onProceed={onProceed}
        onSkip={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /proceed/i }));

    expect(onProceed).toHaveBeenCalledOnce();
  });

  it('calls onSkip when skip button is clicked', () => {
    const onSkip = vi.fn();
    renderWithProviders(
      <ReentryChecklistModal
        ticker="AAPL"
        priorTrades={priorTrades}
        reentryGate={reentryGate}
        onProceed={vi.fn()}
        onSkip={onSkip}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('shows stop-out warning when last trade was a loss', () => {
    renderWithProviders(
      <ReentryChecklistModal
        ticker="AAPL"
        priorTrades={{ ...priorTrades, wasProfitable: false }}
        reentryGate={reentryGate}
        onProceed={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByText(/stop-out/i)).toBeInTheDocument();
  });

  it('shows failed check with reason text', () => {
    const gateWithFail: ReentryGateResult = {
      suppressed: false,
      checks: {
        ...reentryGate.checks,
        reward_sufficient: { passed: false, reason: 'R/R 1.5 is below threshold 2.0.' },
      },
    };

    renderWithProviders(
      <ReentryChecklistModal
        ticker="AAPL"
        priorTrades={priorTrades}
        reentryGate={gateWithFail}
        onProceed={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByText(/R\/R 1\.5 is below threshold/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd web-ui && npx vitest run src/components/domain/recommendation/ReentryChecklistModal.test.tsx
```
Expected: module not found.

- [ ] **Step 3: Implement `ReentryChecklistModal`**

Create `web-ui/src/components/domain/recommendation/ReentryChecklistModal.tsx`:

```typescript
import { useState } from 'react';
import ModalShell from '@/components/common/ModalShell';
import Button from '@/components/common/Button';
import { cn } from '@/utils/cn';
import { formatNumber } from '@/utils/formatters';
import type { PriorTradeContext, ReentryGateResult } from '@/features/screener/types';

const CHECK_LABELS: Record<string, string> = {
  thesis_valid: 'Thesis still valid',
  new_setup_present: 'New setup present',
  stop_defined: 'Stop defined',
  reward_sufficient: 'Reward still worth it',
  position_size_reset: 'Position size reset',
  timeframe_fits: 'Timeframe still fits',
  market_context_clean: 'Market context unchanged',
};

const CHECK_ORDER = [
  'thesis_valid',
  'new_setup_present',
  'stop_defined',
  'reward_sufficient',
  'position_size_reset',
  'timeframe_fits',
  'market_context_clean',
];

interface ReentryChecklistModalProps {
  ticker: string;
  priorTrades: PriorTradeContext;
  reentryGate: ReentryGateResult;
  onProceed: () => void;
  onSkip: () => void;
}

export default function ReentryChecklistModal({
  ticker,
  priorTrades,
  reentryGate,
  onProceed,
  onSkip,
}: ReentryChecklistModalProps) {
  const [intentConfirmed, setIntentConfirmed] = useState(false);

  const rLabel = priorTrades.lastROutcome >= 0
    ? `+${formatNumber(priorTrades.lastROutcome, 1)}R ✓`
    : `${formatNumber(priorTrades.lastROutcome, 1)}R ✗`;

  const daysSince = priorTrades.lastExitDate
    ? Math.round((Date.now() - new Date(priorTrades.lastExitDate).getTime()) / 86_400_000)
    : null;

  return (
    <ModalShell
      title={`${ticker} — Re-entry Checklist`}
      onClose={onSkip}
    >
      {/* Prior trade summary */}
      <div className="mb-4 flex items-center gap-3 text-sm">
        <span className={cn(
          'font-semibold',
          priorTrades.wasProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        )}>
          Last trade: {rLabel}
        </span>
        {daysSince !== null && (
          <span className="text-xs text-gray-500 dark:text-gray-400">exited {daysSince}d ago</span>
        )}
        {priorTrades.tradeCount > 1 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">· {priorTrades.tradeCount}× traded</span>
        )}
      </div>

      {/* Stop-out warning */}
      {!priorTrades.wasProfitable && (
        <div className="mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          Prior trade was a stop-out — confirm the setup was genuinely invalidated before re-entering.
        </div>
      )}

      {/* Auto-evaluated checks */}
      <div className="space-y-2 mb-5">
        {CHECK_ORDER.map((key) => {
          const check = reentryGate.checks[key];
          if (!check) return null;
          return (
            <div key={key} className="flex items-start gap-2 text-sm">
              <span className={cn('mt-0.5 shrink-0 text-base', check.passed ? 'text-green-500' : 'text-amber-500')}>
                {check.passed ? '✓' : '⚠'}
              </span>
              <div>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {CHECK_LABELS[key] ?? key}
                </span>
                {!check.passed && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{check.reason}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual intent confirmation */}
      <label className="flex items-start gap-2 cursor-pointer mb-5">
        <input
          type="checkbox"
          checked={intentConfirmed}
          onChange={(e) => setIntentConfirmed(e.target.checked)}
          className="mt-0.5 rounded"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          I am not re-entering out of emotion or FOMO
        </span>
      </label>

      {/* Footer */}
      <div className="flex gap-3 justify-end">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Skip — no trade
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onProceed}
          disabled={!intentConfirmed}
        >
          Proceed to order setup
        </Button>
      </div>
    </ModalShell>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd web-ui && npx vitest run src/components/domain/recommendation/ReentryChecklistModal.test.tsx
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/components/domain/recommendation/ReentryChecklistModal.tsx web-ui/src/components/domain/recommendation/ReentryChecklistModal.test.tsx
git commit -m "feat: add ReentryChecklistModal with auto-eval display and manual intent gate"
```

---

## Task 10: Analysis canvas — add History tab

**Files:**
- Modify: `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx`

- [ ] **Step 1: Add History tab to tab bar in `SymbolAnalysisContent.tsx`**

Read the current tab bar section. Find the tab array/map that renders `overview`, `fundamentals`, `intelligence`, `order` tabs. Add `history` entry.

Find the existing tabs definition (around line 90-120 in `SymbolAnalysisContent.tsx`) — it renders tab buttons via a map. Add a tab for history that only renders when there is prior trade data available.

Add the import at the top:
```typescript
import SymbolTradeHistory from '@/components/domain/workspace/SymbolTradeHistory';
```

In the tab bar buttons section, add after the existing tabs:

```typescript
{/* Only show History tab when candidate has prior_trades */}
{candidate?.priorTrades && (
  <button
    key="history"
    type="button"
    onClick={() => onTabChange('history')}
    className={cn(
      'px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
      activeTab === 'history'
        ? 'border-b-2 border-primary text-primary'
        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
    )}
  >
    History
  </button>
)}
```

In the tab content section, add a History panel after the existing tab panels:
```typescript
{activeTab === 'history' && (
  <div className="overflow-y-auto flex-1 pt-2">
    <SymbolTradeHistory ticker={ticker} />
  </div>
)}
```

- [ ] **Step 2: Run typecheck**

```bash
cd web-ui && npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
cd web-ui && npm test
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx
git commit -m "feat: add History tab to analysis canvas when prior trade data exists"
```

---

## Task 11: Re-entry badge on Today page + ADD_ON/MANAGE_ONLY improvements

**Files:**
- Modify: `web-ui/src/pages/Today.tsx`
- Modify: `web-ui/src/components/domain/screener/ScreenerCandidateIdentityCell.tsx`

- [ ] **Step 1: Update `CandidateItem` in `web-ui/src/pages/Today.tsx`**

At the top of the file, add imports:
```typescript
import ReentryChecklistModal from '@/components/domain/recommendation/ReentryChecklistModal';
import type { ScreenerCandidate } from '@/features/screener/types';
```

Update `CandidateItemProps` to accept full candidate:
```typescript
interface CandidateItemProps {
  item: DailyReviewCandidate;
  candidate?: ScreenerCandidate;  // add this
  isAddOn?: boolean;
  onClick: (ticker: string) => void;
  isFocused?: boolean;
}
```

Update `CandidateItem` to show re-entry badge and gate the click through the checklist modal:

```typescript
function CandidateItem({ item, candidate, isAddOn, onClick, isFocused }: CandidateItemProps) {
  const [showReentryModal, setShowReentryModal] = useState(false);
  const isReentry = !!candidate?.priorTrades;

  const handleClick = () => {
    if (isReentry && candidate?.reentryGate && !candidate.reentryGate.suppressed) {
      setShowReentryModal(true);
    } else {
      onClick(item.ticker);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
          isReentry ? 'border-l-2 border-amber-400' : 'border-l-2 border-blue-500',
          isFocused && 'ring-1 ring-primary',
        )}
      >
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[60px]">
          {item.ticker}
        </span>
        {isReentry ? (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            ↩ Re-entry
          </span>
        ) : isAddOn ? (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
            {t('todayPage.actionList.addOn')}
          </span>
        ) : (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            {item.decisionSummary?.action ?? item.signal}
          </span>
        )}
        {isReentry && candidate?.priorTrades && (
          <span className={cn(
            'text-xs tabular-nums',
            candidate.priorTrades.wasProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          )}>
            Last: {candidate.priorTrades.wasProfitable ? '+' : ''}{formatNumber(candidate.priorTrades.lastROutcome, 1)}R
            {candidate.priorTrades.wasProfitable ? ' ✓' : ' ✗'}
          </span>
        )}
        {!isReentry && (
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
            r/r: {formatNumber(item.rReward, 2)}R
          </span>
        )}
        {item.name && (
          <span className="text-xs text-gray-400 dark:text-gray-500 truncate flex-1">{item.name}</span>
        )}
      </button>

      {showReentryModal && candidate?.priorTrades && candidate.reentryGate && (
        <ReentryChecklistModal
          ticker={item.ticker}
          priorTrades={candidate.priorTrades}
          reentryGate={candidate.reentryGate}
          onProceed={() => {
            setShowReentryModal(false);
            onClick(item.ticker);
          }}
          onSkip={() => setShowReentryModal(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Update `ScreenerCandidateIdentityCell.tsx` for ADD_ON/MANAGE_ONLY**

Read the current file. Find where `same_symbol` mode is displayed. Replace the existing ADD_ON/MANAGE_ONLY badge rendering with:

```typescript
{candidate.sameSymbol?.mode === 'ADD_ON' && (
  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
    ADD-ON · open @ ${formatNumber(candidate.sameSymbol.currentPositionEntry ?? 0, 2)}
  </span>
)}
{candidate.sameSymbol?.mode === 'MANAGE_ONLY' && (
  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400">
    MANAGE ONLY
  </span>
)}
{candidate.priorTrades && !candidate.sameSymbol && (
  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
    ↩ Re-entry
  </span>
)}
```

For the row border-left color, find the className on the candidate row container and update:
```typescript
className={cn(
  '...existing classes...',
  candidate.sameSymbol?.mode === 'ADD_ON' && 'border-l-2 border-amber-400',
  candidate.sameSymbol?.mode === 'MANAGE_ONLY' && 'border-l-2 border-gray-400',
  candidate.priorTrades && !candidate.sameSymbol && 'border-l-2 border-amber-300',
)}
```

- [ ] **Step 3: Run tests**

```bash
cd web-ui && npm test
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/pages/Today.tsx web-ui/src/components/domain/screener/ScreenerCandidateIdentityCell.tsx
git commit -m "feat: add re-entry badge to CandidateItem and improve ADD_ON/MANAGE_ONLY labels"
```

---

## Task 12: i18n keys

**Files:**
- Modify: `web-ui/src/i18n/resources.ts`

- [ ] **Step 1: Check current i18n structure**

Read `web-ui/src/i18n/resources.ts` to find the existing key structure. Add new keys following the same pattern.

- [ ] **Step 2: Add new keys**

In the resources object, add under an appropriate namespace:

```typescript
reentryChecklist: {
  title: 'Re-entry Checklist',
  lastTrade: 'Last trade',
  exitedAgo: 'exited {{days}}d ago',
  stopOutWarning: 'Prior trade was a stop-out — confirm the setup was genuinely invalidated before re-entering.',
  intentLabel: 'I am not re-entering out of emotion or FOMO',
  proceedButton: 'Proceed to order setup',
  skipButton: 'Skip — no trade',
  checks: {
    thesis_valid: 'Thesis still valid',
    new_setup_present: 'New setup present',
    stop_defined: 'Stop defined',
    reward_sufficient: 'Reward still worth it',
    position_size_reset: 'Position size reset',
    timeframe_fits: 'Timeframe still fits',
    market_context_clean: 'Market context unchanged',
  },
},
symbolHistory: {
  tabLabel: 'History',
  noPastTrades: 'No past trades for {{ticker}}.',
  summary: '{{count}} trade · win rate {{winRate}}% · avg outcome',
  summaryPlural: '{{count}} trades · win rate {{winRate}}% · avg outcome',
  openPosition: 'Open position',
  pastTrades: 'Past trades',
  seenInScreener: 'Seen in screener {{count}}×',
  dayStreak: '{{count}}-day streak',
  lastSeen: 'last seen {{date}}',
},
```

- [ ] **Step 3: Update `ReentryChecklistModal` and `SymbolTradeHistory` to use i18n keys**

Replace hardcoded strings in both components with `t(...)` calls using the new keys.

- [ ] **Step 4: Run tests**

```bash
cd web-ui && npm test
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/i18n/resources.ts web-ui/src/components/domain/recommendation/ReentryChecklistModal.tsx web-ui/src/components/domain/workspace/SymbolTradeHistory.tsx
git commit -m "feat: add i18n keys for re-entry checklist and symbol history"
```

---

## Task 13: Final verification

- [ ] **Step 1: Run full backend test suite**

```bash
pytest -q
```
Expected: all tests pass.

- [ ] **Step 2: Run full frontend test suite**

```bash
cd web-ui && npm test
```
Expected: all tests pass with coverage thresholds met.

- [ ] **Step 3: Typecheck frontend**

```bash
cd web-ui && npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Lint frontend**

```bash
cd web-ui && npm run lint
```
Expected: zero warnings.

- [ ] **Step 5: Final commit if needed**

```bash
git add -p
git commit -m "chore: final cleanup for symbol-intelligence-ux feature"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✓ Section 1: `PriorTradeContext`, `ReentryGateResult` in screener candidate → Tasks 1–4
- ✓ Section 1: `GET /portfolio/symbol-history/{ticker}` → Task 5
- ✓ Section 2: Re-entry badge, ADD_ON/MANAGE_ONLY improvements → Task 11
- ✓ Section 3: Auto-evaluated gate rules (7 checks), suppression logic → Tasks 3–4
- ✓ Section 3: Modal with auto-eval display + single manual checkbox → Task 9
- ✓ Section 4: History tab in analysis canvas → Tasks 8, 10

**Type consistency:**
- `PriorTradeContext` defined in Task 1 (backend), Task 6 (frontend) — same shape
- `ReentryGateResult.checks` is `dict[str, ReentryCheckResult]` (backend) / `Record<string, ReentryCheckResult>` (frontend) — consistent
- `useSymbolHistory` returns `SymbolHistoryResponse` — defined in Task 7, consumed in Task 8

**No placeholders:** All steps include concrete code. Task 11 Step 2 references reading the current file first — this is required because the exact line numbers for `ScreenerCandidateIdentityCell` were not pre-read; the instruction is clear about what to change and what to look for.
