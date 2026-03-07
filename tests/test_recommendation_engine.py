from swing_screener.risk.recommendations.engine import ChecklistGate, Reason, build_recommendation


def test_recommendation_happy_path():
    rec = build_recommendation(
        signal="breakout",
        entry=100.0,
        stop=95.0,
        shares=100,
        account_size=100000.0,
        risk_pct_target=0.01,
        rr_target=2.0,
        commission_pct=0.0,
        slippage_bps=0.0,
    )

    assert rec.verdict == "RECOMMENDED"
    assert rec.risk.rr is not None and rec.risk.rr >= 2.0
    assert all(g.passed for g in rec.checklist)


def test_recommendation_requires_stop():
    rec = build_recommendation(
        signal="breakout",
        entry=100.0,
        stop=None,
        shares=100,
        account_size=100000.0,
        risk_pct_target=0.01,
        rr_target=2.0,
    )

    assert rec.verdict == "NOT_RECOMMENDED"
    assert any(r.code == "STOP_MISSING" for r in rec.reasons_detailed)


def test_recommendation_rejects_low_rr():
    rec = build_recommendation(
        signal="pullback",
        entry=100.0,
        stop=98.0,
        shares=100,
        account_size=100000.0,
        risk_pct_target=0.01,
        rr_target=1.0,
        min_rr=2.0,
    )

    assert rec.verdict == "NOT_RECOMMENDED"
    assert any(r.code == "RR_TOO_LOW" for r in rec.reasons_detailed)


def test_recommendation_blocks_fee_drag():
    rec = build_recommendation(
        signal="breakout",
        entry=100.0,
        stop=99.0,
        shares=10,
        account_size=10000.0,
        risk_pct_target=0.01,
        rr_target=2.0,
        commission_pct=0.02,
        slippage_bps=50.0,
        max_fee_risk_pct=0.2,
    )

    assert rec.verdict == "NOT_RECOMMENDED"
    assert any(r.code == "FEES_TOO_HIGH" for r in rec.reasons_detailed)


def test_recommendation_accepts_extra_plugin_gates_and_reasons():
    rec = build_recommendation(
        signal="breakout",
        entry=100.0,
        stop=95.0,
        shares=100,
        account_size=100000.0,
        risk_pct_target=0.01,
        rr_target=2.0,
        commission_pct=0.0,
        slippage_bps=0.0,
        extra_checklist=[
            ChecklistGate(
                gate_name="volume_confirmation",
                passed=False,
                explanation="Breakout volume did not clear the configured threshold.",
                rule="PLUGIN:volume_confirmation",
            )
        ],
        extra_reasons=[
            Reason(
                code="VOLUME_CONFIRMATION_FAILED",
                message="Volume confirmation blocked the breakout.",
                severity="block",
                rule="PLUGIN:volume_confirmation",
            )
        ],
        extra_suggestions=["Wait for stronger participation before acting on this breakout."],
    )

    assert rec.verdict == "NOT_RECOMMENDED"
    assert any(g.gate_name == "volume_confirmation" and not g.passed for g in rec.checklist)
    assert any(r.code == "VOLUME_CONFIRMATION_FAILED" for r in rec.reasons_detailed)
    assert "Wait for stronger participation before acting on this breakout." in rec.education.what_would_make_valid
