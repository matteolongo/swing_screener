"""Validation utilities for comparing custom indicators against TA-Lib.

This module provides helpers for validating that our custom indicator
implementations produce the same results as TA-Lib (the industry-standard
technical analysis library).

Used only in tests - production code remains unchanged.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

try:
    import talib
    TALIB_AVAILABLE = True
except ImportError:
    TALIB_AVAILABLE = False


def require_talib():
    """Decorator to skip tests if TA-Lib is not available."""
    import pytest
    return pytest.mark.skipif(not TALIB_AVAILABLE, reason="TA-Lib not installed")


def assert_series_close(
    custom: pd.Series,
    talib_result: pd.Series | np.ndarray,
    rtol: float = 1e-5,
    atol: float = 1e-8,
    name: str = "indicator"
):
    """Assert that custom implementation matches TA-Lib result.
    
    Args:
        custom: Result from custom implementation (pandas Series)
        talib_result: Result from TA-Lib (Series or ndarray)
        rtol: Relative tolerance for np.allclose
        atol: Absolute tolerance for np.allclose
        name: Name of indicator for error messages
        
    Raises:
        AssertionError: If results don't match within tolerance
    """
    if not TALIB_AVAILABLE:
        raise RuntimeError("TA-Lib not available for validation")
    
    # Convert TA-Lib result to Series if needed
    if isinstance(talib_result, np.ndarray):
        talib_series = pd.Series(talib_result, index=custom.index)
    else:
        talib_series = talib_result
    
    # Compare lengths
    assert len(custom) == len(talib_series), (
        f"{name}: Length mismatch - custom={len(custom)}, talib={len(talib_series)}"
    )
    
    # Handle NaN values - both should have NaN in same positions
    custom_nan_mask = custom.isna()
    talib_nan_mask = talib_series.isna()
    
    # Check NaN positions match
    if not custom_nan_mask.equals(talib_nan_mask):
        nan_diff = custom_nan_mask != talib_nan_mask
        mismatches = nan_diff.sum()
        raise AssertionError(
            f"{name}: NaN positions don't match ({mismatches} differences)\n"
            f"Custom NaN count: {custom_nan_mask.sum()}, "
            f"TA-Lib NaN count: {talib_nan_mask.sum()}"
        )
    
    # Compare non-NaN values
    valid_mask = ~custom_nan_mask
    if valid_mask.any():
        custom_valid = custom[valid_mask].values
        talib_valid = talib_series[valid_mask].values
        
        if not np.allclose(custom_valid, talib_valid, rtol=rtol, atol=atol, equal_nan=True):
            max_diff = np.abs(custom_valid - talib_valid).max()
            max_rel_diff = (np.abs(custom_valid - talib_valid) / np.abs(talib_valid)).max()
            raise AssertionError(
                f"{name}: Values don't match within tolerance\n"
                f"Max absolute difference: {max_diff:.10f}\n"
                f"Max relative difference: {max_rel_diff:.10f}\n"
                f"Tolerance: rtol={rtol}, atol={atol}"
            )


def assert_dataframe_close(
    custom: pd.DataFrame,
    talib_results: dict[str, np.ndarray],
    rtol: float = 1e-5,
    atol: float = 1e-8,
    name: str = "indicator"
):
    """Assert that custom DataFrame matches TA-Lib results for multiple tickers.
    
    Args:
        custom: DataFrame with tickers as columns
        talib_results: Dict mapping ticker -> TA-Lib result array
        rtol: Relative tolerance
        atol: Absolute tolerance
        name: Name of indicator
    """
    if not TALIB_AVAILABLE:
        raise RuntimeError("TA-Lib not available for validation")
    
    # Check all tickers present
    for ticker in custom.columns:
        if ticker not in talib_results:
            raise AssertionError(f"{name}: Ticker {ticker} missing from TA-Lib results")
        
        assert_series_close(
            custom[ticker],
            talib_results[ticker],
            rtol=rtol,
            atol=atol,
            name=f"{name}[{ticker}]"
        )


def validate_sma(close: pd.Series, window: int, custom_result: pd.Series) -> None:
    """Validate custom SMA against TA-Lib SMA.
    
    Args:
        close: Close price series
        window: SMA window
        custom_result: Result from custom SMA function
    """
    if not TALIB_AVAILABLE:
        raise RuntimeError("TA-Lib not available")
    
    # Ensure float64 for TA-Lib
    close_values = close.values.astype(np.float64)
    talib_sma = talib.SMA(close_values, timeperiod=window)
    assert_series_close(custom_result, talib_sma, name=f"SMA({window})")


def validate_atr(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    window: int,
    custom_result: pd.Series
) -> None:
    """Validate custom ATR against TA-Lib ATR.
    
    Note: There may be a 1-index difference in the first valid value position
    due to different warmup period handling. This is acceptable.
    
    Args:
        high: High price series
        low: Low price series
        close: Close price series
        window: ATR window
        custom_result: Result from custom ATR function
    """
    if not TALIB_AVAILABLE:
        raise RuntimeError("TA-Lib not available")
    
    # Ensure float64 for TA-Lib
    high_values = high.values.astype(np.float64)
    low_values = low.values.astype(np.float64)
    close_values = close.values.astype(np.float64)
    
    talib_atr = talib.ATR(high_values, low_values, close_values, timeperiod=window)
    talib_series = pd.Series(talib_atr, index=custom_result.index)
    
    # Handle NaN positions - allow for 1-index difference in warmup period
    custom_nan_mask = custom_result.isna()
    talib_nan_mask = talib_series.isna()
    
    nan_diff_count = (custom_nan_mask != talib_nan_mask).sum()
    
    # Allow up to 1 difference in NaN positions (warmup period handling)
    if nan_diff_count > 1:
        raise AssertionError(
            f"ATR({window}): Too many NaN position differences ({nan_diff_count})\n"
            f"Expected at most 1 (warmup period difference), got {nan_diff_count}"
        )
    
    # Compare non-NaN values where both are valid
    both_valid = ~custom_nan_mask & ~talib_nan_mask
    if both_valid.any():
        custom_valid = custom_result[both_valid].values
        talib_valid = talib_series[both_valid].values
        
        if not np.allclose(custom_valid, talib_valid, rtol=1e-5, atol=1e-8):
            max_diff = np.abs(custom_valid - talib_valid).max()
            max_rel_diff = (np.abs(custom_valid - talib_valid) / np.abs(talib_valid)).max()
            raise AssertionError(
                f"ATR({window}): Values don't match\n"
                f"Max absolute difference: {max_diff:.10f}\n"
                f"Max relative difference: {max_rel_diff:.10f}"
            )


def validate_roc(close: pd.Series, period: int, custom_result: pd.Series) -> None:
    """Validate custom momentum (returns) against TA-Lib ROC.
    
    Note: Our custom momentum uses (close[t] / close[t-n] - 1) which is
    equivalent to ROC / 100, so we need to adjust.
    
    Args:
        close: Close price series
        period: Lookback period
        custom_result: Result from custom momentum function (as fraction)
    """
    if not TALIB_AVAILABLE:
        raise RuntimeError("TA-Lib not available")
    
    # Ensure float64 for TA-Lib
    close_values = close.values.astype(np.float64)
    
    talib_roc = talib.ROC(close_values, timeperiod=period)
    # ROC returns percentage, our custom returns fraction, so convert
    talib_roc_fraction = talib_roc / 100.0
    
    assert_series_close(
        custom_result,
        talib_roc_fraction,
        rtol=1e-5,
        atol=1e-8,
        name=f"ROC({period})"
    )
