"""Pure OHLCV / price-history shaping helpers."""
from __future__ import annotations

import datetime as dt
import math
from typing import Optional

import pandas as pd

# Maximum bars returned per ticker by price_history_map when no override is given.
PRICE_HISTORY_MAX_BARS = 252


def _to_iso(ts) -> Optional[str]:
    """Shared timestamp → full ISO string (mirrors api.utils.converters.to_iso)."""
    if ts is None or pd.isna(ts):
        return None
    if isinstance(ts, pd.Timestamp):
        ts = ts.to_pydatetime()
    if isinstance(ts, dt.datetime):
        return ts.isoformat()
    if isinstance(ts, dt.date):
        return dt.datetime.combine(ts, dt.time()).isoformat()
    return str(ts)


def merge_ohlcv(base: pd.DataFrame, extra: pd.DataFrame) -> pd.DataFrame:
    if base is None or base.empty:
        return extra
    if extra is None or extra.empty:
        return base
    merged = pd.concat([base, extra], axis=1)
    merged = merged.loc[:, ~merged.columns.duplicated()]
    return merged.sort_index(axis=1)


def to_date_iso(ts) -> Optional[str]:
    if ts is None or pd.isna(ts):
        return None
    if isinstance(ts, pd.Timestamp):
        return ts.date().isoformat()
    if isinstance(ts, dt.datetime):
        return ts.date().isoformat()
    if isinstance(ts, dt.date):
        return ts.isoformat()
    return str(ts)


def last_bar_map(ohlcv: pd.DataFrame) -> dict[str, str]:
    out: dict[str, str] = {}
    if ohlcv is None or ohlcv.empty:
        return out
    if "Close" not in ohlcv.columns.get_level_values(0):
        return out
    close = ohlcv["Close"]
    for t in close.columns:
        series = close[t].dropna()
        if series.empty:
            continue
        ts = series.index[-1]
        iso = _to_iso(ts)
        if iso:
            out[str(t)] = iso
    return out


def price_history_map(
    ohlcv: pd.DataFrame,
    tickers: list[str] | None = None,
    max_bars: int = PRICE_HISTORY_MAX_BARS,
) -> dict[str, list[dict]]:
    """Build price history map for specified tickers only.

    Args:
        ohlcv: OHLCV DataFrame with MultiIndex columns
        tickers: List of tickers to process. If None, processes all tickers.
        max_bars: Maximum number of bars to include per ticker

    Returns:
        Dict mapping ticker to list of {date, close} points. Each point also
        carries open/high/low/volume when those fields exist in *ohlcv*
        (optional, for candlestick rendering); absent fields are omitted.
    """
    out: dict[str, list[dict]] = {}
    if ohlcv is None or ohlcv.empty:
        return out
    levels = ohlcv.columns.get_level_values(0)
    if "Close" not in levels:
        return out

    def _sub(field: str):
        return ohlcv[field] if field in levels else None

    close = ohlcv["Close"]
    open_ = _sub("Open")
    high = _sub("High")
    low = _sub("Low")
    vol = _sub("Volume")
    columns_to_process = close.columns if tickers is None else [t for t in tickers if t in close.columns]

    for ticker in columns_to_process:
        series = close[ticker].dropna()
        if series.empty:
            continue
        if max_bars > 0 and len(series) > max_bars:
            series = series.iloc[-max_bars:]
        points = []
        for ts, px in series.items():
            date = to_date_iso(ts)
            if date is None:
                continue
            point = {"date": date, "close": float(px)}
            for key, frame in (("open", open_), ("high", high), ("low", low), ("volume", vol)):
                if frame is not None and ticker in frame.columns:
                    val = frame[ticker].get(ts)
                    if val is not None and pd.notna(val):
                        point[key] = float(val)
            points.append(point)
        if points:
            out[str(ticker)] = points
    return out


def price_history_change_pct(history: list[dict]) -> Optional[float]:
    if len(history) < 2:
        return None
    try:
        start = float(history[0]["close"])
        end = float(history[-1]["close"])
    except (KeyError, TypeError, ValueError):
        return None
    if not math.isfinite(start) or not math.isfinite(end) or start <= 0:
        return None
    return ((end - start) / start) * 100.0


def aligned_benchmark_price_history(
    candidate_history: list[dict],
    benchmark_history: list[dict],
) -> list[dict]:
    """Return benchmark closes aligned to the candidate timeline and normalized to the symbol's start price."""
    if len(candidate_history) < 2 or len(benchmark_history) < 1:
        return []

    candidate_dates: list[pd.Timestamp] = []
    candidate_closes: list[float] = []
    for point in candidate_history:
        try:
            ts = pd.Timestamp(str(point["date"]))
            close = float(point["close"])
        except (KeyError, TypeError, ValueError):
            continue
        if pd.isna(ts) or not math.isfinite(close) or close <= 0:
            continue
        candidate_dates.append(ts)
        candidate_closes.append(close)

    benchmark_points: list[tuple[pd.Timestamp, float]] = []
    for point in benchmark_history:
        try:
            ts = pd.Timestamp(str(point["date"]))
            close = float(point["close"])
        except (KeyError, TypeError, ValueError):
            continue
        if pd.isna(ts) or not math.isfinite(close) or close <= 0:
            continue
        benchmark_points.append((ts, close))

    if len(candidate_dates) < 2 or not benchmark_points:
        return []

    benchmark_series = pd.Series(
        {ts: close for ts, close in benchmark_points},
        dtype=float,
    ).sort_index()
    aligned = benchmark_series.reindex(pd.DatetimeIndex(candidate_dates)).ffill().bfill()
    if aligned.isna().any():
        return []

    symbol_start = candidate_closes[0]
    benchmark_start = float(aligned.iloc[0])
    if symbol_start <= 0 or benchmark_start <= 0:
        return []

    scale = symbol_start / benchmark_start
    return [
        {
            "date": to_date_iso(ts) or str(ts),
            "close": float(close * scale),
        }
        for ts, close in zip(candidate_dates, aligned.tolist())
    ]
