from __future__ import annotations

from dataclasses import dataclass
import pandas as pd


@dataclass(frozen=True)
class TrendConfig:
    sma_fast: int = 20
    sma_mid: int = 50
    sma_long: int = 200


def _get_close_matrix(ohlcv: pd.DataFrame) -> pd.DataFrame:
    """
    Extract Close matrix from OHLCV MultiIndex DataFrame (field, ticker).
    Returns: DataFrame index=date, columns=ticker
    """
    if not isinstance(ohlcv.columns, pd.MultiIndex):
        raise ValueError("OHLCV must have MultiIndex columns (field, ticker).")

    if "Close" not in ohlcv.columns.get_level_values(0):
        raise ValueError("Field 'Close' not found in OHLCV.")

    close = ohlcv["Close"].copy()
    if not isinstance(close, pd.DataFrame):
        close = close.to_frame()

    close = close.dropna(axis=1, how="all").sort_index()
    return close


def sma(close: pd.DataFrame, window: int) -> pd.DataFrame:
    """
    Simple Moving Average for each ticker.
    close: DataFrame date x ticker
    """
    if window <= 1:
        raise ValueError("window must be > 1")
    return close.rolling(window=window, min_periods=window).mean()


def compute_trend_features(
    ohlcv: pd.DataFrame,
    cfg: TrendConfig = TrendConfig(),
) -> pd.DataFrame:
    """
    Compute trend features per ticker.

    Output: DataFrame indexed by ticker with:
      - last, sma20, sma50, sma200 (by default)
      - trend_ok: (last > sma200) AND (sma50 > sma200)
      - dist_sma50_pct, dist_sma200_pct
    """
    close = _get_close_matrix(ohlcv)
    if close.empty:
        cols = [
            "last",
            f"sma{cfg.sma_fast}",
            f"sma{cfg.sma_mid}",
            f"sma{cfg.sma_long}",
            "trend_ok",
            "dist_sma50_pct",
            "dist_sma200_pct",
        ]
        return pd.DataFrame(columns=cols, index=pd.Index([], name="ticker"))

    sma_fast = sma(close, cfg.sma_fast)
    sma_mid = sma(close, cfg.sma_mid)
    sma_long = sma(close, cfg.sma_long)

    last = close.iloc[-1]
    f = sma_fast.iloc[-1]
    m = sma_mid.iloc[-1]
    l = sma_long.iloc[-1]

    feats = pd.DataFrame(
        {
            "last": last,
            f"sma{cfg.sma_fast}": f,
            f"sma{cfg.sma_mid}": m,
            f"sma{cfg.sma_long}": l,
        }
    )

    long_col = f"sma{cfg.sma_long}"
    mid_col = f"sma{cfg.sma_mid}"

    feats["trend_ok"] = (feats["last"] > feats[long_col]) & (
        feats[mid_col] > feats[long_col]
    )

    feats["dist_sma50_pct"] = (feats["last"] / feats[mid_col] - 1.0) * 100.0
    feats["dist_sma200_pct"] = (feats["last"] / feats[long_col] - 1.0) * 100.0

    # Drop tickers without enough history for SMA long
    feats = feats.dropna(subset=[long_col])

    # Order columns nicely
    feats = feats[
        [
            "last",
            f"sma{cfg.sma_fast}",
            mid_col,
            long_col,
            "trend_ok",
            "dist_sma50_pct",
            "dist_sma200_pct",
        ]
    ].sort_index()

    return feats
