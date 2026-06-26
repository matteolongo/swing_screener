"""Tests for the market data provider factory (previously untested)."""
import pytest

from swing_screener.config import BrokerConfig
from swing_screener.data.providers.base import MarketDataProvider
from swing_screener.data.providers.factory import (
    get_default_provider,
    get_market_data_provider,
)
from swing_screener.data.providers.yfinance_provider import YfinanceProvider


def test_yfinance_config_returns_yfinance_provider():
    provider = get_market_data_provider(BrokerConfig(provider="yfinance"))
    assert isinstance(provider, YfinanceProvider)
    assert isinstance(provider, MarketDataProvider)


def test_get_default_provider_returns_yfinance_by_default(monkeypatch):
    monkeypatch.delenv("SWING_SCREENER_PROVIDER", raising=False)
    assert isinstance(get_default_provider(), YfinanceProvider)


def test_unknown_provider_raises_value_error():
    with pytest.raises(ValueError, match="Invalid provider"):
        get_market_data_provider(BrokerConfig(provider="bogus"))


def test_alpaca_without_credentials_raises_value_error():
    with pytest.raises(ValueError, match="api_key and secret_key"):
        get_market_data_provider(BrokerConfig(provider="alpaca"))


def test_kwargs_override_yfinance_defaults():
    provider = get_market_data_provider(
        BrokerConfig(provider="yfinance"),
        auto_adjust=False,
    )
    assert provider.auto_adjust is False


def test_factory_default_cache_ttl_is_480_minutes(monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_PROVIDER", "yfinance")
    provider = get_market_data_provider()
    assert provider.same_day_cache_ttl_minutes == 480.0, (
        f"Expected 480.0 minutes TTL, got {provider.same_day_cache_ttl_minutes}"
    )
