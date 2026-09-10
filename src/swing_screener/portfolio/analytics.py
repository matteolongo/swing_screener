"""Canonical, currency-neutral portfolio performance analytics.

This module intentionally deals in R multiples.  Cash P&L, fees, and FX are
accounting concerns exposed by the portfolio read model; they must not change a
trade's multiple of the original per-share risk.
"""

from __future__ import annotations

import json
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import date
from hashlib import sha256
from math import isfinite
from typing import Any


@dataclass(frozen=True)
class EquityCurvePoint:
    position_id: str
    ticker: str
    date: str
    r: float
    max_r: float | None
    holding_days: int | None
    cumulative_r: float
    tags: tuple[str, ...]
    entry_price: float
    exit_price: float
    shares: int
    initial_risk: float
    thesis: str | None
    notes: str
    lesson: str | None


@dataclass(frozen=True)
class TagAnalytics:
    tag: str
    trade_count: int
    win_count: int
    loss_count: int
    scratch_count: int
    win_rate: float | None
    average_r: float
    expectancy: float


@dataclass(frozen=True)
class JournalTagAnalytics:
    """Aggregate used when the journal filters canonical trade rows by tag."""

    tag: str
    trade_count: int
    win_count: int
    loss_count: int
    scratch_count: int
    average_r: float | None
    average_max_r: float | None


@dataclass(frozen=True)
class AnalyticsInsight:
    """Presentation-neutral backend verdict; clients localize the reason code."""

    verdict: str
    reason: str


@dataclass(frozen=True)
class PortfolioAnalytics:
    closed_trade_count: int
    excluded_trade_count: int
    win_count: int
    loss_count: int
    scratch_count: int
    win_rate: float | None
    win_rate_status: str
    average_r: float | None
    average_max_r: float | None
    profit_factor: float | None
    profit_factor_status: str
    average_holding_days: float | None
    max_win_streak: int
    max_loss_streak: int
    equity_curve: tuple[EquityCurvePoint, ...]
    tag_breakdown: tuple[TagAnalytics, ...]
    journal_tag_breakdown: tuple[JournalTagAnalytics, ...]
    insight: AnalyticsInsight


@dataclass(frozen=True)
class _ClosedTrade:
    position_id: str
    ticker: str
    exit_date: str
    r: float
    max_r: float | None
    holding_days: int | None
    tags: tuple[str, ...]
    entry_price: float
    exit_price: float
    shares: int
    initial_risk: float
    thesis: str | None
    notes: str
    lesson: str | None


def _finite_number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if isfinite(number) else None


def _configured_number(value: Any, fallback: float) -> float:
    number = _finite_number(value)
    return fallback if number is None else number


def _anonymous_trade_id(
    position: Mapping[str, Any], occurrences: dict[str, int]
) -> str:
    """Create a deterministic response-only identity for an ID-less trade."""
    encoded = json.dumps(position, sort_keys=True, default=str, separators=(",", ":"))
    base = f"analytics-{sha256(encoded.encode()).hexdigest()}"
    occurrence = occurrences.get(base, 0) + 1
    occurrences[base] = occurrence
    return base if occurrence == 1 else f"{base}-{occurrence}"


def _metric_status(value: float | None, threshold: float) -> str:
    return (
        "neutral" if value is None else "positive" if value >= threshold else "negative"
    )


def _holding_days(entry_date: Any, exit_date: Any) -> int | None:
    try:
        return max(
            (
                date.fromisoformat(str(exit_date)) - date.fromisoformat(str(entry_date))
            ).days,
            0,
        )
    except (TypeError, ValueError):
        return None


def _trade_r(position: Mapping[str, Any]) -> float | None:
    """Return the shares-weighted realised R for a completely closed position.

    Positions retain their remaining shares after a partial close.  The total
    original quantity is therefore the remaining shares plus recorded partial
    quantities.  Each leg is measured against the entry's immutable per-share
    initial risk; fees and FX are deliberately not folded into the R unit.
    """
    initial_risk = _finite_number(position.get("initial_risk"))
    entry = _finite_number(position.get("entry_price"))
    final_exit = _finite_number(position.get("exit_price"))
    final_shares = _finite_number(position.get("shares"))
    if (
        initial_risk is None
        or initial_risk <= 0
        or entry is None
        or final_exit is None
        or final_shares is None
        or final_shares <= 0
    ):
        return None

    legs: list[tuple[float, float]] = [
        (final_shares, (final_exit - entry) / initial_risk)
    ]
    for event in position.get("partial_closes") or []:
        if not isinstance(event, Mapping):
            continue
        shares = _finite_number(event.get("shares_closed"))
        price = _finite_number(event.get("price"))
        if shares is None or shares <= 0 or price is None:
            continue
        legs.append((shares, (price - entry) / initial_risk))

    total_shares = sum(shares for shares, _ in legs)
    return (
        sum(shares * leg_r for shares, leg_r in legs) / total_shares
        if total_shares
        else None
    )


