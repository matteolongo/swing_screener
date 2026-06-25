from unittest.mock import MagicMock, patch

import pytest

from swing_screener.intelligence.models import SymbolIntelligence, SymbolIntelligenceRequest
from swing_screener.intelligence.symbol_analyzer import (
    SymbolAnalyzer,
    _LLMAnalysis,
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


def test_client_built_with_timeout_and_retries(monkeypatch):
    from swing_screener.intelligence import symbol_analyzer as sa
    captured = {}
    real = sa.OpenAI
    def spy(**kw):
        captured.update(kw); return real(**kw)
    monkeypatch.setattr(sa, "OpenAI", spy)
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    sa.SymbolAnalyzer()
    assert captured.get("timeout") is not None
    assert captured.get("max_retries") is not None


def test_analyze_uses_two_calls(monkeypatch):
    from swing_screener.intelligence import symbol_analyzer as sa
    from swing_screener.intelligence.models import SymbolIntelligenceRequest, SymbolIntelligence

    calls = []

    class _Resp:  # call-1 shape
        output_text = "Apple is strong. Sources: https://x.com/a"

    class _Parsed:  # call-2 shape
        output_parsed = sa._LLMAnalysis(
            action="WATCH", conviction="medium", catalyst_urgency="none",
            summary_line="ok", narrative="**What to do:** wait", upcoming_events=[],
            sources=["https://x.com/a"], key_numbers=[], risk_factors=["r1", "r2", "r3"],
            prediction_bullets=[],
        )

    def fake_create(**kw):
        calls.append(("create", kw)); return _Resp()
    def fake_parse(**kw):
        calls.append(("parse", kw)); return _Parsed()

    monkeypatch.setenv("OPENAI_API_KEY", "test")
    analyzer = sa.SymbolAnalyzer()
    monkeypatch.setattr(analyzer._client.responses, "create", fake_create)
    monkeypatch.setattr(analyzer._client.responses, "parse", fake_parse)

    result = analyzer.analyze("AAPL", SymbolIntelligenceRequest(close=200.0, signal="x"))
    assert isinstance(result, SymbolIntelligence)
    assert [c[0] for c in calls] == ["create", "parse"]
    # call 1 has the web_search tool, call 2 does not
    assert calls[0][1]["tools"] == [{"type": "web_search_preview"}]
    assert "tools" not in calls[1][1]
    assert result.action == "WATCH"


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


def _make_fake_openai_response(text: str = "write-up. Sources: https://x"):
    """Call-1 (web search) stub: an object exposing `.output_text` (prose)."""
    resp = MagicMock()
    resp.output_text = text
    return resp


def _make_parsed(body: dict):
    """Call-2 (responses.parse) stub: an object exposing `.output_parsed` =
    a validated `_LLMAnalysis` built from the given field dict."""
    parsed = MagicMock()
    parsed.output_parsed = _LLMAnalysis.model_validate(body)
    return parsed


def _wire_two_calls(mock_client, body: dict, prose: str = "write-up. Sources: https://x"):
    """Wire a mocked OpenAI client for the two-call flow."""
    mock_client.responses.create.return_value = _make_fake_openai_response(prose)
    mock_client.responses.parse.return_value = _make_parsed(body)


def test_symbol_analyzer_returns_intelligence():
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
        _wire_two_calls(mock_client, _FAKE_RESPONSE_JSON)

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
    request = SymbolIntelligenceRequest(
        close=48.5,
        signal="breakout",
        recent_patterns=["hammer@at_pullback", "inside_bar@none"],
    )

    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        _wire_two_calls(mock_client, _FAKE_RESPONSE_JSON)

        analyzer = SymbolAnalyzer()
        result = analyzer.analyze("APAM", request)

    assert result.inputs_used["candles"] == {
        "patterns": "hammer@at_pullback, inside_bar@none"
    }


def test_symbol_analyzer_raises_on_invalid_action():
    # An out-of-enum action survives the call-2 `_LLMAnalysis` (action: str) but
    # is rejected when mapped into `SymbolIntelligence.action` (DecisionAction).
    bad_body = {
        "action": "TOTALLY_WRONG",
        "conviction": "high",
        "summary_line": "x",
        "narrative": "x",
        "sources": [],
    }
    request = SymbolIntelligenceRequest(close=10.0, signal="pullback")

    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        _wire_two_calls(mock_client, bad_body)

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

    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        _wire_two_calls(mock_client, _FAKE_RESPONSE_JSON)

        analyzer = SymbolAnalyzer()
        result = analyzer.analyze("AAPL", req)

    assert result.inputs_used["technical"]["sector_rs"] == 3.0
    assert result.inputs_used["technical"]["sector_rotation_context"] == {
        "fast_rs": 0.04,
        "slow_rs": 0.02,
        "in_rotation": True,
    }


def test_symbol_analyzer_maps_position_outlook():
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
    request = SymbolIntelligenceRequest(
        close=50.0, signal="position",
        entry_price=48.0, r_now=1.5, days_open=7,
    )

    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        _wire_two_calls(mock_client, fake_json)

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

    req = SymbolIntelligenceRequest(close=286.0, signal="breakout")
    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        _wire_two_calls(mock_client, fake_json)
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


def _wire_with(mock_client, **extra):
    """Wire the two-call flow with `_FAKE_RESPONSE_JSON` plus the given overrides
    as the call-2 parsed `_LLMAnalysis`."""
    _wire_two_calls(mock_client, {**_FAKE_RESPONSE_JSON, **extra})


def test_pre_open_outlook_populated_in_window_for_us_symbol():
    req = SymbolIntelligenceRequest(close=180.0, signal="breakout", currency="USD")
    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        _wire_with(mock_client, **_PRE_OPEN_FIELDS)
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
        _wire_with(mock_client, **_PRE_OPEN_FIELDS)
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
        _wire_with(mock_client, **_PRE_OPEN_FIELDS)
        analyzer = SymbolAnalyzer()
        result = analyzer.analyze("ASML.AS", req, now=_PRE_OPEN_NOW)

    assert result.pre_open_outlook is None


def test_thesis_delta_parsed_only_with_prior_history(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    req = SymbolIntelligenceRequest(close=180.0, signal="breakout", currency="USD")
    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        _wire_with(mock_client, **_PRE_OPEN_FIELDS)
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


def test_malformed_pre_open_outlook_rejected_by_structured_output():
    # With the two-call decouple, call 2 (`responses.parse`) is the validation
    # boundary: a partial pre_open_outlook (missing required action_at_open /
    # stop_gap_plan) can no longer reach the server as a degraded-to-None field —
    # it fails `_LLMAnalysis` validation outright. The old `_safe_submodel`
    # graceful-degradation path is gone by design.
    bad = {**_FAKE_RESPONSE_JSON,
           "pre_open_outlook": {"gap_direction": "gap_up", "magnitude": "moderate"}}
    with pytest.raises(Exception):
        _LLMAnalysis.model_validate(bad)


def test_history_appended_and_fed_back_as_digest(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    from swing_screener.intelligence.history import read_history

    req = SymbolIntelligenceRequest(close=180.0, signal="breakout", currency="USD")
    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        _wire_with(mock_client)
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

    req = SymbolIntelligenceRequest(close=50.0, signal="breakout")
    with patch("swing_screener.intelligence.symbol_analyzer.OpenAI") as MockOpenAI:
        mock_client = MagicMock()
        MockOpenAI.return_value = mock_client
        _wire_two_calls(mock_client, fake_json)
        analyzer = SymbolAnalyzer()
        analyzer.analyze("AAPL", req)

    cache_files = list((tmp_path / "intelligence").glob("sweep_*.json"))
    assert len(cache_files) == 1
    data = json.loads(cache_files[0].read_text())
    assert "AAPL" in data
    assert data["AAPL"]["action"] == "BUY_NOW"
