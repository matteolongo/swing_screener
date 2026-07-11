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


def _direction_word(direction: Direction | str) -> str:
    return {
        "bullish": "supports the long setup",
        "bearish": "argues against the setup",
        "neutral": "is neutral for the setup",
    }.get(str(direction), "is included in the evidence balance")


def _scalar_explanation(key: str, direction: Direction) -> str:
    if key == "insider_activity":
        if direction == "bullish":
            return "Recent insider activity is net positive, which suggests insiders have been adding exposure."
        if direction == "bearish":
            return "Recent insider activity is net negative, which adds caution because insiders have been reducing exposure."
        return "Recent insider activity is balanced, so it does not move the evidence balance either way."
    if key == "analyst_actions":
        if direction == "bullish":
            return "Recent analyst revisions lean positive, adding external confirmation to the setup."
        if direction == "bearish":
            return "Recent analyst revisions lean negative, reducing confidence in the setup."
        return "Recent analyst revisions are balanced, so they do not change the evidence balance."
    if key == "sma_trend":
        if direction == "bullish":
            return "Price is aligned above the key moving averages, so trend structure supports the setup."
        if direction == "bearish":
            return "Price is aligned below the key moving averages, so trend structure works against the setup."
        return "The moving averages are mixed, so trend structure is not giving a clean signal."
    if key == "momentum":
        if direction == "bullish":
            return "Six-month momentum is positive, supporting continued relative demand."
        if direction == "bearish":
            return "Six-month momentum is negative, which weakens the setup."
        return "Six-month momentum is flat, so it contributes no directional edge."
    if key == "relative_strength":
        if direction == "bullish":
            return "The symbol is outperforming its benchmark, which supports a long setup."
        if direction == "bearish":
            return "The symbol is lagging its benchmark, which weakens the long setup."
        return "Relative strength is neutral, so it does not change the evidence balance."
    if key == "52w_proximity":
        return "Trading near a 52-week high shows leadership and demand, which supports momentum continuation."
    return f"This signal {_direction_word(direction)}."


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
        explanation: str | None = None,
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
                explanation=explanation,
            )
        )

    for spec in _SCALAR_SIGNALS:
        direction = spec.direction(req)
        add(
            spec.key,
            spec.label,
            spec.category,
            direction,
            cfg.signal_weight(spec.key),
            spec.source,
            explanation=_scalar_explanation(spec.key, direction) if direction else None,
        )

    if req.valuation_label in {"cheap", "expensive"}:
        valuation_direction = "bullish" if req.valuation_label == "cheap" else "bearish"
        add(
            "valuation",
            f"Valuation: {req.valuation_label}",
            "fundamental",
            valuation_direction,
            cfg.signal_weight("valuation"),
            "Valuation label",
            explanation=(
                "Valuation looks supportive relative to the current setup."
                if valuation_direction == "bullish"
                else "Valuation looks expensive, so price needs stronger confirmation to justify the risk."
            ),
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
            explanation=(
                f"This cited catalyst {_direction_word(direction)}: {catalyst.summary}"
            ),
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
            explanation=f"This cited news item {_direction_word(sentiment)}: {item.headline}",
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
            explanation=f"This upcoming event {_direction_word(direction)}: {event.summary}",
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