def _max_r(position: Mapping[str, Any]) -> float | None:
    initial_risk = _finite_number(position.get("initial_risk"))
    entry = _finite_number(position.get("entry_price"))
    maximum = _finite_number(position.get("max_favorable_price"))
    if initial_risk is None or initial_risk <= 0 or entry is None or maximum is None:
        return None
    return (maximum - entry) / initial_risk


def _streaks(trades: Iterable[_ClosedTrade]) -> tuple[int, int]:
    max_wins = max_losses = wins = losses = 0
    for trade in trades:
        if trade.r > 0:
            wins += 1
            losses = 0
            max_wins = max(max_wins, wins)
        elif trade.r < 0:
            losses += 1
            wins = 0
            max_losses = max(max_losses, losses)
        else:
            # Scratches are neither a win nor a loss and deliberately break
            # both streak types, preventing a zero-R exit from being labelled
            # as a loss in one aggregate and a breakeven in another.
            wins = losses = 0
    return max_wins, max_losses


def _tag_breakdown(
    trades: list[_ClosedTrade], min_sample_size: int
) -> tuple[TagAnalytics, ...]:
    by_tag: dict[str, list[_ClosedTrade]] = {}
    for trade in trades:
        for tag in trade.tags:
            by_tag.setdefault(tag, []).append(trade)

    rows: list[TagAnalytics] = []
    for tag, tagged in by_tag.items():
        if len(tagged) < min_sample_size:
            continue
        r_values = [trade.r for trade in tagged]
        wins = sum(value > 0 for value in r_values)
        losses = sum(value < 0 for value in r_values)
        scratches = len(r_values) - wins - losses
        denominator = wins + losses
        rows.append(
            TagAnalytics(
                tag=tag,
                trade_count=len(tagged),
                win_count=wins,
                loss_count=losses,
                scratch_count=scratches,
                win_rate=(wins / denominator * 100) if denominator else None,
                average_r=sum(r_values) / len(r_values),
                expectancy=sum(r_values) / len(r_values),
            )
        )
    return tuple(sorted(rows, key=lambda row: (-row.expectancy, row.tag)))


def _journal_tag_breakdown(
    trades: list[_ClosedTrade],
) -> tuple[JournalTagAnalytics, ...]:
    by_tag: dict[str, list[_ClosedTrade]] = {}
    for trade in trades:
        for tag in trade.tags:
            by_tag.setdefault(tag, []).append(trade)

    rows: list[JournalTagAnalytics] = []
    for tag, tagged in by_tag.items():
        r_values = [trade.r for trade in tagged]
        max_r_values = [trade.max_r for trade in tagged if trade.max_r is not None]
        rows.append(
            JournalTagAnalytics(
                tag=tag,
                trade_count=len(tagged),
                win_count=sum(value > 0 for value in r_values),
                loss_count=sum(value < 0 for value in r_values),
                scratch_count=sum(value == 0 for value in r_values),
                average_r=(sum(r_values) / len(r_values)) if r_values else None,
                average_max_r=(sum(max_r_values) / len(max_r_values))
                if max_r_values
                else None,
            )
        )
    return tuple(sorted(rows, key=lambda row: row.tag))


def _insight(
    *,
    trade_count: int,
    average_r: float | None,
    profit_factor: float | None,
    win_rate: float | None,
    min_trade_count: int,
    min_profit_factor: float,
    low_win_rate_pct: float,
) -> AnalyticsInsight:
    if trade_count < min_trade_count:
        return AnalyticsInsight("developing", "insufficient_history")
    if (
        average_r is not None
        and average_r > 0
        and profit_factor is not None
        and profit_factor >= min_profit_factor
    ):
        return AnalyticsInsight("positive", "positive_edge")
    if average_r is not None and average_r > 0:
        return AnalyticsInsight("developing", "positive_average_r")
    if win_rate is not None and win_rate < low_win_rate_pct:
        return AnalyticsInsight("negative", "low_win_rate")
    return AnalyticsInsight("negative", "negative_average_r")


