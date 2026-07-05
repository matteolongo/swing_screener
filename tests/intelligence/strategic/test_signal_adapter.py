from __future__ import annotations

from swing_screener.intelligence.models import (
    ClassifiedCatalyst,
    IntelligenceEventDirection,
    NewsItem,
    SymbolIntelligence,
)
from swing_screener.intelligence.strategic.signal_adapter import (
    signals_from_symbol_intelligence,
    watched_context_from_symbol_intelligence,
)


def _intel() -> SymbolIntelligence:
    return SymbolIntelligence(
        symbol="ASML",
        generated_at="2026-07-03T10:00:00Z",
        action="WATCH",
        conviction="medium",
        catalyst_urgency="high",
        summary_line="Equipment demand rising, but export policy risk remains.",
        narrative="Text.",
        inputs_used={"technical": {"sector": "Technology", "signal": "base breakout"}},
        classified_catalysts=[
            ClassifiedCatalyst(
                type="sector_news",
                direction=IntelligenceEventDirection.bullish,
                summary="AI capex supports semiconductor equipment demand.",
                source_url="https://example.com/asml",
                date="2026-07-03",
            )
        ],
        news=[
            NewsItem(
                headline="ASML suppliers watch export restrictions",
                url="https://example.com/news",
                date="2026-07-02",
                sentiment="bearish",
            )
        ],
    )


def test_watched_context_preserves_symbol_intelligence_decision_fields():
    context = watched_context_from_symbol_intelligence(_intel())

    assert context.symbol == "ASML"
    assert context.source_bucket == "cached_intelligence"
    assert context.sector == "Technology"
    assert context.signal == "base breakout"
    assert context.action == "WATCH"
    assert context.conviction == "medium"
    assert context.catalyst_urgency == "high"


def test_signals_from_symbol_intelligence_prefers_classified_catalysts():
    signals = signals_from_symbol_intelligence(_intel())

    assert len(signals) == 1
    assert signals[0].title == "sector_news catalyst for ASML"
    assert signals[0].summary == "AI capex supports semiconductor equipment demand."
    assert signals[0].symbols == ["ASML"]
    assert signals[0].tags == ["sector_news", "bullish"]
    assert signals[0].url == "https://example.com/asml"


def test_signals_from_symbol_intelligence_falls_back_to_news():
    intel = _intel().model_copy(update={"classified_catalysts": []})

    signals = signals_from_symbol_intelligence(intel)

    assert len(signals) == 1
    assert signals[0].title == "ASML suppliers watch export restrictions"
    assert signals[0].tags == ["news", "bearish"]
