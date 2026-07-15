from swing_screener.strategy.config import build_risk_config


def test_build_risk_config_ignores_account_size_mode() -> None:
    strategy = {
        "risk": {
            "account_size": 1000.0,
            "risk_pct": 0.015,
            "max_position_pct": 1.0,
            "min_shares": 1,
            "k_atr": 1.0,
            "account_size_mode": "equity",
        }
    }

    cfg = build_risk_config(strategy)

    assert cfg.account_size == 1000.0
    assert cfg.risk_pct == 0.015
    assert not hasattr(cfg, "account_size_mode")


def test_build_risk_config_exposes_explicit_portfolio_heat_limit() -> None:
    cfg = build_risk_config({"risk": {"max_portfolio_heat_pct": 0.045}})

    assert cfg.max_portfolio_heat_pct == 0.045
