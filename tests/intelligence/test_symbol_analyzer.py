from unittest.mock import MagicMock, patch

import pytest

from swing_screener.intelligence.models import SymbolIntelligence, SymbolIntelligenceRequest
from swing_screener.intelligence.symbol_analyzer import (
    SymbolAnalyzer,
    _extract_json,
    _build_user_prompt,
)


@pytest.fixture(autouse=True)
def _isolate_intelligence_cache(tmp_path, monkeypatch):
    """Redirect the intelligence cache to a tmp dir for every test in this module.

    `SymbolAnalyzer.analyze` writes its result via `write_to_cache`, which resolves
    `data_dir()` from `SWING_SCREENER_DATA_DIR`. Without this, tests that call
    `analyze()` write fixture data into the real `data/intelligence/sweep_<today>.json`
    and poison the running app's cache.
    """
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))


def test_prompt_includes_recent_patterns():
    req = SymbolIntelligenceRequest(
        close=10.0,
        signal="breakout",
        recent_patterns=["hammer@at_pullback", "inside_bar@none"],
    )
    prompt = _build_user_prompt("AAA", req, past_positions=[])
    assert "hammer" in prompt
    assert "Recent candlestick patterns" in prompt


def test_prompt_omits_patterns_when_absent():
    req = SymbolIntelligenceRequest(close=10.0, signal="breakout")
    prompt = _build_user_prompt("AAA", req, past_positions=[])
    assert "Recent candlestick patterns" not in prompt


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


def test_inputs_used_includes_recent_candle_patterns():
    fake_response = _make_fake_openai_response(_FAKE_RESPONSE_TEXT)
    request = SymbolIntelligenceRequest(
        close=48.5,
        signal="breakout",
        recent_patterns=["hammer@at_pullback", "inside_bar@none"],
    )

    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        mock_client.responses.create.return_value = fake_response

        analyzer = SymbolAnalyzer()
        result = analyzer.analyze("APAM", request)

    assert result.inputs_used["candles"] == {
        "patterns": "hammer@at_pullback, inside_bar@none"
    }


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


def test_format_past_trades_empty():
    from swing_screener.intelligence.symbol_analyzer import _format_past_trades
    assert _format_past_trades("AAPL", []) is None


def test_format_past_trades_no_closed():
    from swing_screener.intelligence.symbol_analyzer import _format_past_trades
    positions = [{"ticker": "AAPL", "status": "open", "entry_price": 50.0}]
    assert _format_past_trades("AAPL", positions) is None


def test_format_past_trades_one_stopped_out():
    from swing_screener.intelligence.symbol_analyzer import _format_past_trades
    positions = [{
        "ticker": "AAPL", "status": "closed",
        "entry_price": 48.15, "stop_price": 47.17, "exit_price": 47.29,
        "entry_date": "2026-01-15", "exit_date": "2026-01-23",
    }]
    result = _format_past_trades("AAPL", positions)
    assert result is not None
    assert "Past trades on AAPL" in result
    assert "48.15" in result
    assert "47.29" in result
    assert "stopped out" in result
    assert "2026-01-15" in result


def test_format_past_trades_win():
    from swing_screener.intelligence.symbol_analyzer import _format_past_trades
    positions = [{
        "ticker": "BESI.AS", "status": "closed",
        "entry_price": 200.0, "stop_price": 190.0, "exit_price": 230.0,
        "entry_date": "2026-01-10", "exit_date": "2026-01-31",
    }]
    result = _format_past_trades("BESI.AS", positions)
    assert result is not None
    assert "+3.00R" in result
    assert "target/manual exit" in result


def test_format_past_trades_ignores_wrong_ticker():
    from swing_screener.intelligence.symbol_analyzer import _format_past_trades
    positions = [{
        "ticker": "MSFT", "status": "closed",
        "entry_price": 400.0, "stop_price": 390.0, "exit_price": 380.0,
        "entry_date": "2026-01-10", "exit_date": "2026-01-20",
    }]
    assert _format_past_trades("AAPL", positions) is None


