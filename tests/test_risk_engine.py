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
