from swing_screener.intelligence.models import SymbolIntelligenceRequest
from swing_screener.intelligence.symbol_analyzer import _SYSTEM_PROMPT, _build_user_prompt


def test_request_accepts_raw_fundamentals_fields():
    req = SymbolIntelligenceRequest(
        close=100.0,
        signal="breakout",
        trailing_pe=22.5,
        revenue_growth_yoy=0.18,
        gross_margin=0.46,
        net_margin=0.21,
        return_on_equity=0.30,
        debt_to_equity=0.8,
    )
    assert req.trailing_pe == 22.5
    assert req.revenue_growth_yoy == 0.18
    assert req.gross_margin == 0.46
    assert req.net_margin == 0.21
    assert req.return_on_equity == 0.30
    assert req.debt_to_equity == 0.8


def test_prompt_includes_fundamentals_block():
    req = SymbolIntelligenceRequest(
        close=100.0,
        signal="breakout",
        trailing_pe=22.5,
        revenue_growth_yoy=0.18,
        gross_margin=0.46,
        return_on_equity=0.30,
        debt_to_equity=0.8,
    )
    prompt = _build_user_prompt("AAPL", req)
    assert "--- Fundamentals ---" in prompt
    assert "P/E: 22.50" in prompt
    assert "Revenue growth YoY: 18.0%" in prompt
    assert "Gross margin: 46.0%" in prompt


def test_prompt_omits_fundamentals_block_when_absent():
    req = SymbolIntelligenceRequest(close=100.0, signal="breakout")
    prompt = _build_user_prompt("AAPL", req)
    assert "--- Fundamentals ---" not in prompt


def test_system_prompt_requires_multi_hop_and_catalyst_search():
    text = _SYSTEM_PROMPT.lower()
    assert "follow" in text and "lead" in text          # multi-hop guidance
    assert "forward-looking catalyst" in text           # dedicated catalyst pass
    assert "cite" in text                               # require source citations


def test_user_prompt_search_instruction_is_multi_hop():
    req = SymbolIntelligenceRequest(close=100.0, signal="breakout")
    prompt = _build_user_prompt("AAPL", req).lower()
    assert "follow" in prompt and "catalyst" in prompt


def _open_position_request() -> SymbolIntelligenceRequest:
    return SymbolIntelligenceRequest(
        close=110.0,
        signal="MANAGE_ONLY",
        entry_price=100.0,
        entry_date="2026-05-01",
        stop=95.0,
        r_now=2.0,
        days_open=46,
    )


def test_open_position_prompt_includes_entry_date_and_move_explanation():
    prompt = _build_user_prompt("AAPL", _open_position_request())
    assert "Entry date:    2026-05-01" in prompt
    assert "position_move_explanation" in prompt
    assert "moved from the entry to now" in prompt


def test_move_explanation_omitted_without_position_context():
    prompt = _build_user_prompt("AAPL", SymbolIntelligenceRequest(close=110.0, signal="breakout"))
    assert "position_move_explanation" not in prompt
    assert "Entry date:" not in prompt


def test_system_prompt_documents_move_explanation_schema():
    assert "position_move_explanation" in _SYSTEM_PROMPT
    assert "up | down | flat" in _SYSTEM_PROMPT


def test_symbol_intelligence_parses_position_move_explanation():
    from swing_screener.intelligence.models import SymbolIntelligence

    result = SymbolIntelligence.model_validate(
        {
            "symbol": "AAPL",
            "generated_at": "2026-06-16T00:00:00+00:00",
            "action": "MANAGE_ONLY",
            "conviction": "medium",
            "summary_line": "Holding into earnings.",
            "narrative": "What to do: hold.",
            "position_move_explanation": {
                "direction": "up",
                "summary": "Up since entry on a strong Q1 beat.",
                "drivers": [{"label": "Q1 earnings beat", "detail": "Revenue topped guidance."}],
            },
        }
    )
    assert result.position_move_explanation is not None
    assert result.position_move_explanation.direction == "up"
    assert result.position_move_explanation.drivers[0].label == "Q1 earnings beat"
