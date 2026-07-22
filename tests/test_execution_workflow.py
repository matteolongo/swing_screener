import math

import pytest

from swing_screener.risk.recommendations.workflow import derive_execution_workflow


@pytest.mark.parametrize(
    (
        "setup",
        "trigger",
        "plan",
        "signal",
        "price",
        "currency",
        "reason_codes",
        "expected_status",
        "expected_code",
    ),
    [
        ("BLOCK", "WAIT", "PASS", "none", 100.0, "USD", [], "no_setup", "observe"),
        (
            "UNKNOWN",
            "PASS",
            "PASS",
            "breakout",
            100.0,
            "USD",
            [],
            "needs_review",
            "inspect_gate_conflict",
        ),
        (
            "PASS",
            "PASS",
            "UNKNOWN",
            "breakout",
            100.0,
            "USD",
            ["TARGET_NOT_VALIDATED"],
            "needs_review",
            "define_target",
        ),
        (
            "PASS",
            "PASS",
            "BLOCK",
            "breakout",
            100.0,
            "USD",
            ["STOP_INVALID"],
            "needs_review",
            "fix_stop",
        ),
        (
            "PASS",
            "PASS",
            "BLOCK",
            "breakout",
            100.0,
            "USD",
            ["DATA_NOT_CURRENT"],
            "needs_review",
            "refresh_data",
        ),
        (
            "PASS",
            "BLOCK",
            "PASS",
            "breakout",
            100.0,
            "USD",
            [],
            "needs_review",
            "inspect_gate_conflict",
        ),
        (
            "PASS",
            "WAIT",
            "PASS",
            "BUY_ON_PULLBACK",
            98.5,
            "USD",
            [],
            "waiting_trigger",
            "wait_pullback",
        ),
        (
            "PASS",
            "WAIT",
            "PASS",
            "WAIT_FOR_BREAKOUT",
            105.0,
            "EUR",
            [],
            "waiting_trigger",
            "wait_breakout_close",
        ),
        (
            "PASS",
            "WAIT",
            "PASS",
            "BUY_ON_PULLBACK",
            0.0,
            "USD",
            [],
            "needs_review",
            "refresh_data",
        ),
        (
            "PASS",
            "WAIT",
            "PASS",
            "BUY_ON_PULLBACK",
            98.5,
            "UNKNOWN",
            [],
            "needs_review",
            "refresh_data",
        ),
        ("PASS", "PASS", "PASS", "breakout", 100.0, "USD", [], "ready", "review_order"),
    ],
)
def test_execution_workflow_precedence(
    setup,
    trigger,
    plan,
    signal,
    price,
    currency,
    reason_codes,
    expected_status,
    expected_code,
):
    result = derive_execution_workflow(
        setup_status=setup,
        trigger_status=trigger,
        plan_status=plan,
        signal=signal,
        trigger_price=price,
        currency=currency,
        reason_codes=reason_codes,
    )

    assert result.status == expected_status
    assert result.next_step.code == expected_code


def test_waiting_workflow_carries_nonlocalized_parameters():
    result = derive_execution_workflow(
        setup_status="PASS",
        trigger_status="WAIT",
        plan_status="PASS",
        signal="BUY_ON_PULLBACK",
        trigger_price=98.5,
        currency="USD",
        reason_codes=[],
    )

    assert result.next_step.trigger_price == 98.5
    assert result.next_step.currency == "USD"


@pytest.mark.parametrize("trigger_price", [float("nan"), float("inf")])
def test_waiting_workflow_requires_finite_trigger_price(trigger_price):
    result = derive_execution_workflow(
        setup_status="PASS",
        trigger_status="WAIT",
        plan_status="PASS",
        signal="BUY_ON_PULLBACK",
        trigger_price=trigger_price,
        currency="USD",
        reason_codes=[],
    )

    assert not math.isfinite(trigger_price)
    assert result.status == "needs_review"
    assert result.next_step.code == "refresh_data"
