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

    high = high[common]
    low = low[common]
    close = close[common]
    # Sparse exchange calendars introduce NaNs for non-trading days.
    # ATR should operate on the latest known OHLC values per ticker.
    high = high.ffill()
    low = low.ffill()
    close = close.ffill()

    atr_df = compute_atr(high, low, close, window=cfg.atr_window)
    if atr_df.empty or close.empty:
        cols = [f"atr{cfg.atr_window}", "atr_pct"]
        return pd.DataFrame(columns=cols, index=pd.Index([], name="ticker"))

    last_close = close.iloc[-1]
    last_atr = atr_df.iloc[-1]

    feats = pd.DataFrame(
        {
            f"atr{cfg.atr_window}": last_atr,
            "atr_pct": (last_atr / last_close) * 100.0,
        }
    )

    feats = feats.dropna(subset=[f"atr{cfg.atr_window}"]).sort_index()
    return feats
