from __future__ import annotations

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

    add(
        "insider_activity",
        "Insider activity (90d)",
        "positioning",
        _dir_from_num(req.insider_net_shares_90d),
        cfg.signal_weight("insider_activity"),
        "Finnhub insider 90d",
    )
    add(
        "analyst_actions",
        "Analyst upgrades/downgrades (30d)",
        "catalyst",
        _dir_from_num(req.analyst_upgrade_downgrade_net_30d),
        cfg.signal_weight("analyst_actions"),
        "Finnhub analyst 30d",
    )

    sma_dir: Direction | None = None
    if req.close is not None and None not in (req.sma_20, req.sma_50, req.sma_200):
        above = req.close > req.sma_20 > req.sma_50 > req.sma_200
        below = req.close < req.sma_20 < req.sma_50 < req.sma_200
        sma_dir = "bullish" if above else ("bearish" if below else "neutral")
    add("sma_trend", "SMA trend", "technical", sma_dir, cfg.signal_weight("sma_trend"), "OHLCV SMAs")
    add(
        "momentum",
        "Momentum 6m",
        "technical",
        _dir_from_num(req.momentum_6m),
        cfg.signal_weight("momentum"),
        "OHLCV momentum",
    )
    add(
        "relative_strength",
        "Relative strength",
        "technical",
        _dir_from_num(req.rel_strength),
        cfg.signal_weight("relative_strength"),
        "Benchmark RS",
    )
    if req.near_52w_high:
        add(
            "52w_proximity",
            "Near 52-week high",
            "technical",
            "bullish",
            cfg.signal_weight("52w_proximity"),
            "52w high proximity",
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
