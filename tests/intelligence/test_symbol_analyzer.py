from unittest.mock import MagicMock, patch

import pytest

from swing_screener.intelligence.models import SymbolIntelligence, SymbolIntelligenceRequest
from swing_screener.intelligence.symbol_analyzer import SymbolAnalyzer, _extract_json


# --- unit tests for JSON extraction ---

def test_extract_json_from_fenced_block():
    text = '```json\n{"action": "BUY_NOW", "conviction": "high"}\n```'
    result = _extract_json(text)
    assert result["action"] == "BUY_NOW"


def test_extract_json_from_bare_object():
    text = 'Some prose before {"action": "WATCH", "conviction": "low"} some prose after'
    result = _extract_json(text)
    assert result["action"] == "WATCH"


def test_extract_json_raises_when_missing():
    with pytest.raises(ValueError, match="No JSON found"):
        _extract_json("no json here at all")


# --- integration test with mocked OpenAI client ---

_FAKE_RESPONSE_JSON = {
    "action": "BUY_NOW",
    "conviction": "high",
    "summary_line": "Cyclical recovery with strong EBITDA momentum.",
    "narrative": "## Why it's moving\nAperam Q1 2026 beat on EBITDA.",
    "sources": ["https://aperam.com/q1-2026"],
}

_FAKE_RESPONSE_TEXT = (
    "```json\n"
    + __import__("json").dumps(_FAKE_RESPONSE_JSON)
    + "\n```"
)


def _make_fake_openai_response(text: str):
    resp = MagicMock()
    resp.output_text = text
    return resp


def test_symbol_analyzer_returns_intelligence():
    fake_response = _make_fake_openai_response(_FAKE_RESPONSE_TEXT)
    request = SymbolIntelligenceRequest(
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

    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        mock_client.responses.create.return_value = fake_response

        analyzer = SymbolAnalyzer()
        result = analyzer.analyze("APAM", request)

    assert isinstance(result, SymbolIntelligence)
    assert result.symbol == "APAM"
    assert result.action == "BUY_NOW"
    assert result.conviction == "high"
    assert result.summary_line == "Cyclical recovery with strong EBITDA momentum."
    assert "Aperam" in result.narrative
    assert result.sources == ["https://aperam.com/q1-2026"]


def test_symbol_analyzer_raises_on_invalid_action():
    bad_json = __import__("json").dumps({
        "action": "TOTALLY_WRONG",
        "conviction": "high",
        "summary_line": "x",
        "narrative": "x",
        "sources": [],
    })
    fake_response = _make_fake_openai_response(f"```json\n{bad_json}\n```")
    request = SymbolIntelligenceRequest(close=10.0, signal="pullback")

    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        mock_client.responses.create.return_value = fake_response

        analyzer = SymbolAnalyzer()
        with pytest.raises(Exception):
            analyzer.analyze("XYZ", request)
