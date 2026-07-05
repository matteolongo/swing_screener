from __future__ import annotations

from datetime import UTC, datetime

from swing_screener.intelligence.strategic.models import (
    StrategicAction,
    StrategicIntelligenceReport,
    StrategicIntelligenceRequest,
    StrategicPrediction,
    StrategicSituation,
)


_MECHANISMS_BY_TAG = {
    "ai_capex": "AI capex changes order visibility, revenue expectations, and valuation tolerance across exposed names.",
    "semiconductors": "Semiconductor signals transmit through equipment demand, inventory cycles, and sector risk appetite.",
    "regulation": "Regulatory pressure can cap multiples, delay demand, or shift investor preference toward less exposed peers.",
    "earnings": "Earnings revisions can reprice both the direct ticker and close peers with similar factor exposure.",
}


class StrategicIntelligenceAgent:
    """Deterministic strategic overlay built only from supplied app context."""

    def analyze(self, request: StrategicIntelligenceRequest) -> StrategicIntelligenceReport:
        symbols = _affected_symbols(request)
        situation = StrategicSituation(
            title=_situation_title(request),
            stage=_stage(request),
            why_now=_why_now(request),
            mechanisms=_mechanisms(request),
            affected_symbols=symbols,
            predictions=[_prediction(request)],
            actions=_actions(request, symbols),
        )
        return StrategicIntelligenceReport(
            generated_at=datetime.now(UTC).isoformat(),
            external_source_count=0,
            situations=[situation],
            memo=_memo(request, situation),
        )


def _affected_symbols(request: StrategicIntelligenceRequest) -> list[str]:
    symbols: set[str] = set()
    for signal in request.signals:
        symbols.update(signal.symbols)
    for item in [*request.candidates, *request.watchlist]:
        symbols.add(item.symbol)
    for position in request.positions:
        symbols.add(position.symbol)
    return sorted(symbols)


def _situation_title(request: StrategicIntelligenceRequest) -> str:
    if request.topic:
        return request.topic
    sectors = {item.sector for item in [*request.candidates, *request.watchlist] if item.sector}
    sectors.update(position.sector for position in request.positions if position.sector)
    if sectors:
        return f"{sorted(sectors)[0]} strategic overlay"
    if request.signals:
        return request.signals[0].title
    return "Strategic overlay"


def _stage(request: StrategicIntelligenceRequest) -> str:
    if len(request.signals) >= 2:
        return "active"
    if request.signals or request.positions:
        return "emerging"
    return "watching"


def _why_now(request: StrategicIntelligenceRequest) -> list[str]:
    reasons: list[str] = []
    if request.topic:
        reasons.append(f"Topic in focus: {request.topic}.")
    for signal in request.signals[:3]:
        reasons.append(f"{signal.title}: {signal.summary}")
    if not reasons:
        context_count = len(request.candidates) + len(request.watchlist) + len(request.positions)
        reasons.append(f"Derived from app context across {context_count} tracked symbol(s).")
    return reasons


def _mechanisms(request: StrategicIntelligenceRequest) -> list[str]:
    tags = {tag.lower() for signal in request.signals for tag in signal.tags}
    mechanisms = [_MECHANISMS_BY_TAG[tag] for tag in sorted(tags) if tag in _MECHANISMS_BY_TAG]
    if mechanisms:
        return mechanisms
    return ["The overlay links screener, watchlist, and position context without adding external claims."]


def _prediction(request: StrategicIntelligenceRequest) -> StrategicPrediction:
    tags = {tag.lower() for signal in request.signals for tag in signal.tags}
    if "regulation" in tags:
        direction = "mixed"
        thesis = "Demand tailwinds may continue, but policy risk can interrupt follow-through."
    elif request.signals:
        direction = "bullish"
        thesis = "Clustered catalysts can amplify follow-through if price confirms."
    else:
        direction = "neutral"
        thesis = "No external catalyst cluster is present; treat the overlay as context, not a new signal."
    confidence = "high" if len(request.signals) >= 3 else "medium" if request.signals else "low"
    return StrategicPrediction(
        direction=direction,
        horizon_days=request.market_context.horizon_days,
        thesis=thesis,
        confidence=confidence,
        invalidation="Invalidate the overlay if the cited app-context signals stop appearing in new analysis or price action fails to confirm.",
    )


def _actions(request: StrategicIntelligenceRequest, symbols: list[str]) -> list[StrategicAction]:
    actions: list[StrategicAction] = []
    if not request.signals or request.market_context.risk_mode == "defensive":
        actions.append(
            StrategicAction(
                action_type="WAIT_FOR_CONFIRMATION",
                title="Wait for confirmation",
                rationale="Do not promote a strategic overlay into execution without fresh symbol-level confirmation.",
                symbols=symbols,
            )
        )
    actions.append(
        StrategicAction(
            action_type="REVIEW_CONTEXT",
            title="Review exposed symbols",
            rationale="Use the overlay to reinterpret existing candidates, watchlist names, and positions.",
            symbols=symbols,
        )
    )
    if request.positions:
        actions.append(
            StrategicAction(
                action_type="TIGHTEN_RISK_REVIEW",
                title="Review open-position risk",
                rationale="For held names, check whether the situation changes stop discipline, sizing comfort, or thesis status.",
                symbols=[position.symbol for position in request.positions],
            )
        )
    if request.market_context.risk_mode == "defensive" and request.positions:
        actions.append(
            StrategicAction(
                action_type="REDUCE_EXPOSURE_REVIEW",
                title="Review exposure reduction",
                rationale="In defensive mode, consider whether correlated exposure should be reduced through the existing portfolio process.",
                symbols=[position.symbol for position in request.positions],
            )
        )
    return actions


def _memo(request: StrategicIntelligenceRequest, situation: StrategicSituation) -> str:
    symbol_text = ", ".join(situation.affected_symbols) if situation.affected_symbols else "no symbols"
    return (
        f"Strategic overlay built from app context only for {symbol_text}. "
        f"Situation: {situation.title}. "
        "Use it to review existing analysis, not to execute trades directly."
    )
