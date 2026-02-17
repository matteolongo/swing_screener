"""DataFrame utility functions for working with OHLCV data."""
from __future__ import annotations

import pandas as pd


def get_close_matrix(ohlcv: pd.DataFrame) -> pd.DataFrame:
    """Extract Close matrix from OHLCV MultiIndex DataFrame.
    
    Args:
        ohlcv: DataFrame with MultiIndex columns (field, ticker)
        
    Returns:
        DataFrame with index=date, columns=ticker containing closing prices
        
    Raises:
        ValueError: If OHLCV doesn't have MultiIndex columns or Close field
        
    Examples:
        >>> ohlcv = fetch_ohlcv(['AAPL', 'MSFT'])
        >>> close = get_close_matrix(ohlcv)
        >>> close.columns  # ['AAPL', 'MSFT']
    """
    if not isinstance(ohlcv.columns, pd.MultiIndex):
        raise ValueError("OHLCV must have MultiIndex columns (field, ticker).")

    if "Close" not in ohlcv.columns.get_level_values(0):
        raise ValueError("Field 'Close' not found in OHLCV.")

    close = ohlcv["Close"].copy()
    
    # Ensure it's a DataFrame (can be Series if single ticker)
    if not isinstance(close, pd.DataFrame):
        close = close.to_frame()
        
    return close.sort_index()


def get_field_matrix(ohlcv: pd.DataFrame, field: str) -> pd.DataFrame:
    """Extract a specific field matrix from OHLCV MultiIndex DataFrame.
    
    Args:
        ohlcv: DataFrame with MultiIndex columns (field, ticker)
        field: Field name (e.g., 'Open', 'High', 'Low', 'Close', 'Volume')
        
    Returns:
        DataFrame with index=date, columns=ticker for the specified field
        
    Raises:
        ValueError: If OHLCV doesn't have MultiIndex columns or field not found
    """
    if not isinstance(ohlcv.columns, pd.MultiIndex):
        raise ValueError("OHLCV must have MultiIndex columns (field, ticker).")

    if field not in ohlcv.columns.get_level_values(0):
        raise ValueError(f"Field '{field}' not found in OHLCV.")

    matrix = ohlcv[field].copy()
    
    # Ensure it's a DataFrame
    if not isinstance(matrix, pd.DataFrame):
        matrix = matrix.to_frame()
        
    return matrix.sort_index()


def sma(series: pd.Series, period: int, min_periods: int | None = None) -> pd.Series:
    """Calculate Simple Moving Average.
    
    Args:
        series: Input time series
        period: Window size for the moving average
        min_periods: Minimum number of observations required. Defaults to period.
        
    Returns:
        Series with the same index as input, containing the SMA
        
    Examples:
        >>> prices = pd.Series([100, 102, 101, 103, 105])
        >>> sma_3 = sma(prices, 3)
    """
    if min_periods is None:
        min_periods = period
    return series.rolling(window=period, min_periods=min_periods).mean()


def ema(series: pd.Series, span: int, min_periods: int = 0) -> pd.Series:
    """Calculate Exponential Moving Average.
    
    Args:
        series: Input time series
        span: Span for the EMA (corresponds to N-day EMA)
        min_periods: Minimum number of observations required
        
    Returns:
        Series with the same index as input, containing the EMA
    """
    return series.ewm(span=span, min_periods=min_periods, adjust=False).mean()
