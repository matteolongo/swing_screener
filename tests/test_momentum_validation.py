"""Validation tests for Momentum indicator against TA-Lib ROC.

These tests verify that our custom momentum calculation formula matches
TA-Lib's ROC (Rate of Change) function.

Note: Our momentum uses (close[t] / close[t-period] - 1) which returns fractions.
TA-Lib ROC returns percentages, so we divide by 100 for comparison.
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

from utils.talib_validators import require_talib, validate_roc, TALIB_AVAILABLE


def compute_rolling_returns(close_df: pd.DataFrame, period: int) -> pd.DataFrame:
    """Compute rolling returns for validation testing.
    
    This matches the formula used in swing_screener.indicators.momentum.compute_returns
    but returns the full time series instead of just the last value.
    
    Args:
        close_df: DataFrame with close prices (date x ticker)
        period: Lookback period
        
    Returns:
        DataFrame with rolling returns (date x ticker)
    """
    return close_df / close_df.shift(period) - 1.0


@require_talib()
class TestMomentumValidation:
    """Validate custom momentum against TA-Lib ROC."""

    def test_momentum_6month(self):
        """Test 6-month momentum (126 trading days) matches TA-Lib ROC."""
        np.random.seed(70)
        dates = pd.date_range("2023-01-01", periods=300, freq="D")
        
        # Random walk price series
        returns = np.random.randn(300) * 0.02  # 2% daily volatility
        prices = 100 * np.exp(np.cumsum(returns))
        
        close_df = pd.Series(prices, index=dates, dtype=np.float64).to_frame(name="AAPL")
        
        # Compute rolling returns using the same formula as production code
        custom_mom = compute_rolling_returns(close_df, period=126)
        
        # Validate against TA-Lib ROC
        validate_roc(
            close_df["AAPL"],
            period=126,
            custom_result=custom_mom["AAPL"]
        )

    def test_momentum_12month(self):
        """Test 12-month momentum (252 trading days) matches TA-Lib ROC."""
        np.random.seed(71)
        dates = pd.date_range("2022-01-01", periods=400, freq="D")
        
        returns = np.random.randn(400) * 0.015
        prices = 100 * np.exp(np.cumsum(returns))
        
        close_df = pd.Series(prices, index=dates, dtype=np.float64).to_frame(name="MSFT")
        
        # 12 months = ~252 trading days
        custom_mom = compute_rolling_returns(close_df, period=252)
        
        validate_roc(
            close_df["MSFT"],
            period=252,
            custom_result=custom_mom["MSFT"]
        )

    def test_momentum_multiple_periods(self):
        """Test momentum with various lookback periods."""
        np.random.seed(72)
        dates = pd.date_range("2022-01-01", periods=500, freq="D")
        
        returns = np.random.randn(500) * 0.01
        prices = 100 * np.exp(np.cumsum(returns))
        
        close_df = pd.Series(prices, index=dates, dtype=np.float64).to_frame(name="TEST")
        
        # Test various periods (1mo, 3mo, 6mo, 12mo)
        for period in [21, 63, 126, 252]:
            custom_mom = compute_rolling_returns(close_df, period=period)
            validate_roc(
                close_df["TEST"],
                period=period,
                custom_result=custom_mom["TEST"]
            )

    def test_momentum_multiple_tickers(self):
        """Test momentum with multiple tickers."""
        np.random.seed(73)
        dates = pd.date_range("2022-01-01", periods=400, freq="D")
        
        tickers = ["AAPL", "MSFT", "GOOGL", "AMZN"]
        data = {}
        
        for ticker in tickers:
            returns = np.random.randn(400) * 0.02
            data[ticker] = 100 * np.exp(np.cumsum(returns))
        
        close_df = pd.DataFrame(data, index=dates)
        
        # Compute 6-month momentum
        custom_mom = compute_rolling_returns(close_df, period=126)
        
        # Validate each ticker
        for ticker in tickers:
            validate_roc(
                close_df[ticker],
                period=126,
                custom_result=custom_mom[ticker]
            )

    def test_momentum_trending_up(self):
        """Test momentum with strong uptrend."""
        dates = pd.date_range("2023-01-01", periods=300, freq="D")
        
        # Strong uptrend: 1% daily gain on average
        trend = np.linspace(100, 200, 300)
        noise = np.random.randn(300) * 2
        prices = trend + noise
        
        close_df = pd.Series(prices, index=dates, dtype=np.float64).to_frame(name="UP")
        
        custom_mom = compute_rolling_returns(close_df, period=126)
        
        validate_roc(
            close_df["UP"],
            period=126,
            custom_result=custom_mom["UP"]
        )

    def test_momentum_trending_down(self):
        """Test momentum with strong downtrend."""
        np.random.seed(74)
        dates = pd.date_range("2023-01-01", periods=300, freq="D")
        
        # Downtrend
        trend = np.linspace(100, 50, 300)
        noise = np.random.randn(300) * 1
        prices = trend + noise
        
        close_df = pd.Series(prices, index=dates, dtype=np.float64).to_frame(name="DOWN")
        
        custom_mom = compute_rolling_returns(close_df, period=126)
        
        validate_roc(
            close_df["DOWN"],
            period=126,
            custom_result=custom_mom["DOWN"]
        )

    def test_momentum_sideways(self):
        """Test momentum in sideways (choppy) market."""
        np.random.seed(75)
        dates = pd.date_range("2023-01-01", periods=300, freq="D")
        
        # Sideways with mean reversion
        prices = 100 + np.sin(np.arange(300) * 0.1) * 10 + np.random.randn(300) * 2
        
        close_df = pd.Series(prices, index=dates, dtype=np.float64).to_frame(name="SIDE")
        
        custom_mom = compute_rolling_returns(close_df, period=126)
        
        validate_roc(
            close_df["SIDE"],
            period=126,
            custom_result=custom_mom["SIDE"]
        )

    def test_momentum_with_insufficient_data(self):
        """Test momentum with less data than lookback period."""
        dates = pd.date_range("2024-01-01", periods=100, freq="D")
        prices = np.linspace(100, 120, 100)
        
        close_df = pd.Series(prices, index=dates, dtype=np.float64).to_frame(name="SHORT")
        
        # 126-day lookback with only 100 days of data
        custom_mom = compute_rolling_returns(close_df, period=126)
        
        # Should be all NaN
        assert custom_mom["SHORT"].isna().all()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
