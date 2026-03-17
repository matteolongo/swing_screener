from __future__ import annotations

import api.services.intelligence_service as intelligence_service
from api.models.intelligence import IntelligenceEducationViewOutput
from swing_screener.intelligence.config import build_intelligence_config


class _FakeResponse:
    def __init__(self, content: str):
        self.content = content


class _FakeLLM:
    def __init__(self):
        self.messages = None

    def invoke(self, messages):
        self.messages = messages
        return _FakeResponse(
            '{"title":"Why this trade idea exists (AAPL)","summary":"Fact-grounded thesis summary.","bullets":["Trend is active."],"watchouts":[],"next_steps":[],"glossary_links":[],"facts_used":["state"]}'
        )


def test_education_user_prompt_template_is_consumed(monkeypatch):
    cfg = build_intelligence_config(
        {
            "market_intelligence": {
                "llm": {
                    "enabled": True,
                    "provider": "openai",
                    "model": "gpt-4o-mini",
                    "education_thesis_user_prompt_template": (
                        "Symbol={{symbol}}\n"
                        "View={{view}}\n"
                        "Facts={{facts_json}}\n"
                        "Context={{context_json}}\n"
                        "Payload={{payload_json}}"
                    ),
                }
            }
        }
    )
    fake_llm = _FakeLLM()
    monkeypatch.setattr(intelligence_service, "build_langchain_chat_model", lambda **kwargs: fake_llm)

    fallback = IntelligenceEducationViewOutput(
        title="Fallback title",
        summary="Fallback summary",
        bullets=[],
        watchouts=[],
        next_steps=[],
        glossary_links=[],
        facts_used=["state"],
        source="deterministic_fallback",
        template_version="v1",
        generated_at="2026-03-17T12:00:00",
    )

    result, error = intelligence_service._invoke_llm_education_view(
        cfg=cfg,
        view="thesis",
        symbol="AAPL",
        context={"state": "TRENDING"},
        facts={"state": "TRENDING"},
        fallback=fallback,
    )

    assert error is None
    assert result.source == "llm"
    assert fake_llm.messages is not None
    user_prompt = fake_llm.messages[1].content
    assert "Symbol=AAPL" in user_prompt
    assert "View=thesis" in user_prompt
    assert '"state":"TRENDING"' in user_prompt
    assert "{{symbol}}" not in user_prompt
