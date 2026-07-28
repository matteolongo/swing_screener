from swing_screener.strategy.config import build_manage_config, build_risk_config
from swing_screener.strategy.storage import get_active_strategy, load_strategies


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


def test_short_term_5d_strategy_has_five_day_management_horizon() -> None:
    strategies = {item["id"]: item for item in load_strategies()}
    short_term = strategies["short-term-5d"]

    assert short_term["manage"]["max_holding_days"] == 5
    assert short_term["manage"]["time_stop_days"] == 2
    assert short_term["manage"]["exit_signal_days"] == 1
    assert short_term["manage"]["trail_sma"] == 5
    assert short_term["manage"]["breakeven_at_r"] == 0.75
    assert short_term["manage"]["trail_after_r"] == 1.0


def test_build_manage_config_preserves_exit_signal_days() -> None:
    cfg = build_manage_config({"manage": {"exit_signal_days": 1}})

    assert cfg.exit_signal_days == 1


def test_balanced_remains_active_and_unchanged() -> None:
    active = get_active_strategy()

    assert active["id"] == "default"
    assert active["manage"]["max_holding_days"] == 30