def calculate_portfolio_analytics(
    positions: Iterable[Mapping[str, Any]],
    *,
    min_tag_sample_size: int = 5,
    insight_min_trade_count: int = 5,
    insight_min_profit_factor: float = 1.0,
    insight_low_win_rate_pct: float = 40.0,
) -> PortfolioAnalytics:
    """Calculate closed-trade analytics from persisted or supplied snapshots.

    Only positions with a complete valid original-risk and final-exit record
    participate.  A scratch is exactly ``0R``: it is included in average R and
    the equity curve, excluded from win rate, and breaks either streak.
    """
    eligible: list[_ClosedTrade] = []
    excluded = 0
    anonymous_occurrences: dict[str, int] = {}
    for position in positions:
        if position.get("status") != "closed" or not position.get("exit_date"):
            continue
        r = _trade_r(position)
        if r is None:
            excluded += 1
            continue
        raw_tags = position.get("tags") or []
        tags = (
            tuple(sorted({str(tag) for tag in raw_tags if str(tag).strip()}))
            if isinstance(raw_tags, list)
            else ()
        )
        entry_price = _finite_number(position.get("entry_price"))
        exit_price = _finite_number(position.get("exit_price"))
        shares = _finite_number(position.get("shares"))
        initial_risk = _finite_number(position.get("initial_risk"))
        if (
            entry_price is None
            or exit_price is None
            or shares is None
            or initial_risk is None
        ):
            raise AssertionError(
                "eligible analytics trades must have validated display values"
            )
        eligible.append(
            _ClosedTrade(
                position_id=str(position["position_id"])
                if position.get("position_id")
                else _anonymous_trade_id(position, anonymous_occurrences),
                ticker=str(position.get("ticker") or "").upper(),
                exit_date=str(position["exit_date"]),
                r=r,
                max_r=_max_r(position),
                holding_days=_holding_days(
                    position.get("entry_date"), position.get("exit_date")
                ),
                tags=tags,
                entry_price=entry_price,
                exit_price=exit_price,
                shares=int(shares),
                initial_risk=initial_risk,
                thesis=str(position["thesis"]) if position.get("thesis") else None,
                notes=str(position.get("notes") or ""),
                lesson=str(position["lesson"]) if position.get("lesson") else None,
            )
        )

    trades = sorted(eligible, key=lambda trade: (trade.exit_date, trade.position_id))
    r_values = [trade.r for trade in trades]
    wins = sum(value > 0 for value in r_values)
    losses = sum(value < 0 for value in r_values)
    scratches = len(r_values) - wins - losses
    denominator = wins + losses
    gain = sum(value for value in r_values if value > 0)
    loss = sum(value for value in r_values if value < 0)
    holding_days = [
        trade.holding_days for trade in trades if trade.holding_days is not None
    ]
    max_wins, max_losses = _streaks(trades)

    cumulative_r = 0.0
    curve: list[EquityCurvePoint] = []
    for trade in trades:
        cumulative_r += trade.r
        curve.append(
            EquityCurvePoint(
                trade.position_id,
                trade.ticker,
                trade.exit_date,
                trade.r,
                trade.max_r,
                trade.holding_days,
                cumulative_r,
                trade.tags,
                trade.entry_price,
                trade.exit_price,
                trade.shares,
                trade.initial_risk,
                trade.thesis,
                trade.notes,
                trade.lesson,
            )
        )

    average_r = (sum(r_values) / len(r_values)) if r_values else None
    profit_factor = (gain / abs(loss)) if loss else None
    average_max_r_values = [trade.max_r for trade in trades if trade.max_r is not None]
    average_max_r = (
        sum(average_max_r_values) / len(average_max_r_values)
        if average_max_r_values
        else None
    )
    win_rate = (wins / denominator * 100) if denominator else None
    return PortfolioAnalytics(
        closed_trade_count=len(trades),
        excluded_trade_count=excluded,
        win_count=wins,
        loss_count=losses,
        scratch_count=scratches,
        win_rate=win_rate,
        win_rate_status=_metric_status(win_rate, 50),
        average_r=average_r,
        average_max_r=average_max_r,
        profit_factor=profit_factor,
        profit_factor_status=_metric_status(profit_factor, 1),
        average_holding_days=(sum(holding_days) / len(holding_days))
        if holding_days
        else None,
        max_win_streak=max_wins,
        max_loss_streak=max_losses,
        equity_curve=tuple(curve),
        tag_breakdown=_tag_breakdown(trades, max(int(min_tag_sample_size), 1)),
        journal_tag_breakdown=_journal_tag_breakdown(trades),
        insight=_insight(
            trade_count=len(trades),
            average_r=average_r,
            profit_factor=profit_factor,
            win_rate=win_rate,
            min_trade_count=max(int(insight_min_trade_count), 1),
            min_profit_factor=_configured_number(insight_min_profit_factor, 1.0),
            low_win_rate_pct=_configured_number(insight_low_win_rate_pct, 40.0),
        ),
    )
