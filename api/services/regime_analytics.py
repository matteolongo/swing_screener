"""Regime-conditional performance analytics service."""
from __future__ import annotations

import datetime as dt
import logging
from typing import Optional

import pandas as pd

from api.repositories.positions_repo import PositionsRepository

logger = logging.getLogger(__name__)

REGIME_TRENDING_UP = "trending_up"
REGIME_TRENDING_DOWN = "trending_down"
REGIME_CHOPPY = "choppy"

_ORDERED_REGIMES = [REGIME_TRENDING_UP, REGIME_TRENDING_DOWN, REGIME_CHOPPY]


def label_regime_at_date(
    close: pd.Series,
    target_date: str,
    sma_fast: int = 50,
    sma_slow: int = 200,
) -> str:
    """
    Classify market regime at target_date using two-SMA logic.

    Rules:
      trending_up   — close > SMA_fast AND SMA_fast > SMA_slow
      trending_down — close < SMA_fast AND SMA_fast < SMA_slow
      choppy        — all other cases (mixed or insufficient history for SMA_slow)

    When only SMA_fast history is available:
      trending_up   — close > SMA_fast
      trending_down — close <= SMA_fast

    Args:
        close: pd.Series with DatetimeIndex, one row per trading day
        target_date: ISO date string "YYYY-MM-DD"
        sma_fast: fast SMA window (default 50)
        sma_slow: slow SMA window (default 200)

    Returns:
        One of REGIME_TRENDING_UP, REGIME_TRENDING_DOWN, REGIME_CHOPPY
    """
    if close is None or close.empty:
        return REGIME_CHOPPY

    # Ensure DatetimeIndex
    if not isinstance(close.index, pd.DatetimeIndex):
        close = close.copy()
        close.index = pd.to_datetime(close.index)

    target = pd.Timestamp(target_date)
    available = close[close.index <= target]
    if available.empty:
        return REGIME_CHOPPY

    last_close = float(available.iloc[-1])

    sma_f_series = available.rolling(window=sma_fast, min_periods=sma_fast).mean()
    last_sma_f = sma_f_series.iloc[-1]

    if pd.isna(last_sma_f):
        return REGIME_CHOPPY

    sma_s_series = available.rolling(window=sma_slow, min_periods=sma_slow).mean()
    last_sma_s = sma_s_series.iloc[-1]

    if pd.isna(last_sma_s):
        # Not enough for slow SMA — fall back to fast SMA only
        return REGIME_TRENDING_UP if last_close > float(last_sma_f) else REGIME_TRENDING_DOWN

    fast = float(last_sma_f)
    slow = float(last_sma_s)

    above_fast = last_close > fast
    fast_above_slow = fast > slow

    if above_fast and fast_above_slow:
        return REGIME_TRENDING_UP
    elif not above_fast and not fast_above_slow:
        return REGIME_TRENDING_DOWN
    else:
        return REGIME_CHOPPY


def _r_at_close(pos: dict) -> Optional[float]:
    """R at close: (exit_price - entry_price) * shares / initial_risk."""
    initial_risk = pos.get("initial_risk")
    exit_price = pos.get("exit_price")
    entry_price = pos.get("entry_price")
    shares = pos.get("shares", 1) or 1
    if not initial_risk or initial_risk <= 0 or exit_price is None or entry_price is None:
        return None
    return (exit_price - entry_price) * shares / initial_risk


class RegimeAnalyticsService:
    def __init__(self, positions_repo: PositionsRepository):
        self._repo = positions_repo

    def get_regime_breakdown(
        self,
        benchmark: str = "SPY",
        sma_fast: int = 50,
        sma_slow: int = 200,
    ) -> dict:
        """
        Fetch closed positions, label each by regime at entry date, aggregate stats.

        Returns dict matching RegimeBreakdownResponse schema.
        """
        import yfinance as yf

        positions = self._repo.list()
        closed = [
            p for p in positions
            if p.get("status") == "closed"
            and p.get("entry_date")
            and p.get("entry_price") is not None
            and p.get("exit_price") is not None
            and p.get("initial_risk") is not None
            and (p.get("initial_risk") or 0) > 0
        ]

        if not closed:
            return {"regimes": [], "benchmark": benchmark}

        entry_dates = [dt.date.fromisoformat(p["entry_date"]) for p in closed]
        earliest = min(entry_dates)
        latest = max(entry_dates)
        fetch_start = (earliest - dt.timedelta(days=int(sma_slow * 2))).isoformat()
        fetch_end = (latest + dt.timedelta(days=1)).isoformat()

        try:
            raw = yf.download(
                benchmark,
                start=fetch_start,
                end=fetch_end,
                progress=False,
                auto_adjust=True,
            )
            if raw is None or raw.empty:
                logger.warning("No benchmark data returned for %s", benchmark)
                return {"regimes": [], "benchmark": benchmark}

            close_col = raw.get("Close", raw.iloc[:, 0])
            if isinstance(close_col, pd.DataFrame):
                close_col = close_col.iloc[:, 0]
            close_series: pd.Series = close_col.dropna()
        except Exception as exc:
            logger.warning("Failed to fetch benchmark %s: %s", benchmark, exc)
            return {"regimes": [], "benchmark": benchmark}

        regime_r: dict[str, list[float]] = {
            REGIME_TRENDING_UP: [],
            REGIME_TRENDING_DOWN: [],
            REGIME_CHOPPY: [],
        }

        for pos in closed:
            r = _r_at_close(pos)
            if r is None:
                continue
            regime = label_regime_at_date(close_series, pos["entry_date"], sma_fast, sma_slow)
            regime_r[regime].append(r)

        result_regimes = []
        for regime in _ORDERED_REGIMES:
            r_values = regime_r[regime]
            if not r_values:
                continue
            wins = [r for r in r_values if r > 0]
            losses = [r for r in r_values if r <= 0]
            win_rate = (len(wins) / len(r_values)) * 100
            avg_win_r = sum(wins) / len(wins) if wins else 0.0
            avg_loss_r = abs(sum(losses) / len(losses)) if losses else 0.0
            avg_r = sum(r_values) / len(r_values)
            expectancy = avg_win_r * (win_rate / 100) - avg_loss_r * (1 - win_rate / 100)
            result_regimes.append({
                "regime": regime,
                "count": len(r_values),
                "win_rate": round(win_rate, 2),
                "avg_r": round(avg_r, 4),
                "expectancy": round(expectancy, 4),
            })

        return {"regimes": result_regimes, "benchmark": benchmark}
