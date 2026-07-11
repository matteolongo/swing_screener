from __future__ import annotations

from swing_screener.intelligence.config_access import effective_intelligence_config


GLOBAL = {
    "enabled": True,
    "llm": {
        "provider": "openai",
        "base_url": "https://deployment.example/v1",
        "request_timeout_seconds": 17,
        "max_retries": 4,
        "analyzer_enabled": True,
        "web_search_model": "global-search",
        "format_model": "global-format",
    },
    "evidence": {"recency_window_days": 30, "max_items_per_symbol": 8},
    "tracing": {"enabled": True, "max_runs_per_ticker": 50},
}


def _strategy(strategy_id: str, *, model: str, lookback_hours: int) -> dict:
    return {
        "id": strategy_id,
        "market_intelligence": {
            "enabled": True,
            "providers": ["yahoo_finance"],
            "universe_scope": "strategy_universe",
            "market_context_symbols": ["SPY", "QQQ"],
            "llm": {"enabled": True, "provider": "openai", "model": model},
            "catalyst": {"lookback_hours": lookback_hours, "require_price_confirmation": True},
            "theme": {"enabled": True, "min_cluster_size": 4, "min_peer_confirmation": 3},
            "opportunity": {"technical_weight": 0.7, "catalyst_weight": 0.3, "min_opportunity_score": 0.65},
        },
    }


def test_effective_config_changes_with_active_strategy_and_preserves_global_guardrails():
    first = effective_intelligence_config(
        global_config=GLOBAL,
        active_strategy=_strategy("first", model="strategy-a", lookback_hours=24),
    )
    second = effective_intelligence_config(
        global_config=GLOBAL,
        active_strategy=_strategy("second", model="strategy-b", lookback_hours=73),
    )

    assert first["policy"]["strategy_id"] == "first"
    assert second["policy"]["strategy_id"] == "second"
    assert first["llm"]["web_search_model"] == "strategy-a"
    assert second["llm"]["web_search_model"] == "strategy-b"
    assert first["evidence"]["recency_window_days"] == 1
    assert second["evidence"]["recency_window_days"] == 4
    assert second["policy"]["theme"]["min_cluster_size"] == 4
    assert second["policy"]["opportunity"]["min_opportunity_score"] == 0.65

    for resolved in (first, second):
        assert resolved["llm"]["base_url"] == "https://deployment.example/v1"
        assert resolved["llm"]["request_timeout_seconds"] == 17
        assert resolved["llm"]["max_retries"] == 4
        assert resolved["llm"]["analyzer_enabled"] is True
        assert resolved["tracing"] == GLOBAL["tracing"]


def test_invalid_strategy_provider_falls_back_to_deployment_provider():
    strategy = _strategy("bad-provider", model="strategy-model", lookback_hours=24)
    strategy["market_intelligence"]["llm"]["provider"] = "unsupported"

    resolved = effective_intelligence_config(global_config=GLOBAL, active_strategy=strategy)

    assert resolved["llm"]["provider"] == "openai"
    assert resolved["policy"]["llm"]["provider"] == "openai"


def test_legacy_strategy_without_market_intelligence_uses_global_fallback():
    resolved = effective_intelligence_config(global_config=GLOBAL, active_strategy={"id": "legacy"})

    assert resolved["llm"] == GLOBAL["llm"]
    assert resolved["policy"] == {"strategy_id": "legacy", "enabled": True}
