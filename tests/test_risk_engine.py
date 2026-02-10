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
        overlay_status=None,
        risk_cfg=risk_cfg,
        rr_target=2.0,
        costs=RiskEngineConfig(commission_pct=0.0, slippage_bps=0.0, fx_estimate_pct=0.0),
    )

    assert rec.verdict == "NOT_RECOMMENDED"
    assert any(r.code == "RR_TOO_LOW" for r in rec.reasons_detailed)

