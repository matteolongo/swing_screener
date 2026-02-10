"""Validation tests for ATR indicator against TA-Lib.

Our custom ATR implementation uses **Wilder's smoothing** and should
match TA-Lib within tolerance.
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

from swing_screener.indicators.volatility import compute_atr
from utils.talib_validators import require_talib, validate_atr, TALIB_AVAILABLE

if TALIB_AVAILABLE:
    import talib


@require_talib()
class TestATRValidation:
    """Validate custom ATR against TA-Lib ATR."""

    def test_atr_single_ticker_window_14(self):
        """Test ATR(14) for single ticker matches TA-Lib."""
        np.random.seed(50)
        dates = pd.date_range("2024-01-01", periods=100, freq="D")
        
        # Generate realistic OHLC data
        close = 100 + np.cumsum(np.random.randn(100) * 2)
        high = close + np.abs(np.random.randn(100) * 1.5)
        low = close - np.abs(np.random.randn(100) * 1.5)
        
        high_df = pd.Series(high, index=dates).to_frame(name="AAPL")
        low_df = pd.Series(low, index=dates).to_frame(name="AAPL")
        close_df = pd.Series(close, index=dates).to_frame(name="AAPL")
        
        # Compute custom ATR
        custom_atr = compute_atr(high_df, low_df, close_df, window=14)
        
        # Validate against TA-Lib
        validate_atr(
            high_df["AAPL"],
            low_df["AAPL"],
            close_df["AAPL"],
            window=14,
            custom_result=custom_atr["AAPL"]
        )

    def test_atr_multiple_windows(self):
        """Test ATR with different window sizes."""
        np.random.seed(51)
        dates = pd.date_range("2024-01-01", periods=200, freq="D")
        
        close = 150 + np.cumsum(np.random.randn(200) * 3)
        high = close + np.abs(np.random.randn(200) * 2)
        low = close - np.abs(np.random.randn(200) * 2)
        
        high_df = pd.Series(high, index=dates).to_frame(name="MSFT")
        low_df = pd.Series(low, index=dates).to_frame(name="MSFT")
        close_df = pd.Series(close, index=dates).to_frame(name="MSFT")
        
        # Test multiple windows
        for window in [7, 14, 21, 28]:
            custom_atr = compute_atr(high_df, low_df, close_df, window=window)
            validate_atr(
                high_df["MSFT"],
                low_df["MSFT"],
                close_df["MSFT"],
                window=window,
                custom_result=custom_atr["MSFT"]
            )

    def test_atr_multiple_tickers(self):
        """Test ATR with multiple tickers."""
        np.random.seed(52)
        dates = pd.date_range("2024-01-01", periods=100, freq="D")
        
        tickers = ["AAPL", "MSFT", "GOOGL"]
        high_data = {}
        low_data = {}
        close_data = {}
        
        for ticker in tickers:
            close = 100 + np.cumsum(np.random.randn(100) * 2)
            high_data[ticker] = close + np.abs(np.random.randn(100) * 1.5)
            low_data[ticker] = close - np.abs(np.random.randn(100) * 1.5)
            close_data[ticker] = close
        
        high_df = pd.DataFrame(high_data, index=dates)
        low_df = pd.DataFrame(low_data, index=dates)
        close_df = pd.DataFrame(close_data, index=dates)
        
        # Compute custom ATR
        custom_atr = compute_atr(high_df, low_df, close_df, window=14)
        
        # Validate each ticker
        for ticker in tickers:
            validate_atr(
                high_df[ticker],
                low_df[ticker],
                close_df[ticker],
                window=14,
                custom_result=custom_atr[ticker]
            )

    def test_atr_with_gaps(self):
        """Test ATR with price gaps (high volatility events)."""
        np.random.seed(53)
        dates = pd.date_range("2024-01-01", periods=100, freq="D")
        
        close = 100 + np.cumsum(np.random.randn(100) * 2)
        # Introduce gaps
        close[30] = close[29] * 1.1  # 10% gap up
        close[60] = close[59] * 0.9  # 10% gap down
        
        high = close + np.abs(np.random.randn(100) * 1.5)
        low = close - np.abs(np.random.randn(100) * 1.5)
        
        high_df = pd.Series(high, index=dates).to_frame(name="GAP")
        low_df = pd.Series(low, index=dates).to_frame(name="GAP")
        close_df = pd.Series(close, index=dates).to_frame(name="GAP")
        
        custom_atr = compute_atr(high_df, low_df, close_df, window=14)
        
        validate_atr(
            high_df["GAP"],
            low_df["GAP"],
            close_df["GAP"],
            window=14,
            custom_result=custom_atr["GAP"]
        )

    def test_atr_low_volatility(self):
        """Test ATR with low volatility (tight ranges)."""
        dates = pd.date_range("2024-01-01", periods=100, freq="D")
        
        # Very tight trading range
        close = 100 + np.cumsum(np.random.randn(100) * 0.1)
        high = close + 0.05
        low = close - 0.05
        
        high_df = pd.Series(high, index=dates).to_frame(name="LOW_VOL")
        low_df = pd.Series(low, index=dates).to_frame(name="LOW_VOL")
        close_df = pd.Series(close, index=dates).to_frame(name="LOW_VOL")
        
        custom_atr = compute_atr(high_df, low_df, close_df, window=14)
        
        validate_atr(
            high_df["LOW_VOL"],
            low_df["LOW_VOL"],
            close_df["LOW_VOL"],
            window=14,
            custom_result=custom_atr["LOW_VOL"]
        )

    def test_atr_high_volatility(self):
        """Test ATR with high volatility (wide ranges)."""
        np.random.seed(54)
        dates = pd.date_range("2024-01-01", periods=100, freq="D")
        
        # High volatility
        close = 100 + np.cumsum(np.random.randn(100) * 5)
        high = close + np.abs(np.random.randn(100) * 10)
        low = close - np.abs(np.random.randn(100) * 10)
        
        high_df = pd.Series(high, index=dates).to_frame(name="HIGH_VOL")
        low_df = pd.Series(low, index=dates).to_frame(name="HIGH_VOL")
        close_df = pd.Series(close, index=dates).to_frame(name="HIGH_VOL")
        
        custom_atr = compute_atr(high_df, low_df, close_df, window=14)
        
        validate_atr(
            high_df["HIGH_VOL"],
            low_df["HIGH_VOL"],
            close_df["HIGH_VOL"],
            window=14,
            custom_result=custom_atr["HIGH_VOL"]
        )

    def test_atr_insufficient_data(self):
        """Test ATR with insufficient data."""
        dates = pd.date_range("2024-01-01", periods=10, freq="D")
        
        close = np.linspace(100, 110, 10)
        high = close + 1
        low = close - 1
        
        high_df = pd.Series(high, index=dates, dtype=np.float64).to_frame(name="SHORT")
        low_df = pd.Series(low, index=dates, dtype=np.float64).to_frame(name="SHORT")
        close_df = pd.Series(close, index=dates, dtype=np.float64).to_frame(name="SHORT")
        
        # ATR(14) with only 10 data points - should have NaN
        custom_atr = compute_atr(high_df, low_df, close_df, window=14)
        
        # Should be all NaN
        assert custom_atr["SHORT"].isna().all()
        
        # TA-Lib should also be all NaN
        talib_atr = talib.ATR(high, low, close, timeperiod=14)
        assert np.isnan(talib_atr).all()

    def test_atr_window_2(self):
        """Test ATR with minimum window."""
        np.random.seed(55)
        dates = pd.date_range("2024-01-01", periods=50, freq="D")
        
        close = 100 + np.cumsum(np.random.randn(50) * 2)
        high = close + np.abs(np.random.randn(50) * 1)
        low = close - np.abs(np.random.randn(50) * 1)
        
        high_df = pd.Series(high, index=dates).to_frame(name="MIN")
        low_df = pd.Series(low, index=dates).to_frame(name="MIN")
        close_df = pd.Series(close, index=dates).to_frame(name="MIN")
        
        custom_atr = compute_atr(high_df, low_df, close_df, window=2)
        
        validate_atr(
            high_df["MIN"],
            low_df["MIN"],
            close_df["MIN"],
            window=2,
            custom_result=custom_atr["MIN"]
        )

    def test_atr_large_dataset(self):
        """Test ATR with large dataset (5+ years)."""
        np.random.seed(60)
        dates = pd.date_range("2019-01-01", periods=1260, freq="D")
        
        close = 100 + np.cumsum(np.random.randn(1260) * 2)
        high = close + np.abs(np.random.randn(1260) * 1.5)
        low = close - np.abs(np.random.randn(1260) * 1.5)
        
        high_df = pd.Series(high, index=dates).to_frame(name="LARGE")
        low_df = pd.Series(low, index=dates).to_frame(name="LARGE")
        close_df = pd.Series(close, index=dates).to_frame(name="LARGE")
        
        custom_atr = compute_atr(high_df, low_df, close_df, window=14)
        
        validate_atr(
            high_df["LARGE"],
            low_df["LARGE"],
            close_df["LARGE"],
            window=14,
            custom_result=custom_atr["LARGE"]
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
