# Swing Screener Education-First Refactor Plan

> **Status: Needs review.** Confirm which education refactor steps are complete.  
> **Last Reviewed:** February 17, 2026.

Date: 2026-02-10

## Executive Summary
The platform already computes strong signal and risk primitives, but they are not surfaced as structured recommendations or enforced as beginner-safe gates. The refactor introduces a Recommendation Engine that returns explicit verdicts, reasons, costs, and checklist gates. The UI will show progressive disclosure (summary first, details on demand) and block or clearly warn against invalid setups. Backtesting will be upgraded for teaching realism with fees, slippage, and education-focused metrics, while preserving end-of-day cadence and manual execution.

## Codebase Audit (Current State)
Backend
- Strategy config: `src/swing_screener/strategy/storage.py`, `src/swing_screener/strategy/config.py`, `api/models/strategy.py`
- Universe + ranking: `src/swing_screener/screeners/universe.py`, `src/swing_screener/screeners/ranking.py`
- Signals: `src/swing_screener/signals/entries.py`
- Risk sizing: `src/swing_screener/risk/position_sizing.py`
- Regime risk scaling: `src/swing_screener/risk/regime.py`
- Execution guidance: `src/swing_screener/execution/guidance.py`
- Screener pipeline: `src/swing_screener/reporting/report.py`
- Screener API: `api/services/screener_service.py`, `api/models/screener.py`
- Backtesting core: `src/swing_screener/backtest/simulator.py`
- Backtesting API: `api/services/backtest_service.py`, `api/models/backtest.py`

Frontend
- Screener UI + order modal: `web-ui/src/pages/Screener.tsx`
- Dashboard (P&L focus): `web-ui/src/pages/Dashboard.tsx`
- Backtest UI: `web-ui/src/pages/Backtest.tsx`
- Types + transforms: `web-ui/src/types/screener.ts`, `web-ui/src/types/backtest.ts`

Current data flow
- Strategy config → `build_*_config` → screener pipeline → report dataframe
- Report dataframe (plans + signals + guidance) → API response
- UI renders ranking-centric table and allows order creation
- Backtest pipeline returns R-based metrics with limited cost realism

Key UX gaps vs goals
- No recommendation verdicts or checklist gating
- Order creation can proceed without explicit stop or RR guardrails
- “Total P&L” is prominent, contrary to decision guidance
- Backtests lack FX, slippage, and fee impact breakdown

## Refactor Plan (Phased)

### P0 (Foundations: Recommendation + Risk Gates)
Goal: enforce risk-first gating and display verdicts + reasons.

Backend
- Add Recommendation Engine module (pure functions)
- Extend Screener API to include:
  - signal, entry, stop, target, RR, shares, position size, risk $
  - recommendation payload
- Add cost model (commission + slippage + FX estimate)
- Add risk gate checks:
  - Stop defined and valid
  - Active signal
  - RR >= 2.0 baseline
  - Fee-to-risk ratio <= 20%
  - Tradable size >= min_shares
  - Overlay veto gate

Frontend
- Show Recommended / Not Recommended badge per candidate
- Provide short reasons (2–3) with progressive disclosure in details
- Show “Fix it” suggestions
- Disable order submission when verdict is NOT_RECOMMENDED

### P1 (Modularity + Education UX)
- Introduce Strategy Modules registry (plug-in architecture)
- Separate Risk Engine from strategy logic
- Add EOD checklist UI with gate status
- Backtest improvements: slippage + FX + fees impact, education report

### P2 (Teaching Depth + Polish)
- Actionable “what would make valid” guidance
- “Why backtest differs from live” section
- Bias warnings tied to gate failures
- Dashboard emphasizes risk budget and open risk (P&L secondary)

## Recommendation Engine Contract (Target Output)
```
{
  verdict: "RECOMMENDED" | "NOT_RECOMMENDED",
  reasons_short: [...],
  reasons_detailed: [...],
  risk: { entry, stop, target, rr, risk_amount, risk_pct, position_size },
  costs: { fees, fx_estimate, slippage_estimate },
  checklist: { gate_name: pass/fail + explanation },
  education: { common_bias_warning, what_to_learn, what_would_make_valid }
}
```

## UI Component Plan
- Screener table: add Recommendation badge + short reasons tooltip
- Candidate details panel: progressive disclosure (summary → details → fix-it)
- Create Order modal: show recommendation summary + block invalid
- Dashboard: de-emphasize Total P&L, highlight open risk and risk budget

## Backtesting Additions
Cost realism
- Commission, FX, slippage model applied per trade
Education metrics
- Max drawdown, win rate, avg win/avg loss, expectancy, profit factor
- Trade frequency, fee impact, RR distribution
Education report
- Narrative “what drove results” + “where costs hurt”

## Test Plan
Backend
- Unit tests for recommendation gates and cost model
- API tests for recommendation payload consistency

Frontend
- Screener tests for verdict display and gating
- Create Order modal tests for block-on-not-recommended
- Backtest tests for new metrics and education report
