from types import SimpleNamespace

import pytest

from swing_screener.intelligence.llm.langchain_provider import (
    LangChainOpenAIProvider,
    _extract_json_payload,
)


class _FakeLLM:
    def __init__(self, content, *, finish_reason: str = "stop"):
        self._content = content
        self._finish_reason = finish_reason

    def invoke(self, _messages):
        return SimpleNamespace(
            content=self._content,
            response_metadata={"finish_reason": self._finish_reason},
        )


def test_extract_json_payload_recovers_embedded_object():
    payload = _extract_json_payload("Classification:\n{\"event_type\":\"OTHER\"}\nDone.")
    assert payload["event_type"] == "OTHER"


def test_openai_provider_parses_list_content_blocks():
    provider = LangChainOpenAIProvider(model="gpt-4o-mini", api_key="test-key")
    provider._llm = _FakeLLM(
        [
            {
                "type": "text",
                "text": (
                    "```json\n"
                    "{"
                    "\"event_type\":\"OTHER\","
                    "\"severity\":\"LOW\","
                    "\"primary_symbol\":\"AAPL\","
                    "\"secondary_symbols\":[],"
                    "\"is_material\":false,"
                    "\"confidence\":0.61,"
                    "\"summary\":\"Apple published a routine corporate update statement.\""
                    "}\n"
                    "```"
                ),
            }
        ]
    )

    classification = provider.classify_event(
        headline="AAPL publishes routine corporate update for investors",
        snippet="",
    )
    assert classification.event_type.value == "OTHER"
    assert classification.primary_symbol == "AAPL"


def test_openai_provider_invalid_json_error_includes_diagnostics():
    provider = LangChainOpenAIProvider(model="gpt-4o-mini", api_key="test-key")
    provider._llm = _FakeLLM("")

    with pytest.raises(ValueError) as exc_info:
        provider.classify_event(
            headline="AAPL publishes routine corporate update for investors",
            snippet="",
        )

    message = str(exc_info.value)
    assert "content_type=str" in message
    assert "content_length=0" in message
    assert "finish_reason=stop" in message
    assert "content_preview=<empty>" in message


def test_extract_json_payload_parses_key_value_fallback():
    payload = _extract_json_payload(
        (
            "event_type: OTHER, severity: LOW, primary_symbol: null, "
            "is_material: false summary: \"GEL has brought the UK's first deep geothermal plant online.\" "
            "confidence_score: 0.8"
        )
    )
    assert payload["event_type"] == "OTHER"
    assert payload["severity"] == "LOW"
    assert payload["primary_symbol"] is None
    assert payload["is_material"] is False
    assert payload["confidence"] == 0.8
    assert "deep geothermal plant" in payload["summary"]


def test_openai_provider_parses_arrow_key_value_response():
    provider = LangChainOpenAIProvider(model="gpt-4o-mini", api_key="test-key")
    provider._llm = _FakeLLM(
        (
            "→ event_type: M_AND_A, severity: HIGH, primary_symbol: \"CXO\", "
            "is_material: true → summary: "
            "\"Core Lithium announced the sale of its Finniss stockpile to Glencore International.\" "
            "confidence score: 0.87"
        )
    )

    classification = provider.classify_event(
        headline="Core Lithium to sell Finniss stockpile to Glencore International",
        snippet="",
    )
    assert classification.event_type.value == "M_AND_A"
    assert classification.severity.value == "HIGH"
    assert classification.primary_symbol == "CXO"
    assert classification.is_material is True
    assert classification.confidence == 0.87


def test_openai_provider_coerces_company_name_primary_symbol():
    provider = LangChainOpenAIProvider(model="gpt-4o-mini", api_key="test-key")
    provider._llm = _FakeLLM(
        (
            "{"
            "\"event_type\":\"ANALYST\","
            "\"severity\":\"LOW\","
            "\"primary_symbol\":\"BNP Paribas\","
            "\"secondary_symbols\":[],"
            "\"is_material\":false,"
            "\"confidence\":0.66,"
            "\"summary\":\"BNP Paribas adjusted The Trade Desk price target and maintained its neutral rating.\""
            "}"
        )
    )

    classification = provider.classify_event(
        headline="BNP Paribas Adjusts Trade Desk Price Target to $25 From $40, Maintains Neutral Rating",
        snippet="",
    )
    assert classification.event_type.value == "ANALYST"
    assert classification.primary_symbol is None
    assert classification.is_material is False
