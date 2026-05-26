from __future__ import annotations
import json
from datetime import date
from unittest.mock import MagicMock, patch
import pytest
from swing_screener.intelligence.catalysts.generator import CatalystReportGenerator
from swing_screener.intelligence.catalysts.models import CatalystReport


_FAKE_REPORT = {
    "report_id": "test-001",
    "event_summary": "US steel tariffs at 25%.",
    "themes": [{"name": "Steel tariffs", "summary": "Cost pressure.", "time_horizon": "short_term", "confidence": 0.8}],
    "causal_chains": [{"step": 1, "cause": "tariff", "effect": "higher costs", "affected_sector": "manufacturing"}],
    "beneficiaries": [{
        "ticker": "STLD", "company_name": "Steel Dynamics",
        "benefit_type": "first_order", "thesis": "Domestic prices rise.",
        "causal_chain": [{"step": 1, "cause": "tariff", "effect": "price increase", "affected_sector": None}],
        "evidence": [{"title": "Reuters", "url": "https://reuters.com/1", "quote_or_summary": "Tariff announced.", "relevance": "Direct."}],
        "catalyst_strength": 7.5, "market_awareness": 5.0, "priced_in_risk": 4.0, "swing_relevance": 6.5,
        "risk_level": "medium", "key_risks": ["reversal"], "expected_time_horizon": "weeks",
    }],
    "losers": [],
    "hidden_opportunities": [],
    "non_actionable_notes": [],
    "generated_at": "2026-05-24T10:00:00Z",
}


def test_generate_from_url_returns_valid_report(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    with patch("swing_screener.intelligence.catalysts.generator.OpenAI") as MockOpenAI:
        client = MagicMock()
        MockOpenAI.return_value = client
        client.responses.create.return_value = MagicMock(output_text=json.dumps(_FAKE_REPORT))
        gen = CatalystReportGenerator()
        report = gen.generate_from_url("https://reuters.com/1")
    assert isinstance(report, CatalystReport)
    assert report.event_summary == "US steel tariffs at 25%."
    assert len(report.beneficiaries) == 1
    # Verify system prompt is always passed
    call_kwargs = client.responses.create.call_args.kwargs
    from swing_screener.intelligence.catalysts.prompts import SYSTEM_PROMPT
    assert call_kwargs.get("instructions") == SYSTEM_PROMPT


def test_generate_from_url_writes_to_store(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    with patch("swing_screener.intelligence.catalysts.generator.OpenAI") as MockOpenAI:
        client = MagicMock()
        MockOpenAI.return_value = client
        client.responses.create.return_value = MagicMock(output_text=json.dumps(_FAKE_REPORT))
        gen = CatalystReportGenerator()
        report = gen.generate_from_url("https://reuters.com/1")
    from swing_screener.intelligence.catalysts.store import CatalystStore
    store = CatalystStore()
    loaded = store.load_report(report.report_id)
    assert loaded is not None


def test_generate_from_web_search_returns_valid_report(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    with patch("swing_screener.intelligence.catalysts.generator.OpenAI") as MockOpenAI:
        client = MagicMock()
        MockOpenAI.return_value = client
        client.responses.create.return_value = MagicMock(output_text=json.dumps(_FAKE_REPORT))
        gen = CatalystReportGenerator()
        report = gen.generate_from_web_search()
    assert isinstance(report, CatalystReport)


def test_invalid_json_raises_value_error(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    with patch("swing_screener.intelligence.catalysts.generator.OpenAI") as MockOpenAI:
        client = MagicMock()
        MockOpenAI.return_value = client
        client.responses.create.return_value = MagicMock(output_text="not json at all")
        gen = CatalystReportGenerator()
        with pytest.raises(ValueError):
            gen.generate_from_url("https://example.com/bad")


def test_prompt_contains_guardrails():
    from swing_screener.intelligence.catalysts.prompts import SYSTEM_PROMPT
    assert "do not" in SYSTEM_PROMPT.lower() or "must not" in SYSTEM_PROMPT.lower()
    assert "source" in SYSTEM_PROMPT.lower()
