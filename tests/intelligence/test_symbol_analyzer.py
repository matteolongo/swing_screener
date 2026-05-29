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
    "catalyst_urgency": "medium",
    "summary_line": "Cyclical recovery with strong EBITDA momentum.",
    "narrative": "## Why it's moving\nAperam Q1 2026 beat on EBITDA.",
    "upcoming_events": [],
    "position_signal": None,
    "position_outlook": None,
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


# --- tests for extended prompt and cache ---


def test_prompt_omits_position_section_without_context():
    from swing_screener.intelligence.symbol_analyzer import _build_user_prompt
    req = SymbolIntelligenceRequest(close=50.0, signal="breakout")
    prompt = _build_user_prompt("AAPL", req)
    assert "OPEN POSITION" not in prompt
    assert "MANAGE_ONLY" not in prompt


def test_prompt_includes_position_section_with_context():
    from swing_screener.intelligence.symbol_analyzer import _build_user_prompt
    req = SymbolIntelligenceRequest(
        close=50.0, signal="breakout",
        entry_price=48.0, r_now=1.5, days_open=7,
    )
    prompt = _build_user_prompt("AAPL", req)
    assert "OPEN POSITION" in prompt
    assert "48.00" in prompt
    assert "+1.50R" in prompt
    assert "Days held:     7" in prompt
    assert "MANAGE_ONLY" in prompt
    assert "position_signal" in prompt
    assert "position_outlook" in prompt


def test_prompt_and_inputs_include_sector_rotation_context():
    from swing_screener.intelligence.symbol_analyzer import _build_user_prompt

    req = SymbolIntelligenceRequest(
        close=50.0,
        signal="breakout",
        rel_strength=4.2,
        sector_rs=3.0,
        sector_rotation_context={"fast_rs": 0.04, "slow_rs": 0.02, "in_rotation": True},
    )
    prompt = _build_user_prompt("AAPL", req)

    assert "Relative strength vs sector ETF: 3.0%" in prompt
    assert "Sector rotation:" in prompt
    assert "in rotation: True" in prompt

    fake_response = _make_fake_openai_response(_FAKE_RESPONSE_TEXT)
    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        mock_client.responses.create.return_value = fake_response

        analyzer = SymbolAnalyzer()
        result = analyzer.analyze("AAPL", req)

    assert result.inputs_used["technical"]["sector_rs"] == 3.0
    assert result.inputs_used["technical"]["sector_rotation_context"] == {
        "fast_rs": 0.04,
        "slow_rs": 0.02,
        "in_rotation": True,
    }


def test_symbol_analyzer_maps_position_outlook():
    import json

    fake_json = {
        "action": "MANAGE_ONLY",
        "conviction": "medium",
        "catalyst_urgency": "low",
        "summary_line": "Manage the open position around catalyst follow-through.",
        "narrative": "Text.",
        "upcoming_events": [],
        "position_signal": {"action": "HOLD", "reason": "Thesis remains intact."},
        "position_outlook": {
            "expected_holding_period": "2-6_weeks",
            "hold_until": "Hold while price remains above SMA20 and catalyst evidence improves.",
            "next_review_trigger": "Reassess on earnings or a close below SMA20.",
            "thesis_status": "intact",
            "invalidation_signals": ["Close below SMA20", "Catalyst fails to confirm"],
            "profit_management": "trail_stop",
            "opportunity_cost": "low",
            "confidence_decay": "Confidence decays if the trade stalls for two more weeks.",
        },
        "sources": [],
    }
    fake_response = _make_fake_openai_response(f"```json\n{json.dumps(fake_json)}\n```")
    request = SymbolIntelligenceRequest(
        close=50.0, signal="position",
        entry_price=48.0, r_now=1.5, days_open=7,
    )

    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        mock_client.responses.create.return_value = fake_response

        analyzer = SymbolAnalyzer()
        result = analyzer.analyze("AAPL", request)

    assert result.position_outlook is not None
    assert result.position_outlook.expected_holding_period == "2-6_weeks"
    assert result.position_outlook.thesis_status == "intact"
    assert result.position_outlook.profit_management == "trail_stop"


def test_analyze_writes_to_cache(tmp_path, monkeypatch):
    import json
    from unittest.mock import MagicMock, patch
    from swing_screener.intelligence.models import SymbolIntelligenceRequest

    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))

    fake_json = {
        "action": "BUY_NOW", "conviction": "high",
        "catalyst_urgency": "medium",
        "summary_line": "Strong setup.",
        "narrative": "## Why\nText.",
        "upcoming_events": [],
        "position_signal": None,
        "position_outlook": None,
        "sources": [],
    }
    fake_text = "```json\n" + json.dumps(fake_json) + "\n```"
    resp = MagicMock()
    resp.output_text = fake_text

    req = SymbolIntelligenceRequest(close=50.0, signal="breakout")
    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        mock_client.responses.create.return_value = resp
        analyzer = SymbolAnalyzer()
        analyzer.analyze("AAPL", req)

    cache_files = list((tmp_path / "intelligence").glob("sweep_*.json"))
    assert len(cache_files) == 1
    data = json.loads(cache_files[0].read_text())
    assert "AAPL" in data
    assert data["AAPL"]["action"] == "BUY_NOW"
