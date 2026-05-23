import pytest
from pydantic import ValidationError
from swing_screener.intelligence.models import SymbolIntelligence, SymbolIntelligenceRequest


def test_symbol_intelligence_request_defaults():
    req = SymbolIntelligenceRequest(close=48.5, signal="breakout")
    assert req.currency == "USD"
    assert req.entry is None
    assert req.sector is None


def test_symbol_intelligence_request_full():
    req = SymbolIntelligenceRequest(
        close=48.5,
        signal="breakout",
        entry=49.0,
        stop=44.0,
        sma_20=45.0,
        sma_50=40.0,
        sma_200=35.0,
        momentum_6m=32.5,
        momentum_12m=78.0,
        sector="Materials",
        currency="EUR",
    )
    assert req.close == 48.5
    assert req.currency == "EUR"


def test_symbol_intelligence_valid_action():
    intel = SymbolIntelligence(
        symbol="APAM",
        generated_at="2026-05-23T10:00:00",
        action="BUY_NOW",
        conviction="high",
        summary_line="Cyclical recovery play with improving EBITDA.",
        narrative="## Why it's moving\n...",
        sources=["https://example.com"],
    )
    assert intel.action == "BUY_NOW"
    assert intel.conviction == "high"


def test_symbol_intelligence_rejects_invalid_action():
    with pytest.raises(ValidationError):
        SymbolIntelligence(
            symbol="APAM",
            generated_at="2026-05-23T10:00:00",
            action="INVALID_ACTION",
            conviction="high",
            summary_line="x",
            narrative="x",
            sources=[],
        )
