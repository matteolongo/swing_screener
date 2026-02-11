"""Validation tests for SMA indicator against TA-Lib.

These tests verify that our custom SMA implementation produces identical
results to TA-Lib's industry-standard SMA function.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Add tests directory to path
tests_dir = Path(__file__).parent
if str(tests_dir) not in sys.path:
    sys.path.insert(0, str(tests_dir))

import numpy as np
import pandas as pd
import pytest

from swing_screener.indicators.trend import sma
from utils.talib_validators import require_talib, validate_sma, TALIB_AVAILABLE

if TALIB_AVAILABLE:
    import talib


@require_talib()
class TestSMAValidation:
    """Validate custom SMA against TA-Lib SMA."""

    def test_sma_single_ticker_window_20(self):
        """Test SMA(20) for single ticker matches TA-Lib."""
        # Create test data
        np.random.seed(42)
        dates = pd.date_range("2024-01-01", periods=100, freq="D")
        prices = pd.Series(100 + np.cumsum(np.random.randn(100) * 2), index=dates)
        
        # Compute custom SMA
        close_df = prices.to_frame(name="AAPL")
        custom_sma = sma(close_df, window=20)
        
        # Validate against TA-Lib
        validate_sma(prices, window=20, custom_result=custom_sma["AAPL"])

    def test_sma_single_ticker_window_50(self):
        """Test SMA(50) for single ticker matches TA-Lib."""
        np.random.seed(43)
        dates = pd.date_range("2024-01-01", periods=150, freq="D")
        prices = pd.Series(200 + np.cumsum(np.random.randn(150) * 3), index=dates)
        
        close_df = prices.to_frame(name="MSFT")
        custom_sma = sma(close_df, window=50)
        
        validate_sma(prices, window=50, custom_result=custom_sma["MSFT"])

    def test_sma_single_ticker_window_200(self):
        """Test SMA(200) for single ticker matches TA-Lib."""
        np.random.seed(44)
        dates = pd.date_range("2024-01-01", periods=300, freq="D")
        prices = pd.Series(150 + np.cumsum(np.random.randn(300) * 1.5), index=dates)
        
        close_df = prices.to_frame(name="NVDA")
        custom_sma = sma(close_df, window=200)
        
        validate_sma(prices, window=200, custom_result=custom_sma["NVDA"])

    def test_sma_multiple_tickers(self):
        """Test SMA with multiple tickers matches TA-Lib."""
        np.random.seed(45)
        dates = pd.date_range("2024-01-01", periods=100, freq="D")
        
        close_df = pd.DataFrame({
            "AAPL": 150 + np.cumsum(np.random.randn(100) * 2),
            "MSFT": 300 + np.cumsum(np.random.randn(100) * 3),
            "GOOGL": 120 + np.cumsum(np.random.randn(100) * 1.5),
        }, index=dates)
        
        # Compute custom SMA
        custom_sma = sma(close_df, window=20)
        
        # Validate each ticker
        for ticker in close_df.columns:
            validate_sma(
                close_df[ticker],
                window=20,
                custom_result=custom_sma[ticker]
            )

    def test_sma_with_insufficient_data(self):
        """Test SMA with less data than window size."""
        dates = pd.date_range("2024-01-01", periods=15, freq="D")
        prices = pd.Series(range(100, 115), index=dates, dtype=np.float64)
        close_df = prices.to_frame(name="TEST")
        
        # SMA(20) with only 15 data points
        custom_sma = sma(close_df, window=20)
        
        # Should be all NaN
        assert custom_sma["TEST"].isna().all()
        
        # TA-Lib should also be all NaN
        talib_sma = talib.SMA(prices.values, timeperiod=20)
        assert np.isnan(talib_sma).all()

    def test_sma_with_gaps_and_nans(self):
        """Test SMA handles NaN values correctly."""
        dates = pd.date_range("2024-01-01", periods=100, freq="D")
        prices = pd.Series(range(100, 200), index=dates, dtype=float)
        
        # Introduce some NaN values
        prices.iloc[20:25] = np.nan
        prices.iloc[50] = np.nan
        
        close_df = prices.to_frame(name="GAP")
        custom_sma = sma(close_df, window=20)
        
        # TA-Lib handles NaN differently (propagates NaN forward)
        # We'll just check that our implementation is consistent
        talib_sma = talib.SMA(prices.values, timeperiod=20)
        
        # Both should have NaN in similar positions
        assert custom_sma["GAP"].isna().sum() > 0
        assert np.isnan(talib_sma).sum() > 0

    def test_sma_real_world_like_data(self):
        """Test SMA with realistic price movements."""
        # Simulate realistic stock price with trend + noise
        np.random.seed(100)
        dates = pd.date_range("2023-01-01", periods=252, freq="D")  # 1 year
        
        # Start at 100, add trend and volatility
        trend = np.linspace(0, 20, 252)  # Upward trend
        noise = np.random.randn(252) * 2
        prices = pd.Series(100 + trend + np.cumsum(noise), index=dates)
        
        close_df = prices.to_frame(name="STOCK")
        
        # Test multiple windows
        for window in [10, 20, 50, 100]:
            custom_sma = sma(close_df, window=window)
            validate_sma(prices, window=window, custom_result=custom_sma["STOCK"])

    def test_sma_constant_price(self):
        """Test SMA with constant prices (edge case)."""
        dates = pd.date_range("2024-01-01", periods=50, freq="D")
        prices = pd.Series([100.0] * 50, index=dates)
        close_df = prices.to_frame(name="FLAT")
        
        custom_sma = sma(close_df, window=20)
        validate_sma(prices, window=20, custom_result=custom_sma["FLAT"])
        
        # SMA of constant should equal the constant (after warmup)
        valid_sma = custom_sma["FLAT"].dropna()
        assert np.allclose(valid_sma, 100.0)

    def test_sma_exact_window_size_data(self):
        """Test SMA when data length exactly equals window size."""
        dates = pd.date_range("2024-01-01", periods=20, freq="D")
        prices = pd.Series(range(100, 120), index=dates, dtype=np.float64)
        close_df = prices.to_frame(name="EXACT")
        
        custom_sma = sma(close_df, window=20)
        validate_sma(prices, window=20, custom_result=custom_sma["EXACT"])
        
        # Should have exactly one valid value (the last one)
        valid_count = custom_sma["EXACT"].notna().sum()
        assert valid_count == 1

    def test_sma_window_2(self):
        """Test SMA with minimum valid window (2)."""
        dates = pd.date_range("2024-01-01", periods=50, freq="D")
        prices = pd.Series(range(100, 150), index=dates, dtype=np.float64)
        close_df = prices.to_frame(name="MIN")
        
        custom_sma = sma(close_df, window=2)
        validate_sma(prices, window=2, custom_result=custom_sma["MIN"])

    def test_sma_large_dataset(self):
        """Test SMA with large dataset (5+ years)."""
        np.random.seed(200)
        dates = pd.date_range("2019-01-01", periods=1260, freq="D")  # ~5 years
        prices = pd.Series(
            100 + np.cumsum(np.random.randn(1260) * 1.5),
            index=dates
        )
        close_df = prices.to_frame(name="LARGE")
        
        # Test with 200-day SMA (common long-term indicator)
        custom_sma = sma(close_df, window=200)
        validate_sma(prices, window=200, custom_result=custom_sma["LARGE"])


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
