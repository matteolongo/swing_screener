from __future__ import annotations

import math

import pytest

from api.models.recommendation import (
    ExecutionNextStepModel,
    Recommendation,
    RecommendationCosts,
    RecommendationEducation,
    RecommendationRisk,
)


def _recommendation(
    *,
    workflow_status: str,
    next_step: ExecutionNextStepModel,
) -> Recommendation:
    return Recommendation(
        verdict="RECOMMENDED",
        reasons_short=[],
        reasons_detailed=[],
        risk=RecommendationRisk(
            entry=100.0,
            stop=95.0,
            target=110.0,
            desired_target=110.0,
            target_source="structural",
            rr=2.0,
            risk_amount=50.0,
            risk_pct=0.01,
            position_size=1000.0,
            shares=10,
        ),
        costs=RecommendationCosts(
            commission_estimate=0.0,
            fx_estimate=0.0,
            slippage_estimate=0.0,
            total_cost=0.0,
        ),
        checklist=[],
        workflow_status=workflow_status,
        next_step=next_step,
        education=RecommendationEducation(
            common_bias_warning="",
            what_to_learn="",
            what_would_make_valid=[],
        ),
    )


def test_execution_next_step_normalizes_non_finite_trigger_price():
    step = ExecutionNextStepModel(
        code="wait_pullback",
        trigger_price=math.nan,
        currency="USD",
    )

    assert step.trigger_price is None


@pytest.mark.parametrize(
    ("status", "step"),
    [
        ("ready", ExecutionNextStepModel(code="observe")),
        ("waiting_trigger", ExecutionNextStepModel(code="wait_pullback")),
        (
            "waiting_trigger",
            ExecutionNextStepModel(
                code="wait_breakout_close",
                trigger_price=105.0,
                currency="UNKNOWN",
            ),
        ),
        (
            "waiting_trigger",
            ExecutionNextStepModel(
                code="wait_breakout_close",
                trigger_price=105.0,
                currency="US",
            ),
        ),
        (
            "no_setup",
            ExecutionNextStepModel(
                code="observe",
                trigger_price=100.0,
                currency="USD",
            ),
        ),
    ],
)
def test_recommendation_normalizes_incoherent_workflow_pairs(status, step):
    recommendation = _recommendation(workflow_status=status, next_step=step)

    assert recommendation.workflow_status == "needs_review"
    assert recommendation.next_step == ExecutionNextStepModel(code="refresh_data")


@pytest.mark.parametrize(
    ("status", "step"),
    [
        ("ready", ExecutionNextStepModel(code="review_order")),
        (
            "waiting_trigger",
            ExecutionNextStepModel(
                code="wait_pullback",
                trigger_price=98.5,
                currency="usd",
            ),
        ),
        ("needs_review", ExecutionNextStepModel(code="define_target")),
        ("no_setup", ExecutionNextStepModel(code="observe")),
    ],
)
def test_recommendation_preserves_coherent_workflow_pairs(status, step):
    recommendation = _recommendation(workflow_status=status, next_step=step)

    assert recommendation.workflow_status == status
    assert recommendation.next_step.code == step.code
