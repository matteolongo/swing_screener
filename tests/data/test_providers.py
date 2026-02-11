"""Tests for market data providers."""
from __future__ import annotations

import pytest
import pandas as pd
from datetime import datetime, timedelta

from swing_screener.data.providers import (
    MarketDataProvider,
    YfinanceProvider,
    AlpacaDataProvider,
    get_market_data_provider,
    get_default_provider,
)
from swing_screener.config import BrokerConfig


class TestYfinanceProvider:
    """Test YfinanceProvider implementation."""
    
    def test_provider_name(self):
        """Test provider name."""
        provider = YfinanceProvider()
        assert provider.get_provider_name() == "yfinance"
    
    def test_market_open(self):
        """Test market_open always returns False for yfinance."""
        provider = YfinanceProvider()
        assert provider.is_market_open() is False
    
    def test_fetch_ohlcv_single_ticker(self):
        """Test fetching OHLCV data for single ticker."""
        provider = YfinanceProvider()
        
        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        df = provider.fetch_ohlcv(
            tickers=["AAPL"],
            start_date=start,
            end_date=end,
            interval="1d"
        )
        
        # Check format
        assert isinstance(df, pd.DataFrame)
        assert isinstance(df.columns, pd.MultiIndex)
        assert df.columns.nlevels == 2
        
        # Check columns
        fields = df.columns.get_level_values(0).unique()
        assert "Open" in fields
        assert "High" in fields
        assert "Low" in fields
        assert "Close" in fields
        assert "Volume" in fields
        
        tickers = df.columns.get_level_values(1).unique()
        assert "AAPL" in tickers
        
        # Check data
        assert not df.empty
        assert df[("Close", "AAPL")].notna().any()
    
    def test_fetch_ohlcv_multiple_tickers(self):
        """Test fetching OHLCV data for multiple tickers."""
        provider = YfinanceProvider()
        
        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        tickers = ["AAPL", "MSFT", "GOOGL"]
        df = provider.fetch_ohlcv(
            tickers=tickers,
            start_date=start,
            end_date=end,
            interval="1d"
        )
        
        # Check all tickers present
        result_tickers = df.columns.get_level_values(1).unique()
        for ticker in tickers:
            assert ticker in result_tickers
    
    def test_fetch_latest_price(self):
        """Test fetching latest price."""
        provider = YfinanceProvider()
        price = provider.fetch_latest_price("AAPL")
        
        assert isinstance(price, float)
        assert price > 0
    
    def test_get_ticker_info(self):
        """Test fetching ticker metadata."""
        provider = YfinanceProvider()
        info = provider.get_ticker_info("AAPL")
        
        assert isinstance(info, dict)
        assert "name" in info
        assert "sector" in info
        assert info["name"] is not None  # Apple should have a name
    
    def test_caching(self):
        """Test that caching works."""
        import time
        provider = YfinanceProvider(cache_dir=".cache/test_market_data")
        
        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")
        
        # First call - should download
        start_time = time.time()
        df1 = provider.fetch_ohlcv(["AAPL"], start, end)
        first_duration = time.time() - start_time
        
        # Second call - should use cache
        start_time = time.time()
        df2 = provider.fetch_ohlcv(["AAPL"], start, end)
        second_duration = time.time() - start_time
        
        # Cache should be faster
        assert second_duration < first_duration
        
        # Data should be identical
        pd.testing.assert_frame_equal(df1, df2)


class TestBrokerConfig:
    """Test BrokerConfig."""
    
    def test_default_config(self):
        """Test default configuration."""
        config = BrokerConfig()
        assert config.provider == "yfinance"
        assert config.alpaca_api_key is None
        assert config.alpaca_secret_key is None
        assert config.alpaca_paper is True
    
    def test_validate_yfinance(self):
        """Test validation for yfinance provider."""
        config = BrokerConfig(provider="yfinance")
        config.validate()  # Should not raise
    
    def test_validate_alpaca_missing_keys(self):
        """Test validation fails for Alpaca without keys."""
        config = BrokerConfig(provider="alpaca")
        with pytest.raises(ValueError, match="requires api_key"):
            config.validate()
    
    def test_validate_alpaca_with_keys(self):
        """Test validation succeeds for Alpaca with keys."""
        config = BrokerConfig(
            provider="alpaca",
            alpaca_api_key="test_key",
            alpaca_secret_key="test_secret"
        )
        config.validate()  # Should not raise
    
    def test_validate_invalid_provider(self):
        """Test validation fails for invalid provider."""
        config = BrokerConfig(provider="invalid")
        with pytest.raises(ValueError, match="Invalid provider"):
            config.validate()


