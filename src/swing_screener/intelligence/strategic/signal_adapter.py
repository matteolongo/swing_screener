from __future__ import annotations

from swing_screener.intelligence.models import SymbolIntelligence
from swing_screener.intelligence.strategic.models import StrategicSignal, WatchedSymbolContext


def watched_context_from_symbol_intelligence(intel: SymbolIntelligence) -> WatchedSymbolContext:
    technical = intel.inputs_used.get("technical", {}) if isinstance(intel.inputs_used, dict) else {}
    return WatchedSymbolContext(
        symbol=intel.symbol,
        source_bucket="cached_intelligence",
        sector=_string_or_none(technical.get("sector")),
        signal=_string_or_none(technical.get("signal")),
        action=str(intel.action),
        conviction=str(intel.conviction),
        catalyst_urgency=intel.catalyst_urgency,
    )


def signals_from_symbol_intelligence(intel: SymbolIntelligence) -> list[StrategicSignal]:
    if intel.classified_catalysts:
        return [
            StrategicSignal(
                title=f"{catalyst.type.value} catalyst for {intel.symbol}",
                summary=catalyst.summary,
                source="symbol_intelligence.classified_catalysts",
                timestamp=catalyst.date,
                url=catalyst.source_url,
                symbols=[intel.symbol],
                tags=[catalyst.type.value, catalyst.direction.value],
                confidence=_confidence_from_urgency(intel.catalyst_urgency),
            )
            for catalyst in intel.classified_catalysts
        ]
    if intel.news:
        return [
            StrategicSignal(
                title=item.headline,
                summary=item.headline,
                source="symbol_intelligence.news",
                timestamp=item.date,
                url=item.url,
                symbols=[intel.symbol],
                tags=["news", item.sentiment],
                confidence=0.55,
            )
            for item in intel.news
        ]
    if intel.catalyst_urgency != "none":
        return [
            StrategicSignal(
                title=f"{intel.symbol} symbol intelligence catalyst",
                summary=intel.summary_line,
                source="symbol_intelligence.summary",
                timestamp=intel.generated_at,
                symbols=[intel.symbol],
                tags=["symbol_intelligence", intel.catalyst_urgency],
                confidence=_confidence_from_urgency(intel.catalyst_urgency),
            )
        ]
    return []


def _confidence_from_urgency(urgency: str) -> float:
    if urgency == "high":
        return 0.8
    if urgency == "medium":
        return 0.65
    if urgency == "low":
        return 0.5
    return 0.4


def _string_or_none(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
