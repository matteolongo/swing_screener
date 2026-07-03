from __future__ import annotations

from swing_screener.intelligence.models import (
    CatalystType,
    ClassifiedCatalyst,
    SymbolIntelligence,
)


def test_classified_catalyst_roundtrip():
    catalyst = ClassifiedCatalyst(
        type=CatalystType.analyst_upgrade,
        direction="bullish",
        summary="GS to Buy",
        source_url="http://x",
        date="2026-07-01",
    )

    assert ClassifiedCatalyst.model_validate(catalyst.model_dump()) == catalyst


def test_symbol_intelligence_defaults_empty_catalysts():
    intelligence = SymbolIntelligence(
        symbol="AAPL",
        generated_at="2026-07-03T00:00:00+00:00",
        action="WATCH",
        conviction="low",
        summary_line="x",
        narrative="y",
    )

    assert intelligence.classified_catalysts == []