def test_prompt_includes_past_trades_block():
    from swing_screener.intelligence.symbol_analyzer import _build_user_prompt
    from swing_screener.intelligence.models import SymbolIntelligenceRequest
    past = [{
        "ticker": "AAPL", "status": "closed",
        "entry_price": 48.15, "stop_price": 47.17, "exit_price": 47.29,
        "entry_date": "2026-01-15", "exit_date": "2026-01-23",
    }]
    req = SymbolIntelligenceRequest(close=50.0, signal="breakout")
    prompt = _build_user_prompt("AAPL", req, past_positions=past)
    assert "Past trades on AAPL" in prompt
    assert "48.15" in prompt


def test_prompt_no_past_trades_block_when_empty():
    from swing_screener.intelligence.symbol_analyzer import _build_user_prompt
    from swing_screener.intelligence.models import SymbolIntelligenceRequest
    req = SymbolIntelligenceRequest(close=50.0, signal="breakout")
    prompt = _build_user_prompt("AAPL", req, past_positions=[])
    assert "Past trades" not in prompt


def test_analyzer_parses_new_fields():
    import json
    from unittest.mock import MagicMock, patch
    from swing_screener.intelligence.models import SymbolIntelligenceRequest

    fake_json = {
        "action": "BUY_ON_PULLBACK",
        "conviction": "medium",
        "catalyst_urgency": "low",
        "summary_line": "Pullback candidate.",
        "narrative": "Text.",
        "upcoming_events": [],
        "position_signal": None,
        "position_outlook": None,
        "sources": [],
        "price_hook": "Near 52w high with sector tailwind.",
        "key_numbers": [
            {"label": "SMA20", "value": "€266", "sentiment": "bullish"},
            {"label": "Valuation", "value": "expensive", "sentiment": "bearish"},
        ],
        "risk_factors": ["Stretched valuation.", "No catalyst snapshot."],
        "prediction_bullets": [
            {"direction": "bullish", "reason": "SMA20 holds as support.", "reference": "technical"},
        ],
        "past_trades_context": "One prior stop at €247.",
    }
    fake_text = "```json\n" + json.dumps(fake_json) + "\n```"
    resp = MagicMock()
    resp.output_text = fake_text

    req = SymbolIntelligenceRequest(close=286.0, signal="breakout")
    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        mock_client.responses.create.return_value = resp
        from swing_screener.intelligence.symbol_analyzer import SymbolAnalyzer
        analyzer = SymbolAnalyzer()
        result = analyzer.analyze("BESI.AS", req, past_positions=[])

    assert result.price_hook == "Near 52w high with sector tailwind."
    assert len(result.key_numbers) == 2
    assert result.key_numbers[0].label == "SMA20"
    assert result.key_numbers[1].sentiment == "bearish"
    assert result.risk_factors == ["Stretched valuation.", "No catalyst snapshot."]
    assert len(result.prediction_bullets) == 1
    assert result.prediction_bullets[0].direction == "bullish"
    assert result.past_trades_context == "One prior stop at €247."


_PRE_OPEN_NOW = __import__("datetime").datetime(
    2026, 6, 23, 13, 0, tzinfo=__import__("datetime").timezone.utc
)  # Tue 09:00 ET — US pre-market
_REGULAR_NOW = __import__("datetime").datetime(
    2026, 6, 23, 15, 0, tzinfo=__import__("datetime").timezone.utc
)  # Tue 11:00 ET — market open

_PRE_OPEN_FIELDS = {
    "pre_open_outlook": {
        "gap_direction": "gap_up",
        "magnitude": "moderate",
        "primary_driver": {"summary": "Overnight beat.", "source_url": "https://x"},
        "action_at_open": "Let it open; don't chase.",
        "stop_gap_plan": "Exit at open if it gaps below the stop.",
        "confidence": "medium",
    },
    "thesis_delta": {
        "status": "confirmed",
        "summary": "Thesis intact since last run.",
        "what_played_out": ["Beat as flagged"],
    },
}


def _fake_resp_with(**extra):
    import json
    body = {**_FAKE_RESPONSE_JSON, **extra}
    return _make_fake_openai_response("```json\n" + json.dumps(body) + "\n```")


