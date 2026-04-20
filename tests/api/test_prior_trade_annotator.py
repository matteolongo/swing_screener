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
    initial_risk: float = 25.0,
    exit_date: str = "2026-03-01",
):
    from types import SimpleNamespace
    return SimpleNamespace(
        ticker=ticker,
        status="closed",
        entry_price=entry_price,
        exit_price=exit_price,
        stop_price=stop_price,
        initial_risk=initial_risk,
        exit_date=exit_date,
        shares=5,
    )


def test_annotator_attaches_prior_trades():
    annotator = PriorTradeAnnotator()
    candidate = _make_candidate("AAPL")
    closed = [_make_closed_position("AAPL", entry_price=100.0, exit_price=110.0, stop_price=95.0)]

    result = annotator.annotate([candidate], closed_positions=closed)

    assert result[0].prior_trades is not None
    assert result[0].prior_trades.was_profitable is True
    assert result[0].prior_trades.trade_count == 1
    assert result[0].prior_trades.last_exit_date == "2026-03-01"


def test_annotator_computes_r_outcome():
    annotator = PriorTradeAnnotator()
    candidate = _make_candidate("AAPL")
    # entry=100, exit=110, stop=95 → risk_per_share=5, gain=10 → R=2.0
    closed = [_make_closed_position("AAPL", entry_price=100.0, exit_price=110.0, stop_price=95.0)]

    result = annotator.annotate([candidate], closed_positions=closed)

    assert abs(result[0].prior_trades.last_r_outcome - 2.0) < 0.01


def test_annotator_loss_trade():
    annotator = PriorTradeAnnotator()
    candidate = _make_candidate("AAPL")
    # entry=100, exit=95 (stop hit), stop=95, risk_per_share=5, loss=-5 → R=-1.0
    closed = [_make_closed_position("AAPL", entry_price=100.0, exit_price=95.0, stop_price=95.0)]

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
    older = _make_closed_position("AAPL", exit_price=108.0, exit_date="2026-01-01")
    recent = _make_closed_position("AAPL", exit_price=115.0, exit_date="2026-03-15")

    result = annotator.annotate([candidate], closed_positions=[older, recent])

    assert result[0].prior_trades.last_exit_date == "2026-03-15"
    assert result[0].prior_trades.trade_count == 2
