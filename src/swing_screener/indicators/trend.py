from __future__ import annotations

from dataclasses import dataclass
import pandas as pd
from swing_screener.utils.dataframe_helpers import get_close_matrix


@dataclass(frozen=True)
class TrendConfig:
    sma_fast: int = 20
    sma_mid: int = 50
    sma_long: int = 200


def sma_per_ticker(close_series: pd.Series, window: int) -> float:
    """
    Compute SMA on a single ticker's non-NaN close prices.
    Returns NaN if insufficient data.
    """
    if window <= 1:
        raise ValueError("window must be > 1")
    valid = close_series.dropna()
    if len(valid) < window:
        return float("nan")
    return valid.iloc[-window:].mean()


def sma(close: pd.DataFrame, window: int) -> pd.DataFrame:
    """
    Backward-compatible SMA helper used by validation tests.

    close: DataFrame date x ticker
    Returns rolling SMA per ticker with TA-Lib-like warmup behavior
    (NaN until `window` observations are available).
    """
    if window <= 1:
        raise ValueError("window must be > 1")
    return close.rolling(window=window, min_periods=window).mean()


def _tail_position_from_end(close: pd.DataFrame) -> pd.DataFrame:
    """For each cell, 1-based position of its non-NaN value counting from the
    series end (NaN cells get the position of the next non-NaN below them)."""
    mask = close.notna()
    return mask.iloc[::-1].cumsum().iloc[::-1]


def _tail_mean_matrix(close: pd.DataFrame, window: int, *, offset: int = 0) -> pd.Series:
    """Mean of each column's non-NaN values in positions (offset, offset+window]
    counting from the end. NaN when fewer than offset+window valid values."""
    pos = _tail_position_from_end(close)
    take = close.notna() & (pos > offset) & (pos <= offset + window)
    counts = take.sum()
    means = close.where(take).sum() / float(window)
    return means.where(counts >= window)


def compute_trend_features(
    ohlcv: pd.DataFrame,
    cfg: TrendConfig = TrendConfig(),
) -> pd.DataFrame:
    """
    Compute trend features per ticker.

    Output: DataFrame indexed by ticker with:
      - last, sma20, sma50, sma200 (by default)
      - trend_ok: (last > sma200) AND (sma50 > sma200)
      - dist_sma20_pct, dist_sma50_pct, dist_sma200_pct

    Computes SMAs per ticker on their actual trading days only,
    ignoring NaN gaps from sparse calendars (e.g., EUR vs USD holidays).
    All features are computed on the whole close matrix at once.
    """
    empty_cols = [
        "last",
        f"sma{cfg.sma_fast}",
        f"sma{cfg.sma_mid}",
        f"sma{cfg.sma_long}",
        "trend_ok",
        "dist_sma20_pct",
        "dist_sma50_pct",
        "dist_sma200_pct",
    ]
    close = get_close_matrix(ohlcv)
    if close.empty:
        return pd.DataFrame(columns=empty_cols, index=pd.Index([], name="ticker"))

    n_valid = close.notna().sum()
    eligible = n_valid[n_valid >= cfg.sma_long].index
    if eligible.empty:
        return pd.DataFrame(columns=empty_cols, index=pd.Index([], name="ticker"))
    close = close[eligible]

    last = close.ffill().iloc[-1]
    sma_fast = _tail_mean_matrix(close, cfg.sma_fast)
    sma_mid = _tail_mean_matrix(close, cfg.sma_mid)
    sma_long = _tail_mean_matrix(close, cfg.sma_long)

    # SMA slopes: (sma[t] / sma[t-window]) - 1 (trend acceleration)
    prev_fast = _tail_mean_matrix(close, cfg.sma_fast, offset=cfg.sma_fast).replace(0.0, float("nan"))
    prev_mid = _tail_mean_matrix(close, cfg.sma_mid, offset=cfg.sma_mid).replace(0.0, float("nan"))

    feats = pd.DataFrame(
        {
            "last": last,
            f"sma{cfg.sma_fast}": sma_fast,
            f"sma{cfg.sma_mid}": sma_mid,
            f"sma{cfg.sma_long}": sma_long,
            "trend_ok": (last > sma_long) & (sma_mid > sma_long),
            "dist_sma20_pct": ((last / sma_fast) - 1.0) * 100.0,
            "dist_sma50_pct": ((last / sma_mid) - 1.0) * 100.0,
            "dist_sma200_pct": ((last / sma_long) - 1.0) * 100.0,
            "sma20_slope": (sma_fast / prev_fast) - 1.0,
            "sma50_slope": (sma_mid / prev_mid) - 1.0,
        }
    )
    feats.index.name = "ticker"
    return feats.sort_index()


def compute_weekly_trend_features(ohlcv: pd.DataFrame) -> pd.DataFrame:
    """
    Compute weekly trend classification per ticker.

    Resamples daily Close to weekly bars (Friday close), then computes
    weekly SMA20 and SMA50 using the existing sma_per_ticker helper.

    Classification:
      "up"      — close > sma20 > sma50
      "down"    — close < sma20 < sma50
      "neutral" — mixed signals or fewer than 50 weekly bars

    Returns DataFrame indexed by ticker with column "weekly_trend".
    """
    close = get_close_matrix(ohlcv)
    if close.empty:
        return pd.DataFrame(
            {"weekly_trend": []}, index=pd.Index([], name="ticker")
        )

    # One resample over the whole matrix; per-bin last() skips NaN, matching
    # the previous per-ticker dropna -> resample behavior.
    weekly = close.resample("W").last()
    n_weekly = weekly.notna().sum()
    w20 = _tail_mean_matrix(weekly, 20)
    w50 = _tail_mean_matrix(weekly, 50)
    last = weekly.ffill().iloc[-1]

    classified = (n_weekly >= 50) & w20.notna() & w50.notna()
    up = classified & (last > w20) & (w20 > w50)
    down = classified & (last < w20) & (w20 < w50)

    trend = pd.Series("neutral", index=weekly.columns.map(str), name="weekly_trend")
    trend[up.values] = "up"
    trend[down.values] = "down"

    out = trend.to_frame()
    out.index.name = "ticker"
    return out.sort_index()
