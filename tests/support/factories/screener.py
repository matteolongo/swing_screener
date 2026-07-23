"""Deterministic input builders for screener API tests."""

from __future__ import annotations

from collections.abc import Mapping

import pandas as pd


def ohlcv_frame(
    prices: dict[str, list[float]],
    *,
    start: str = "2026-01-01",
    volume: float | dict[str, list[float]] = 1_000_000.0,
    high_offset: float = 1.0,
    low_offset: float = 1.0,
) -> pd.DataFrame:
    """Create a date-indexed ``(field, ticker)`` OHLCV frame."""
    if not prices:
        index = pd.date_range(start, periods=0, freq="D")
        frame = pd.DataFrame(index=index)
        frame.columns = pd.MultiIndex.from_tuples([], names=("field", "ticker"))
        return frame
    lengths = {len(values) for values in prices.values()}
    if len(lengths) != 1:
        raise ValueError("all price series must have the same length")
    periods = lengths.pop()
    index = pd.date_range(start, periods=periods, freq="D")
    data: dict[tuple[str, str], list[float]] = {}
    for ticker, values in prices.items():
        close = [float(value) for value in values]
        if isinstance(volume, Mapping):
            volumes = volume[ticker]
            if len(volumes) != periods:
                raise ValueError(f"volume series for {ticker} has the wrong length")
        else:
            volumes = [float(volume)] * periods
        data.update(
            {
                ("Open", ticker): close,
                ("High", ticker): [value + high_offset for value in close],
                ("Low", ticker): [value - low_offset for value in close],
                ("Close", ticker): close,
                ("Volume", ticker): [float(value) for value in volumes],
            }
        )
    frame = pd.DataFrame(data, index=index)
    frame.columns = pd.MultiIndex.from_tuples(frame.columns, names=("field", "ticker"))
    return frame


def report_row(**overrides: object) -> dict[str, object]:
    """Return common daily-report fields while allowing scenario overrides."""
    row: dict[str, object] = {
        "ticker": "AAPL",
        "signal": "breakout",
        "entry": 100.0,
        "stop": 95.0,
        "shares": 10,
        "score": 0.5,
        "confidence": 60.0,
        "last": 100.0,
        "atr14": 2.0,
        "currency": "USD",
    }
    row.update(overrides)
    return row


__all__ = ["ohlcv_frame", "report_row"]
