"""Factory for creating market data providers."""
from __future__ import annotations

from typing import Optional

from .base import MarketDataProvider
from .yfinance_provider import YfinanceProvider
from ...config import BrokerConfig
from swing_screener.settings import get_settings_manager


def get_market_data_provider(
    config: Optional[BrokerConfig] = None,
    **kwargs,
) -> MarketDataProvider:
    """Create the configured market data provider."""
    if config is None:
        config = BrokerConfig.from_env()

    config.validate()
    manager = get_settings_manager()
    provider_defaults = manager.get_low_level_defaults_payload("data_providers")
    yfinance_defaults = (
        provider_defaults.get("yfinance", {})
        if isinstance(provider_defaults.get("yfinance", {}), dict)
        else {}
    )
    stooq_defaults = (
        provider_defaults.get("stooq", {})
        if isinstance(provider_defaults.get("stooq", {}), dict)
        else {}
    )

    return YfinanceProvider(
        cache_dir=kwargs.get(
            "cache_dir",
            str(manager.resolve_runtime_path("yfinance_cache_dir", ".cache/market_data")),
        ),
        auto_adjust=kwargs.get("auto_adjust", bool(yfinance_defaults.get("auto_adjust", True))),
        progress=kwargs.get("progress", bool(yfinance_defaults.get("progress", False))),
        stooq_fallback_enabled=kwargs.get(
            "stooq_fallback_enabled",
            bool(yfinance_defaults.get("stooq_fallback_enabled", True)),
        ),
        stooq_timeout_sec=kwargs.get(
            "stooq_timeout_sec",
            float(stooq_defaults.get("timeout_seconds", 10.0)),
        ),
    )


def get_default_provider(**kwargs) -> MarketDataProvider:
    """Get the default market data provider."""
    return get_market_data_provider(**kwargs)
