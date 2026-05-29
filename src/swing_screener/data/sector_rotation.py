"""Sector ETF rotation utilities.

Maps stock sectors to SPDR ETF benchmarks and computes rotation signals
(4-week vs 13-week RS) to identify sectors with positive momentum flows.
"""
from __future__ import annotations

import pandas as pd

from swing_screener.utils.dataframe_helpers import get_close_matrix


# SPDR sector ETF -> Morningstar/yfinance sector name mapping
SECTOR_ETFS: dict[str, str] = {
    "XLK": "Technology",
    "XLF": "Financial Services",
    "XLE": "Energy",
    "XLV": "Health Care",
    "XLI": "Industrials",
    "XLY": "Consumer Cyclical",
    "XLP": "Consumer Defensive",
    "XLB": "Basic Materials",
    "XLU": "Utilities",
    "XLRE": "Real Estate",
    "XLC": "Communication Services",
}

_ETF_BY_SECTOR: dict[str, str] = {v: k for k, v in SECTOR_ETFS.items()}


def map_sector_to_etf(sector: str | None) -> str | None:
    """Returns SPDR ETF ticker for a sector name, or None if not mapped."""
    if not sector:
        return None
    return _ETF_BY_SECTOR.get(sector)


def compute_sector_benchmark_returns(
    ohlcv: pd.DataFrame,
    lookback: int = 126,
) -> dict[str, float]:
    """Returns ETF ticker -> 6-month return for all SECTOR_ETFS present in ohlcv."""
    close = get_close_matrix(ohlcv)
    result: dict[str, float] = {}
    for etf in SECTOR_ETFS:
        if etf not in close.columns:
            continue
        series = close[etf].dropna()
        if len(series) < lookback + 1:
            continue
        last = series.iloc[-1]
        prev = series.iloc[-(lookback + 1)]
        if prev > 0:
            result[etf] = float(last / prev) - 1.0
    return result


def build_ticker_sector_returns(
    ticker_sectors: dict[str, str | None],
    etf_returns: dict[str, float],
) -> dict[str, float | None]:
    """Maps each ticker to the 6m return of its sector ETF.

    ticker_sectors: {ticker: sector_name}  (sector_name from yfinance .info["sector"])
    etf_returns: {etf_ticker: 6m_return}   (from compute_sector_benchmark_returns)
    Returns {ticker: return_or_None}
    """
    result: dict[str, float | None] = {}
    for ticker, sector in ticker_sectors.items():
        etf = map_sector_to_etf(sector)
        result[ticker] = etf_returns.get(etf) if etf else None
    return result


def compute_sector_rotation_scores(
    ohlcv: pd.DataFrame,
    lookback_fast: int = 20,
    lookback_slow: int = 65,
) -> dict[str, dict]:
    """Returns ETF ticker -> rotation score dict.

    Keys per ETF: fast_rs (4w), slow_rs (13w), in_rotation (bool).
    in_rotation = True when fast_rs > 0 and fast_rs > slow_rs.
    """
    close = get_close_matrix(ohlcv)
    spy_series = close.get("SPY", pd.Series(dtype=float)).dropna()

    def _ret(series: pd.Series, lb: int) -> float | None:
        s = series.dropna()
        if len(s) < lb + 1:
            return None
        prev = s.iloc[-(lb + 1)]
        if prev <= 0:
            return None
        return float(s.iloc[-1] / prev) - 1.0

    spy_fast = _ret(spy_series, lookback_fast) or 0.0
    spy_slow = _ret(spy_series, lookback_slow) or 0.0

    result: dict[str, dict] = {}
    for etf in SECTOR_ETFS:
        if etf not in close.columns:
            continue
        series = close[etf].dropna()
        fast = _ret(series, lookback_fast)
        slow = _ret(series, lookback_slow)
        fast_rs = (fast - spy_fast) if fast is not None else None
        slow_rs = (slow - spy_slow) if slow is not None else None
        in_rotation = bool(
            fast_rs is not None
            and fast_rs > 0
            and (slow_rs is None or fast_rs > slow_rs)
        )
        result[etf] = {
            "fast_rs": fast_rs,
            "slow_rs": slow_rs,
            "in_rotation": in_rotation,
        }

    return result
