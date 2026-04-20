"""Annotates screener candidates with closed-position history for the same ticker."""
from __future__ import annotations

import math
from typing import Optional

from api.models.screener import PriorTradeContext, ScreenerCandidate


def _safe_float(value: object) -> Optional[float]:
    if value is None:
        return None
    try:
        v = float(value)
        return v if math.isfinite(v) else None
    except (TypeError, ValueError):
        return None


def _compute_r_outcome(
    entry_price: float,
    exit_price: float,
    stop_price: float,
) -> float:
    """Return R multiple at exit. Negative = loss."""
    risk_per_share = entry_price - stop_price
    if risk_per_share <= 0:
        return 0.0
    gain_per_share = exit_price - entry_price
    return round(gain_per_share / risk_per_share, 4)


class PriorTradeAnnotator:
    """Attaches PriorTradeContext to candidates that have prior closed positions."""

    def annotate(
        self,
        candidates: list[ScreenerCandidate],
        *,
        closed_positions: list[object],
    ) -> list[ScreenerCandidate]:
        # Group closed positions by ticker (uppercase)
        by_ticker: dict[str, list[object]] = {}
        for pos in closed_positions:
            ticker = getattr(pos, "ticker", "").upper()
            by_ticker.setdefault(ticker, []).append(pos)

        for candidate in candidates:
            ticker = candidate.ticker.upper()
            history = by_ticker.get(ticker)
            if not history:
                continue

            # Sort by exit_date descending, most recent first
            sorted_history = sorted(
                history,
                key=lambda p: getattr(p, "exit_date", "") or "",
                reverse=True,
            )
            most_recent = sorted_history[0]

            entry_price = _safe_float(getattr(most_recent, "entry_price", None)) or 0.0
            exit_price = _safe_float(getattr(most_recent, "exit_price", None)) or 0.0
            stop_price = _safe_float(getattr(most_recent, "stop_price", None)) or 0.0

            r_outcome = _compute_r_outcome(entry_price, exit_price, stop_price)

            candidate.prior_trades = PriorTradeContext(
                last_exit_date=getattr(most_recent, "exit_date", "") or "",
                last_exit_price=exit_price,
                last_entry_price=entry_price,
                last_r_outcome=r_outcome,
                was_profitable=exit_price > entry_price,
                trade_count=len(history),
            )

        return candidates
