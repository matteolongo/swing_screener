from __future__ import annotations

from pathlib import Path

from swing_screener.settings.manager import SettingsManager
from swing_screener.settings.io import dump_yaml_file


def test_settings_manager_merges_defaults_and_runtime_overrides(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("SWING_SCREENER_PROJECT_ROOT", str(tmp_path))
    monkeypatch.delenv("SWING_SCREENER_CONFIG_DIR", raising=False)
    monkeypatch.delenv("SWING_SCREENER_DATA_DIR", raising=False)

    config_dir = tmp_path / "config"
    dump_yaml_file(
        config_dir / "defaults.yaml",
        {
            "app_config": {
                "risk": {
                    "account_size": 50000,
                    "risk_pct": 0.01,
                    "max_position_pct": 0.6,
                    "min_shares": 1,
                    "k_atr": 2.0,
                    "min_rr": 2.0,
                    "max_fee_risk_pct": 0.2,
                },
                "indicators": {
                    "sma_fast": 20,
                    "sma_mid": 50,
                    "sma_long": 200,
                    "atr_window": 14,
                    "lookback_6m": 126,
                    "lookback_12m": 252,
                    "benchmark": "SPY",
                    "breakout_lookback": 50,
                    "pullback_ma": 20,
                    "min_history": 260,
                },
                "manage": {
                    "breakeven_at_r": 1.0,
                    "trail_after_r": 2.0,
                    "trail_sma": 20,
                    "sma_buffer_pct": 0.005,
                    "max_holding_days": 20,
                },
                "positions_file": "data/positions.json",
                "orders_file": "data/orders.json",
            },
        },
    )
    dump_yaml_file(
        config_dir / "user.yaml",
        {
            "app_config": {
                "risk": {
                    "risk_pct": 0.02,
                },
            },
            "runtime": {
                "positions_file": "runtime/positions.yaml.json",
            },
        },
    )

    manager = SettingsManager()
    payload = manager.get_app_config_payload()

    assert payload["risk"]["account_size"] == 50000
    assert payload["risk"]["risk_pct"] == 0.02
    assert payload["positions_file"] == "runtime/positions.yaml.json"
    assert payload["orders_file"] == "data/orders.json"

