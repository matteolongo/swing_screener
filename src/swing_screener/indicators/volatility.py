from __future__ import annotations

from dataclasses import dataclass
import numpy as np
import pandas as pd


@dataclass(frozen=True)
class VolatilityConfig:
    atr_window: int = 14


def _extract_field_matrix(ohlcv: pd.DataFrame, field: str) -> pd.DataFrame:
    """
    Extract a (date x ticker) DataFrame for a given field from OHLCV MultiIndex (field, ticker).
    """
    if not isinstance(ohlcv.columns, pd.MultiIndex):
        raise ValueError("OHLCV must have MultiIndex columns (field, ticker).")

    if field not in ohlcv.columns.get_level_values(0):
        raise ValueError(f"Field '{field}' not found in OHLCV.")

    m = ohlcv[field].copy()
    if not isinstance(m, pd.DataFrame):
        m = m.to_frame()

    return m.dropna(axis=1, how="all").sort_index()


def compute_atr_per_ticker(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    window: int = 14,
) -> float:
    """
    Compute ATR for a single ticker on its actual trading days.
    
    Returns the last ATR value, or NaN if insufficient data.
    """
    if window <= 1:
        raise ValueError("window must be > 1")
    
    # Drop NaN values - only compute on actual trading days
    valid_mask = high.notna() & low.notna() & close.notna()
    h = high[valid_mask]
    l = low[valid_mask]
    c = close[valid_mask]
    
    if len(h) < window + 1:
        return float("nan")
    
    # Compute True Range
    prev_c = c.shift(1)
    tr1 = h - l
    tr2 = (h - prev_c).abs()
    tr3 = (l - prev_c).abs()
    
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    
    # Wilder's smoothing
    tr_vals = tr.to_numpy(dtype=float)
    atr_vals = np.full_like(tr_vals, np.nan, dtype=float)
    
    # Seed with SMA of first window TR values (skip first value)
    first_atr = np.nanmean(tr_vals[1:window + 1])
    atr_vals[window] = first_atr
    
    # Smooth remaining values
    for i in range(window + 1, len(tr_vals)):
        prev_atr = atr_vals[i - 1]
        curr_tr = tr_vals[i]
        if np.isnan(prev_atr) or np.isnan(curr_tr):
            atr_vals[i] = np.nan
        else:
            atr_vals[i] = (prev_atr * (window - 1) + curr_tr) / window
    
    return atr_vals[-1]


def compute_atr(
    high: pd.DataFrame,
    low: pd.DataFrame,
    close: pd.DataFrame,
    window: int = 14,
) -> pd.DataFrame:
    """
    Compute ATR per ticker.

    True Range (TR) = max(
      high - low,
      abs(high - prev_close),
      abs(low - prev_close)
    )

    Returns: DataFrame (date x ticker) ATR using Wilder's smoothing.
    
    NOTE: This is kept for backward compatibility but is not recommended
    for sparse calendar data. Use compute_atr_per_ticker instead.
    """
    if window <= 1:
        raise ValueError("window must be > 1")

    prev_close = close.shift(1)

    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()

    # Concatenate and take row-wise max per ticker
    tr = pd.concat([tr1, tr2, tr3], axis=1)
    tr = tr.T.groupby(level=0).max().T

    atr = pd.DataFrame(index=tr.index, columns=tr.columns, dtype=float)
    for col in tr.columns:
        tr_vals = tr[col].to_numpy(dtype=float)
        atr_vals = np.full_like(tr_vals, np.nan, dtype=float)
        if len(tr_vals) >= window + 1:
            # TA-Lib seeds ATR with SMA of TR over the first window,
            # starting at index 1 (skips the very first TR value).
            first_atr = np.nanmean(tr_vals[1:window + 1])
            atr_vals[window] = first_atr
            for i in range(window + 1, len(tr_vals)):
                prev = atr_vals[i - 1]
                curr = tr_vals[i]
                if np.isnan(prev) or np.isnan(curr):
                    atr_vals[i] = np.nan
                else:
                    atr_vals[i] = (prev * (window - 1) + curr) / window
        atr[col] = atr_vals
    return atr


def compute_volatility_features(
    ohlcv: pd.DataFrame,
    cfg: VolatilityConfig = VolatilityConfig(),
) -> pd.DataFrame:
    """
    Returns per-ticker volatility features:
      - atr{window}: last ATR value
      - atr_pct: atr / last_close * 100
      
    Computes ATR per ticker on their actual trading days only,
    ignoring NaN gaps from sparse calendars (e.g., EUR vs USD holidays).
    """
    high = _extract_field_matrix(ohlcv, "High")
    low = _extract_field_matrix(ohlcv, "Low")
    close = _extract_field_matrix(ohlcv, "Close")
    if high.empty or low.empty or close.empty:
        cols = [f"atr{cfg.atr_window}", "atr_pct"]
        return pd.DataFrame(columns=cols, index=pd.Index([], name="ticker"))

    common = sorted(set(high.columns) & set(low.columns) & set(close.columns))
    if not common:
        cols = [f"atr{cfg.atr_window}", "atr_pct"]
        return pd.DataFrame(columns=cols, index=pd.Index([], name="ticker"))

    results = []
    for ticker in common:
        h_series = high[ticker]
        l_series = low[ticker]
        c_series = close[ticker]
        
        # Get last close value for this ticker
        valid_close = c_series.dropna()
        if valid_close.empty:
            continue
        last_close_val = valid_close.iloc[-1]
        
        # Compute ATR on actual trading days only
        atr_val = compute_atr_per_ticker(h_series, l_series, c_series, window=cfg.atr_window)
        
        if pd.isna(atr_val):
            continue
            
        results.append({
            "ticker": ticker,
            f"atr{cfg.atr_window}": atr_val,
            "atr_pct": (atr_val / last_close_val) * 100.0,
        })
    
    if not results:
        cols = [f"atr{cfg.atr_window}", "atr_pct"]
        return pd.DataFrame(columns=cols, index=pd.Index([], name="ticker"))
    
    feats = pd.DataFrame(results).set_index("ticker")
    return feats.sort_index()
