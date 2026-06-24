"""Shared helpers for provider canary probes."""
from __future__ import annotations

import time
from datetime import date, timedelta

import pandas as pd

from swing_screener.data.source_health import ProbeResult


def ohlcv_canary_probe(provider, canary: str, source_id: str) -> ProbeResult:
    """Fetch a short recent OHLCV window for `canary` and grade reachability."""
    end = date.today().isoformat()
    start = (date.today() - timedelta(days=10)).isoformat()
    started = time.perf_counter()
    try:
        df = provider.fetch_ohlcv([canary], start_date=start, end_date=end)
    except Exception as exc:  # network / parsing failure
        elapsed = (time.perf_counter() - started) * 1000.0
        return ProbeResult(id=source_id, status="down", latency_ms=round(elapsed, 1), error=str(exc))

    elapsed = (time.perf_counter() - started) * 1000.0
    if df is None or df.empty or ("Close", canary) not in df.columns:
        return ProbeResult(
            id=source_id, status="down", latency_ms=round(elapsed, 1),
            detail="empty response",
        )
    closes = df[("Close", canary)].dropna()
    if closes.empty:
        return ProbeResult(
            id=source_id, status="down", latency_ms=round(elapsed, 1),
            detail="no close data",
        )
    last_close = float(closes.iloc[-1])
    last_date = str(closes.index[-1].date()) if isinstance(closes.index, pd.DatetimeIndex) else str(closes.index[-1])
    return ProbeResult(
        id=source_id,
        status="ok",
        latency_ms=round(elapsed, 1),
        detail=f"{len(closes)} bars",
        sample={"last_close": last_close, "last_date": last_date},
    )
