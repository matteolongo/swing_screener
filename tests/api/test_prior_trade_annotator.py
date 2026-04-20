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
