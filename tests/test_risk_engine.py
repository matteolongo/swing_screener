import pytest

from swing_screener.risk.engine import RiskEngineConfig, evaluate_recommendation
from swing_screener.risk.position_sizing import RiskConfig


def test_risk_engine_respects_min_rr():
    risk_cfg = RiskConfig(
        account_size=100000.0,
        risk_pct=0.01,
        max_position_pct=0.6,
        min_shares=1,
        k_atr=2.0,
        min_rr=3.0,
        max_fee_risk_pct=0.2,
    )

    rec = evaluate_recommendation(
        signal="breakout",
        entry=100.0,
        stop=99.0,
        shares=100,
        risk_cfg=risk_cfg,
        rr_target=2.0,
        target=102.0,
        target_source="structural",
        costs=RiskEngineConfig(
            commission_pct=0.0, slippage_bps=0.0, fx_estimate_pct=0.0
        ),
    )

    assert rec.verdict == "NOT_RECOMMENDED"
    assert any(r.code == "RR_TOO_LOW" for r in rec.reasons_detailed)


def test_risk_engine_passes_account_to_quote_rate_to_recommendation():
    risk_cfg = RiskConfig(
        account_size=1000.0,
        risk_pct=0.01,
        max_position_pct=1.0,
        min_shares=1,
        k_atr=1.0,
        min_rr=2.0,
        max_fee_risk_pct=0.2,
        account_currency="EUR",
    )

    rec = evaluate_recommendation(
        signal="breakout",
        entry=100.0,
        stop=98.0,
        shares=None,
        risk_cfg=risk_cfg,
        rr_target=2.0,
        costs=RiskEngineConfig(
            commission_pct=0.0, slippage_bps=0.0, fx_estimate_pct=0.0
        ),
        currency="USD",
        account_currency="EUR",
        account_to_quote_rate=1.25,
    )

    assert rec.risk.shares == 6
    assert rec.risk.risk_amount == 12.0
    assert rec.risk.risk_amount_account == 9.6
    assert rec.risk.risk_pct == 0.0096


def _thesis_risk_cfg(**overrides):
    kwargs = {
        "account_size": 100000.0,
        "risk_pct": 0.01,
        "max_position_pct": 0.6,
        "min_shares": 1,
        "k_atr": 2.0,
        "min_rr": 2.0,
        "max_fee_risk_pct": 0.2,
    }
    kwargs.update(overrides)
    return RiskConfig(**kwargs)


def _thesis_kwargs(**overrides):
    kwargs = {
        "signal": "breakout",
        "entry": 100.0,
        "stop": 98.0,
        "shares": 100,
        "rr_target": 2.0,
        "costs": RiskEngineConfig(
            commission_pct=0.0, slippage_bps=0.0, fx_estimate_pct=0.0
        ),
        "ticker": "AAPL",
        "close": 101.0,
        "sma_20": 99.0,
        "sma_50": 95.0,
        "sma_200": 90.0,
        "atr": 2.0,
        "momentum_6m": 0.1,
        "momentum_12m": 0.2,
        "rel_strength": 0.05,
        "confidence": 80.0,
    }
    kwargs.update(overrides)
    return kwargs


def _why_qualified_text(rec):
    assert rec.thesis is not None
    return " ".join(rec.thesis["explanation"]["why_qualified"])


@pytest.mark.parametrize("target_source", ["structural", "manual"])
def test_risk_engine_preserves_valid_independent_target_when_building_thesis(
    target_source,
):
    """Thesis enrichment must not replace an independently sourced target."""
    # All unrelated gates intentionally pass (zero costs, sized within budget).
    rec = evaluate_recommendation(
        risk_cfg=_thesis_risk_cfg(),
        target=110.0,
        target_source=target_source,
        **_thesis_kwargs(),
    )

    assert rec.verdict == "RECOMMENDED"
    assert rec.risk.target == 110.0
    assert rec.risk.target_source == target_source
    assert rec.risk.rr == 5.0
    assert rec.risk.desired_target == 104.0
    assert rec.thesis is not None
    assert rec.thesis["risk_reward"] == 5.0


@pytest.mark.parametrize("target", [None, 99.0, 100.0, float("nan"), float("inf")])
def test_risk_engine_gives_no_thesis_rr_credit_for_missing_or_invalid_target(
    target,
):
    """Missing/invalid targets must not borrow rr_target as thesis RR."""
    rec = evaluate_recommendation(
        risk_cfg=_thesis_risk_cfg(),
        target=target,
        target_source="structural",
        **_thesis_kwargs(),
    )

    assert rec.verdict == "NOT_RECOMMENDED"
    assert rec.risk.target is None
    assert rec.risk.rr is None
    assert any(reason.code == "RR_TOO_LOW" for reason in rec.reasons_detailed)
    assert rec.thesis is not None
    assert rec.thesis["risk_reward"] == 0.0
    assert "exceeds minimum threshold" not in _why_qualified_text(rec)


def test_risk_engine_gives_no_thesis_rr_credit_for_unvalidated_target_source():
    """A numerically valid target from an unvalidated source stays non-actionable."""
    rec = evaluate_recommendation(
        risk_cfg=_thesis_risk_cfg(),
        target=110.0,
        target_source="unknown",
        **_thesis_kwargs(),
    )

    assert rec.verdict == "NOT_RECOMMENDED"
    assert any(reason.code == "TARGET_NOT_VALIDATED" for reason in rec.reasons_detailed)
    # Existing normalization is retained: the numeric candidate is echoed but
    # flagged as unvalidated, and it never validates the plan.
    assert rec.risk.target == 110.0
    assert rec.risk.target_source == "unvalidated_r_multiple"
    assert rec.thesis is not None
    assert rec.thesis["risk_reward"] == 0.0
    assert "exceeds minimum threshold" not in _why_qualified_text(rec)


@pytest.mark.parametrize("target_source", ["structural", "manual"])
def test_risk_engine_distinguishes_low_rr_from_missing_target(target_source):
    """A valid target with insufficient RR keeps its target and real RR."""
    rec = evaluate_recommendation(
        risk_cfg=_thesis_risk_cfg(),
        target=102.0,
        target_source=target_source,
        **_thesis_kwargs(),
    )

    assert rec.verdict == "NOT_RECOMMENDED"
    assert rec.risk.target == 102.0
    assert rec.risk.target_source == target_source
    assert rec.risk.rr == 1.0
    assert any(reason.code == "RR_TOO_LOW" for reason in rec.reasons_detailed)
    assert rec.thesis is not None
    assert rec.thesis["risk_reward"] == 1.0
    assert "exceeds minimum threshold" not in _why_qualified_text(rec)
