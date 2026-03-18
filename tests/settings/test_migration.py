from __future__ import annotations

import json
from pathlib import Path

import yaml

from swing_screener.settings.io import dump_yaml_file
from swing_screener.settings.migration import migrate_legacy_config_to_yaml


def test_migrate_legacy_config_to_yaml_strips_secrets_and_is_idempotent(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("SWING_SCREENER_PROJECT_ROOT", str(tmp_path))
    monkeypatch.delenv("SWING_SCREENER_CONFIG_DIR", raising=False)
    monkeypatch.delenv("SWING_SCREENER_DATA_DIR", raising=False)

    config_dir = tmp_path / "config"
    data_dir = tmp_path / "data"
    intelligence_dir = data_dir / "intelligence"
    intelligence_dir.mkdir(parents=True, exist_ok=True)

    dump_yaml_file(
        config_dir / "defaults.yaml",
        {
            "strategy": {
                "id": "default",
                "name": "Default",
                "module": "momentum",
                "universe": {
                    "trend": {"sma_fast": 20, "sma_mid": 50, "sma_long": 200},
                    "vol": {"atr_window": 14},
                    "mom": {"lookback_6m": 126, "lookback_12m": 252, "benchmark": "SPY"},
                    "filt": {"min_price": 5, "max_price": 500, "max_atr_pct": 15, "currencies": ["USD", "EUR"]},
                },
                "ranking": {"w_mom_6m": 0.45, "w_mom_12m": 0.35, "w_rs_6m": 0.2, "top_n": 100},
                "signals": {"breakout_lookback": 50, "pullback_ma": 20, "min_history": 260},
                "risk": {
                    "account_size": 50000,
                    "risk_pct": 0.01,
                    "max_position_pct": 0.6,
                    "min_shares": 1,
                    "k_atr": 2.0,
                    "min_rr": 2.0,
                    "rr_target": 2.0,
                    "commission_pct": 0.0,
                    "max_fee_risk_pct": 0.2,
                },
                "manage": {
                    "breakeven_at_r": 1.0,
                    "trail_after_r": 2.0,
                    "trail_sma": 20,
                    "sma_buffer_pct": 0.005,
                    "max_holding_days": 20,
                    "benchmark": "SPY",
                },
            },
            "intelligence": {
                "enabled": False,
                "providers": ["yahoo_finance"],
                "universe_scope": "screener_universe",
                "market_context_symbols": ["SPY"],
                "llm": {
                    "enabled": False,
                    "provider": "openai",
                    "model": "gpt-4.1-mini",
                    "base_url": "https://api.openai.com/v1",
                    "enable_cache": True,
                    "enable_audit": True,
                    "cache_path": "data/intelligence/llm_cache.json",
                    "audit_path": "data/intelligence/llm_audit",
                    "max_concurrency": 4,
                },
            },
        },
    )
    dump_yaml_file(
        config_dir / "mcp_features.yaml",
        {
            "environment": "dev",
            "features": {
                "config": {
                    "enabled": True,
                    "tools": ["get_config"],
                },
            },
        },
    )

    strategy_payload = {
        "id": "default",
        "name": "Default",
        "module": "momentum",
        "universe": {
            "trend": {"sma_fast": 20, "sma_mid": 50, "sma_long": 200},
            "vol": {"atr_window": 14},
            "mom": {"lookback_6m": 126, "lookback_12m": 252, "benchmark": "SPY"},
            "filt": {"min_price": 5, "max_price": 500, "max_atr_pct": 15, "currencies": ["USD", "EUR"]},
        },
        "ranking": {"w_mom_6m": 0.45, "w_mom_12m": 0.35, "w_rs_6m": 0.2, "top_n": 100},
        "signals": {"breakout_lookback": 50, "pullback_ma": 20, "min_history": 260},
        "risk": {
            "account_size": 50000,
            "risk_pct": 0.01,
            "max_position_pct": 0.6,
            "min_shares": 1,
            "k_atr": 2.0,
            "min_rr": 2.0,
            "rr_target": 2.0,
            "commission_pct": 0.0,
            "max_fee_risk_pct": 0.2,
        },
        "manage": {
            "breakeven_at_r": 1.0,
            "trail_after_r": 2.0,
            "trail_sma": 20,
            "sma_buffer_pct": 0.005,
            "max_holding_days": 20,
            "benchmark": "SPY",
        },
        "market_intelligence": {
            "enabled": True,
            "llm": {
                "provider": "openai",
                "api_key": "legacy-inline-key",
            },
        },
    }
    (data_dir / "strategies.json").write_text(json.dumps([strategy_payload]), encoding="utf-8")
    (data_dir / "active_strategy.json").write_text(json.dumps({"id": "default"}), encoding="utf-8")
    (intelligence_dir / "config.json").write_text(
        (
            '{"config": {"enabled": true, "providers": ["yahoo_finance"], '
            '"universe_scope": "screener_universe", "market_context_symbols": ["SPY"], '
            '"llm": {"enabled": true, "provider": "openai", "model": "gpt-4.1-mini", '
            '"base_url": "https://api.openai.com/v1", "api_key": "legacy-inline-key", '
            '"enable_cache": true, "enable_audit": true, '
            '"cache_path": "data/intelligence/llm_cache.json", '
            '"audit_path": "data/intelligence/llm_audit", "max_concurrency": 4}}, '
            '"bootstrapped_from_strategy": false, "updated_at": "2026-03-18T10:00:00"}'
        ),
        encoding="utf-8",
    )

    first_actions = migrate_legacy_config_to_yaml(force=True)
    second_actions = migrate_legacy_config_to_yaml()

    assert first_actions
    assert second_actions == []

    migrated_strategies = yaml.safe_load((config_dir / "strategies.yaml").read_text(encoding="utf-8"))
    migrated_intelligence = yaml.safe_load((config_dir / "intelligence.yaml").read_text(encoding="utf-8"))
    migrated_mcp = yaml.safe_load((config_dir / "mcp.yaml").read_text(encoding="utf-8"))

    assert migrated_strategies["active_strategy_id"] == "default"
    assert "api_key" not in migrated_strategies["strategies"][0]["market_intelligence"]["llm"]
    assert "api_key" not in migrated_intelligence["config"]["llm"]
    assert migrated_mcp["features"]["config"]["enabled"] is True
