from swing_screener.strategy.plugin_system import (
    resolve_strategy_config,
    validate_resolved_strategy_config,
)


def test_plugin_system_resolves_execution_order_and_volume_dependency():
    resolved = resolve_strategy_config()

    assert "volume_confirmation" in resolved["execution_order"]
    assert "breakout_signal" in resolved["execution_order"]
    assert resolved["execution_order"].index("breakout_signal") < resolved["execution_order"].index(
        "volume_confirmation"
    )
    assert "volume_confirmation" in resolved["graph_edges"]["breakout_signal"]


def test_plugin_system_default_yaml_is_valid():
    resolved = resolve_strategy_config()
    validation = validate_resolved_strategy_config(resolved)

    assert validation["is_valid"] is True
    assert validation["issues"] == []
