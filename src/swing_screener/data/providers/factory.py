"""Factory for creating market data providers."""
from __future__ import annotations

from typing import Optional

from .base import MarketDataProvider
from .yfinance_provider import YfinanceProvider
from ...config import BrokerConfig


def get_market_data_provider(
    config: Optional[BrokerConfig] = None,
    **kwargs
) -> MarketDataProvider:
    """
    Create market data provider based on configuration.
    
    Args:
        config: Broker configuration (if None, loads from environment)
        **kwargs: Additional provider-specific arguments
        
    Returns:
        MarketDataProvider instance (YfinanceProvider or AlpacaDataProvider)
        
    Raises:
        ValueError: If invalid provider or missing credentials
        
    Examples:
        # Use default (yfinance)
        >>> provider = get_market_data_provider()
        
        # Use Alpaca
        >>> config = BrokerConfig(provider="alpaca", alpaca_api_key="...", alpaca_secret_key="...")
        >>> provider = get_market_data_provider(config)
        
        # Load from environment
        >>> provider = get_market_data_provider()  # reads SWING_SCREENER_PROVIDER, ALPACA_API_KEY, etc.
    """
    if config is None:
        config = BrokerConfig.from_env()
    
    config.validate()
    
    if config.provider == "yfinance":
        return YfinanceProvider(
            cache_dir=kwargs.get("cache_dir", ".cache/market_data"),
            auto_adjust=kwargs.get("auto_adjust", True),
            progress=kwargs.get("progress", False),
        )
    
    elif config.provider == "alpaca":
        if not config.alpaca_api_key or not config.alpaca_secret_key:
            raise ValueError("Alpaca provider requires api_key and secret_key")
        try:
            from .alpaca_provider import AlpacaDataProvider
        except ModuleNotFoundError as exc:
            raise ModuleNotFoundError(
                "alpaca-py is required when provider='alpaca'. "
                "Install it with `pip install alpaca-py`."
            ) from exc
        
        return AlpacaDataProvider(
            api_key=config.alpaca_api_key,
            secret_key=config.alpaca_secret_key,
            paper=config.alpaca_paper,
            cache_dir=kwargs.get("cache_dir", ".cache/alpaca_data"),
            use_cache=kwargs.get("use_cache", True),
        )
    
    else:
        raise ValueError(f"Unknown provider: {config.provider}")


# Convenience function to get default provider
def get_default_provider(**kwargs) -> MarketDataProvider:
    """
    Get default market data provider (from environment or yfinance).
    
    Args:
        **kwargs: Additional provider-specific arguments
        
    Returns:
        MarketDataProvider instance
    """
    return get_market_data_provider(**kwargs)
