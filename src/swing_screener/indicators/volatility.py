from __future__ import annotations

from dataclasses import dataclass
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

    Returns: DataFrame (date x ticker) ATR
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

    atr = tr.rolling(window=window, min_periods=window).mean()
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

    common = sorted(set(high.columns) & set(low.columns) & set(close.columns))
    if not common:
        raise ValueError("No common tickers across High/Low/Close.")

    high = high[common]
    low = low[common]
    close = close[common]

    atr_df = compute_atr(high, low, close, window=cfg.atr_window)

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
