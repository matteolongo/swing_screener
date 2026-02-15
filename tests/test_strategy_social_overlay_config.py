from swing_screener.strategy.config import build_social_overlay_config


def test_social_overlay_config_maps_providers_and_analyzer():
    strategy = {
        "social_overlay": {
            "enabled": True,
            "providers": [" yahoo_finance ", "reddit", "reddit"],
            "sentiment_analyzer": "VADER",
        }
    }

    cfg = build_social_overlay_config(strategy)

    assert cfg.enabled is True
    assert cfg.providers == ("yahoo_finance", "reddit")
    assert cfg.sentiment_analyzer == "vader"


def test_social_overlay_config_falls_back_for_invalid_provider_and_analyzer():
    strategy = {
        "social_overlay": {
            "providers": ["unsupported", ""],
            "sentiment_analyzer": "unknown",
        }
    }

    cfg = build_social_overlay_config(strategy)

    assert cfg.providers == ("reddit",)
    assert cfg.sentiment_analyzer == "keyword"