class TestProviderFactory:
    """Test provider factory."""
    
    def test_get_default_provider(self):
        """Test getting default provider."""
        provider = get_default_provider()
        assert isinstance(provider, YfinanceProvider)
        assert provider.get_provider_name() == "yfinance"
    
    def test_get_yfinance_provider(self):
        """Test creating yfinance provider."""
        config = BrokerConfig(provider="yfinance")
        provider = get_market_data_provider(config)
        assert isinstance(provider, YfinanceProvider)
    
    def test_get_alpaca_provider(self):
        """Test creating alpaca provider."""
        config = BrokerConfig(
            provider="alpaca",
            alpaca_api_key="test_key",
            alpaca_secret_key="test_secret"
        )
        provider = get_market_data_provider(config)
        assert isinstance(provider, AlpacaDataProvider)
        assert provider.get_provider_name() in ("alpaca", "alpaca-paper")
    
    def test_invalid_provider_raises(self):
        """Test invalid provider raises error."""
        config = BrokerConfig(provider="invalid")
        with pytest.raises(ValueError):
            get_market_data_provider(config)


class TestAlpacaProvider:
    """Test AlpacaDataProvider (requires API keys)."""
    
    @pytest.fixture
    def skip_if_no_alpaca_keys(self):
        """Skip test if Alpaca keys not available."""
        import os
        if not os.getenv("ALPACA_API_KEY") or not os.getenv("ALPACA_SECRET_KEY"):
            pytest.skip("Alpaca API keys not available")
    
    def test_provider_name(self):
        """Test provider name."""
        provider = AlpacaDataProvider(
            api_key="test_key",
            secret_key="test_secret",
            paper=True
        )
        assert provider.get_provider_name() == "alpaca-paper"
    
    def test_parse_timeframe(self):
        """Test timeframe parsing."""
        provider = AlpacaDataProvider(
            api_key="test_key",
            secret_key="test_secret"
        )
        
        from alpaca.data.timeframe import TimeFrame
        
        # Test that parsing works and returns TimeFrame objects
        result_1d = provider._parse_timeframe("1d")
        result_1h = provider._parse_timeframe("1h")
        result_1m = provider._parse_timeframe("1m")
        
        assert isinstance(result_1d, TimeFrame)
        assert isinstance(result_1h, TimeFrame)
        assert isinstance(result_1m, TimeFrame)
        
        # Test that invalid interval raises ValueError
        with pytest.raises(ValueError, match="Unsupported interval"):
            provider._parse_timeframe("invalid")
    
    @pytest.mark.integration
    def test_fetch_ohlcv_integration(self, skip_if_no_alpaca_keys):
        """Integration test: fetch real data from Alpaca."""
        import os
        provider = AlpacaDataProvider(
            api_key=os.getenv("ALPACA_API_KEY"),
            secret_key=os.getenv("ALPACA_SECRET_KEY"),
            paper=True
        )
        
        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")
        
        df = provider.fetch_ohlcv(
            tickers=["AAPL"],
            start_date=start,
            end_date=end,
            interval="1d"
        )
        
        # Check format matches yfinance
        assert isinstance(df, pd.DataFrame)
        assert isinstance(df.columns, pd.MultiIndex)
        assert ("Close", "AAPL") in df.columns
        assert not df.empty


class TestProviderCompatibility:
    """Test that all providers return compatible DataFrame format."""
    
    def test_yfinance_format(self):
        """Test yfinance provider returns correct format."""
        yf_provider = YfinanceProvider()
        
        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")
        
        yf_df = yf_provider.fetch_ohlcv(["AAPL"], start, end)
        
        # Check structure
        assert isinstance(yf_df.columns, pd.MultiIndex)
        assert yf_df.columns.nlevels == 2
        
        fields = set(yf_df.columns.get_level_values(0))
        assert fields == {"Open", "High", "Low", "Close", "Volume"}
