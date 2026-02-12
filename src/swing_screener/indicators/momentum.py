from __future__ import annotations

from dataclasses import dataclass
import pandas as pd


@dataclass(frozen=True)
class MomentumConfig:
    # approx trading days
    lookback_6m: int = 126
    lookback_12m: int = 252
    benchmark: str = "SPY"


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

    return close.dropna(axis=1, how="all").sort_index()


def compute_returns(close: pd.DataFrame, lookback: int) -> pd.Series:
    """
    Percent return over `lookback` bars:
      r = close[t] / close[t-lookback] - 1

    close: DataFrame date x ticker
    Returns: Series index=ticker
    
    Computes returns per ticker on their actual trading days only,
    ignoring NaN gaps from sparse calendars (e.g., EUR vs USD holidays).
    """
    if lookback <= 1:
        raise ValueError("lookback must be > 1")

    results = {}
    for ticker in close.columns:
        series = close[ticker].dropna()
        if len(series) < lookback + 1:
            # Need at least lookback + 1 points: one for current, lookback for past
            continue
        last_val = series.iloc[-1]
        prev_val = series.iloc[-(lookback + 1)]
        if pd.notna(last_val) and pd.notna(prev_val) and prev_val != 0:
            results[ticker] = (last_val / prev_val) - 1.0
    
    return pd.Series(results)


def compute_momentum_features(
    ohlcv: pd.DataFrame,
    cfg: MomentumConfig = MomentumConfig(),
) -> pd.DataFrame:
    """
    Output per ticker:
      - mom_6m
      - mom_12m
      - rs_6m = mom_6m - benchmark_mom_6m

    Benchmark ticker is removed from the output index.
    """
    close = _get_close_matrix(ohlcv)
    if close.empty:
        cols = ["mom_6m", "mom_12m", "rs_6m"]
        return pd.DataFrame(columns=cols, index=pd.Index([], name="ticker"))

    if cfg.benchmark not in close.columns:
        cols = ["mom_6m", "mom_12m", "rs_6m"]
        return pd.DataFrame(columns=cols, index=pd.Index([], name="ticker"))

    mom6 = compute_returns(close, cfg.lookback_6m).rename("mom_6m")
    mom12 = compute_returns(close, cfg.lookback_12m).rename("mom_12m")

    bmk6 = mom6.get(cfg.benchmark, None)
    if bmk6 is None or pd.isna(bmk6):
        cols = ["mom_6m", "mom_12m", "rs_6m"]
        return pd.DataFrame(columns=cols, index=pd.Index([], name="ticker"))

    rs6 = (mom6 - bmk6).rename("rs_6m")

    feats = pd.concat([mom6, mom12, rs6], axis=1)

    # Remove benchmark from candidates
    feats = feats.drop(index=cfg.benchmark, errors="ignore")

    # Drop tickers lacking enough history
    feats = feats.dropna(subset=["mom_6m", "mom_12m"])

    return feats.sort_index()
