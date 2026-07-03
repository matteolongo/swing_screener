from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from swing_screener.intelligence.weighting.config import EvidenceWeightsConfig
from swing_screener.intelligence.weighting.models import (
    BalanceLabel,
    Direction,
    EvidenceLedger,
    SignalCategory,
    WeightedSignal,
)

_SIGN = {"bullish": 1.0, "bearish": -1.0, "neutral": 0.0}


def _dir_from_num(value: float | int | None) -> Direction | None:
    if value is None:
        return None
    if value > 0:
        return "bullish"
    if value < 0:
        return "bearish"
    return "neutral"


def _sma_trend_dir(req) -> Direction | None:
    if req.close is None or None in (req.sma_20, req.sma_50, req.sma_200):
        return None
    if req.close > req.sma_20 > req.sma_50 > req.sma_200:
        return "bullish"
    if req.close < req.sma_20 < req.sma_50 < req.sma_200:
        return "bearish"
    return "neutral"


@dataclass(frozen=True)
class _ScalarSignal:
    """A request-derived signal with a deterministic direction. Adding a new
    numeric signal (e.g. from a future Finnhub/Alpha Vantage field) is one entry
    here — no edit to weigh()."""

    key: str
    label: str
    category: SignalCategory
    source: str
    direction: Callable[[object], Direction | None]


# Order defines ledger contribution order. `valuation` is handled separately in
# weigh() because its label is value-dependent.
_SCALAR_SIGNALS: tuple[_ScalarSignal, ...] = (
    _ScalarSignal(
        "insider_activity", "Insider activity (90d)", "positioning", "Finnhub insider 90d",
        lambda r: _dir_from_num(r.insider_net_shares_90d),
    ),
    _ScalarSignal(
        "analyst_actions", "Analyst upgrades/downgrades (30d)", "catalyst", "Finnhub analyst 30d",
        lambda r: _dir_from_num(r.analyst_upgrade_downgrade_net_30d),
    ),
    _ScalarSignal("sma_trend", "SMA trend", "technical", "OHLCV SMAs", _sma_trend_dir),
    _ScalarSignal(
        "momentum", "Momentum 6m", "technical", "OHLCV momentum",
        lambda r: _dir_from_num(r.momentum_6m),
    ),
    _ScalarSignal(
        "relative_strength", "Relative strength", "technical", "Benchmark RS",
        lambda r: _dir_from_num(r.rel_strength),
    ),
    _ScalarSignal(
        "52w_proximity", "Near 52-week high", "technical", "52w high proximity",
        lambda r: "bullish" if r.near_52w_high else None,
    ),
)


def _enum_value(value: object) -> str:
    return str(getattr(value, "value", value))


def _bucket(net: float, thresholds: dict[str, float]) -> BalanceLabel:
    if net >= thresholds["strongly_bullish"]:
        return "strongly_bullish"
    if net >= thresholds["bullish"]:
        return "bullish"
    if net <= thresholds["strongly_bearish"]:
        return "strongly_bearish"
    if net <= thresholds["bearish"]:
        return "bearish"
    return "mixed"


def weigh(draft, req, cfg: EvidenceWeightsConfig) -> EvidenceLedger:
    signals: list[WeightedSignal] = []

    def add(
        key: str,
        label: str,
        category: SignalCategory,
        direction: Direction | str | None,
        weight: float,
        source: str | None,
        event_date: str | None = None,
    ) -> None:
        if direction is None:
            return
        normalized = _enum_value(direction)
        if normalized not in _SIGN:
            return
        if weight == 0.0 and normalized == "neutral":
            return
        signals.append(
            WeightedSignal(
                key=key,
                label=label,
                category=category,
                direction=normalized,  # type: ignore[arg-type]
                weight=weight,
                contribution=weight * _SIGN[normalized],
                source=source or label,
                event_date=event_date,
            )
        )

    for spec in _SCALAR_SIGNALS:
        add(
            spec.key,
            spec.label,
            spec.category,
            spec.direction(req),
            cfg.signal_weight(spec.key),
            spec.source,
        )

    if req.valuation_label in {"cheap", "expensive"}:
        add(
            "valuation",
            f"Valuation: {req.valuation_label}",
            "fundamental",
            "bullish" if req.valuation_label == "cheap" else "bearish",
            cfg.signal_weight("valuation"),
            "Valuation label",
        )

    for catalyst in getattr(draft, "classified_catalysts", []) or []:
        catalyst_type = _enum_value(catalyst.type)
        direction = _enum_value(catalyst.direction)
        add(
            f"catalyst.{catalyst_type}",
            f"Catalyst: {catalyst_type}",
            "catalyst",
            direction,
            cfg.catalyst_weight(catalyst_type),
            catalyst.source_url or catalyst.summary,
            getattr(catalyst, "date", None),
        )

    for item in getattr(draft, "news", []) or []:
        sentiment = _enum_value(item.sentiment)
        add(
            "news",
            item.headline,
            "news",
            sentiment,
            cfg.signal_weight("news"),
            item.url or item.headline,
            getattr(item, "date", None),
        )

    for event in getattr(draft, "upcoming_events", []) or []:
        event_type = _enum_value(event.type)
        direction = _enum_value(event.direction)
        add(
            f"upcoming.{event_type}",
            f"Upcoming: {event_type}",
            "catalyst",
            direction,
            cfg.upcoming_weight(event_type),
            event.summary,
            getattr(event, "date", None),
        )

    bull = sum(signal.contribution for signal in signals if signal.contribution > 0)
    bear = -sum(signal.contribution for signal in signals if signal.contribution < 0)
    net = bull - bear
    return EvidenceLedger(
        contributions=signals,
        bull_weight=bull,
        bear_weight=bear,
        net=net,
        balance_label=_bucket(net, cfg.balance_thresholds),
    )
