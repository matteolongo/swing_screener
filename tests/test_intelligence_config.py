from swing_screener.intelligence.config import build_intelligence_config


def test_build_intelligence_config_defaults_when_missing():
    cfg = build_intelligence_config({})

    assert cfg.enabled is False
    assert cfg.providers == ("yahoo_finance",)
    assert cfg.universe_scope == "screener_universe"
    assert cfg.market_context_symbols == ("SPY", "QQQ", "XLK", "SMH", "XBI")
    assert cfg.catalyst.false_catalyst_return_z == 1.5
    assert cfg.opportunity.technical_weight == 0.55
    assert cfg.opportunity.catalyst_weight == 0.45


def test_build_intelligence_config_maps_valid_values():
    strategy = {
        "market_intelligence": {
            "enabled": True,
            "providers": ["yahoo_finance", "earnings_calendar"],
            "universe_scope": "strategy_universe",
            "market_context_symbols": ["spy", "qqq", "smh"],
            "catalyst": {
                "lookback_hours": 96,
                "recency_half_life_hours": 48,
                "false_catalyst_return_z": 2.2,
                "min_price_reaction_atr": 1.1,
                "require_price_confirmation": False,
            },
            "theme": {
                "enabled": True,
                "min_cluster_size": 4,
                "min_peer_confirmation": 3,
                "curated_peer_map_path": "data/intelligence/custom_peers.yaml",
            },
            "opportunity": {
                "technical_weight": 0.6,
                "catalyst_weight": 0.4,
                "max_daily_opportunities": 6,
                "min_opportunity_score": 0.62,
            },
        }
    }

    cfg = build_intelligence_config(strategy)

    assert cfg.enabled is True
    assert cfg.providers == ("yahoo_finance", "earnings_calendar")
    assert cfg.universe_scope == "strategy_universe"
    assert cfg.market_context_symbols == ("SPY", "QQQ", "SMH")
    assert cfg.catalyst.lookback_hours == 96
    assert cfg.catalyst.recency_half_life_hours == 48
    assert cfg.catalyst.false_catalyst_return_z == 2.2
    assert cfg.catalyst.min_price_reaction_atr == 1.1
    assert cfg.catalyst.require_price_confirmation is False
    assert cfg.theme.min_cluster_size == 4
    assert cfg.theme.min_peer_confirmation == 3
    assert cfg.theme.curated_peer_map_path == "data/intelligence/custom_peers.yaml"
    assert cfg.opportunity.technical_weight == 0.6
    assert cfg.opportunity.catalyst_weight == 0.4
    assert cfg.opportunity.max_daily_opportunities == 6
    assert cfg.opportunity.min_opportunity_score == 0.62


def test_build_intelligence_config_filters_invalid_provider_and_scope():
    strategy = {
        "market_intelligence": {
            "providers": ["reddit", "yahoo_finance", ""],
            "universe_scope": "everything",
        }
    }

    cfg = build_intelligence_config(strategy)

    assert cfg.providers == ("yahoo_finance",)
    assert cfg.universe_scope == "screener_universe"


def test_build_intelligence_config_normalizes_weights():
    strategy = {
        "market_intelligence": {
            "opportunity": {
                "technical_weight": 5,
                "catalyst_weight": 5,
            }
        }
    }

    cfg = build_intelligence_config(strategy)

    assert cfg.opportunity.technical_weight == 0.5
    assert cfg.opportunity.catalyst_weight == 0.5


def test_build_intelligence_config_guards_invalid_threshold_values():
    strategy = {
        "market_intelligence": {
            "catalyst": {
                "lookback_hours": -1,
                "false_catalyst_return_z": -2.0,
            },
            "opportunity": {
                "max_daily_opportunities": 0,
                "min_opportunity_score": 2.5,
            },
        }
    }

    cfg = build_intelligence_config(strategy)

    assert cfg.catalyst.lookback_hours == 72
    assert cfg.catalyst.false_catalyst_return_z == 1.5
    assert cfg.opportunity.max_daily_opportunities == 8
    assert cfg.opportunity.min_opportunity_score == 0.55