def test_pre_open_outlook_populated_in_window_for_us_symbol():
    req = SymbolIntelligenceRequest(close=180.0, signal="breakout", currency="USD")
    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        mock_client.responses.create.return_value = _fake_resp_with(**_PRE_OPEN_FIELDS)
        analyzer = SymbolAnalyzer()
        result = analyzer.analyze("AAPL", req, now=_PRE_OPEN_NOW)

    assert result.pre_open_outlook is not None
    assert result.pre_open_outlook.gap_direction == "gap_up"
    assert result.pre_open_outlook.magnitude == "moderate"
    assert result.inputs_used["pre_open"]["window"] == "us_pre_market"
    # Prompt block must have been sent
    sent = mock_client.responses.create.call_args.kwargs["input"]
    assert "Pre-open outlook" in sent


def test_pre_open_outlook_dropped_when_market_open():
    req = SymbolIntelligenceRequest(close=180.0, signal="breakout", currency="USD")
    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        mock_client.responses.create.return_value = _fake_resp_with(**_PRE_OPEN_FIELDS)
        analyzer = SymbolAnalyzer()
        result = analyzer.analyze("AAPL", req, now=_REGULAR_NOW)

    assert result.pre_open_outlook is None
    sent = mock_client.responses.create.call_args.kwargs["input"]
    assert "Pre-open outlook" not in sent


def test_pre_open_outlook_dropped_for_non_us_symbol():
    req = SymbolIntelligenceRequest(close=180.0, signal="breakout", currency="EUR")
    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        mock_client.responses.create.return_value = _fake_resp_with(**_PRE_OPEN_FIELDS)
        analyzer = SymbolAnalyzer()
        result = analyzer.analyze("ASML.AS", req, now=_PRE_OPEN_NOW)

    assert result.pre_open_outlook is None


def test_thesis_delta_parsed_only_with_prior_history(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    req = SymbolIntelligenceRequest(close=180.0, signal="breakout", currency="USD")
    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        mock_client.responses.create.return_value = _fake_resp_with(**_PRE_OPEN_FIELDS)
        analyzer = SymbolAnalyzer()
        # First run: no prior history → thesis_delta gated to None even though the
        # model emitted one.
        first = analyzer.analyze("AAPL", req, now=_REGULAR_NOW)
        assert first.thesis_delta is None
        # Second run: prior analysis exists → thesis_delta is parsed.
        second = analyzer.analyze("AAPL", req, now=_REGULAR_NOW)

    assert second.thesis_delta is not None
    assert second.thesis_delta.status == "confirmed"
    assert second.thesis_delta.what_played_out == ["Beat as flagged"]


def test_malformed_pre_open_outlook_degrades_to_none(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    req = SymbolIntelligenceRequest(close=180.0, signal="breakout", currency="USD")
    # pre_open_outlook missing required action_at_open / stop_gap_plan.
    bad = {"pre_open_outlook": {"gap_direction": "gap_up", "magnitude": "moderate"}}
    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        mock_client.responses.create.return_value = _fake_resp_with(**bad)
        analyzer = SymbolAnalyzer()
        result = analyzer.analyze("AAPL", req, now=_PRE_OPEN_NOW)

    # Analysis succeeds; the malformed sub-object is dropped rather than 500-ing.
    assert result.pre_open_outlook is None
    assert result.action == "BUY_NOW"


def test_history_appended_and_fed_back_as_digest(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    from swing_screener.intelligence.history import read_history

    req = SymbolIntelligenceRequest(close=180.0, signal="breakout", currency="USD")
    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        mock_client.responses.create.return_value = _fake_resp_with()
        analyzer = SymbolAnalyzer()
        # First run: no prior history → no digest block in the prompt.
        analyzer.analyze("AAPL", req, now=_REGULAR_NOW)
        first_prompt = mock_client.responses.create.call_args.kwargs["input"]
        assert "Prior analyses" not in first_prompt
        # Second run: the first run is now in history → digest block present.
        analyzer.analyze("AAPL", req, now=_REGULAR_NOW)
        second_prompt = mock_client.responses.create.call_args.kwargs["input"]
        assert "Prior analyses (most recent first)" in second_prompt

    # Both runs land on the same calendar day, so same-day dedup keeps one entry.
    stored = read_history("AAPL")
    assert len(stored) == 1


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
