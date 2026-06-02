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
    """
    close = get_close_matrix(ohlcv)
    if close.empty:
        cols = [
            "last",
            f"sma{cfg.sma_fast}",
            f"sma{cfg.sma_mid}",
            f"sma{cfg.sma_long}",
            "trend_ok",
            "dist_sma20_pct",
            "dist_sma50_pct",
            "dist_sma200_pct",
        ]
        return pd.DataFrame(columns=cols, index=pd.Index([], name="ticker"))

    results = []
    for ticker in close.columns:
        series = close[ticker]
        valid = series.dropna()
        if len(valid) < cfg.sma_long:
            continue
            
        last_val = valid.iloc[-1]
        sma_fast_val = sma_per_ticker(series, cfg.sma_fast)
        sma_mid_val = sma_per_ticker(series, cfg.sma_mid)
        sma_long_val = sma_per_ticker(series, cfg.sma_long)
        
        if pd.isna(sma_long_val):
            continue
            
        trend_ok = (last_val > sma_long_val) and (sma_mid_val > sma_long_val)
        dist_sma20 = ((last_val / sma_fast_val) - 1.0) * 100.0 if pd.notna(sma_fast_val) else float("nan")
        dist_sma50 = ((last_val / sma_mid_val) - 1.0) * 100.0 if pd.notna(sma_mid_val) else float("nan")
        dist_sma200 = ((last_val / sma_long_val) - 1.0) * 100.0 if pd.notna(sma_long_val) else float("nan")
        
        # SMA slopes: (sma[t] / sma[t-window]) - 1 (trend acceleration)
        sma20_slope = float("nan")
        if len(valid) >= cfg.sma_fast * 2:
            sma_now = valid.iloc[-cfg.sma_fast:].mean()
            sma_prev = valid.iloc[-cfg.sma_fast * 2:-cfg.sma_fast].mean()
            if sma_prev and sma_prev != 0:
                sma20_slope = (sma_now / sma_prev) - 1.0

        sma50_slope = float("nan")
        if len(valid) >= cfg.sma_mid * 2:
            sma_now_mid = valid.iloc[-cfg.sma_mid:].mean()
            sma_prev_mid = valid.iloc[-cfg.sma_mid * 2:-cfg.sma_mid].mean()
            if sma_prev_mid and sma_prev_mid != 0:
                sma50_slope = (sma_now_mid / sma_prev_mid) - 1.0

        results.append({
            "ticker": ticker,
            "last": last_val,
            f"sma{cfg.sma_fast}": sma_fast_val,
            f"sma{cfg.sma_mid}": sma_mid_val,
            f"sma{cfg.sma_long}": sma_long_val,
            "trend_ok": trend_ok,
            "dist_sma20_pct": dist_sma20,
            "dist_sma50_pct": dist_sma50,
            "dist_sma200_pct": dist_sma200,
            "sma20_slope": sma20_slope,
            "sma50_slope": sma50_slope,
        })
    
    if not results:
        cols = [
            "last",
            f"sma{cfg.sma_fast}",
            f"sma{cfg.sma_mid}",
            f"sma{cfg.sma_long}",
            "trend_ok",
            "dist_sma20_pct",
            "dist_sma50_pct",
            "dist_sma200_pct",
        ]
        return pd.DataFrame(columns=cols, index=pd.Index([], name="ticker"))
    
    feats = pd.DataFrame(results).set_index("ticker")
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

    results = []
    for ticker in close.columns:
        series = close[ticker].dropna()
        weekly = series.resample("W").last().dropna()

        if len(weekly) < 50:
            results.append({"ticker": str(ticker), "weekly_trend": "neutral"})
            continue

        w20 = sma_per_ticker(weekly, 20)
        w50 = sma_per_ticker(weekly, 50)
        last = float(weekly.iloc[-1])

        if pd.isna(w20) or pd.isna(w50):
            results.append({"ticker": str(ticker), "weekly_trend": "neutral"})
            continue

        if last > w20 > w50:
            trend = "up"
        elif last < w20 < w50:
            trend = "down"
        else:
            trend = "neutral"

        results.append({"ticker": str(ticker), "weekly_trend": trend})

    if not results:
        return pd.DataFrame(
            {"weekly_trend": []}, index=pd.Index([], name="ticker")
        )

    return pd.DataFrame(results).set_index("ticker").sort_index()
