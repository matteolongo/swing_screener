from __future__ import annotations

import api.services.chat_service as chat_service_module
from api.models.chat import ChatAnswerRequest
from api.services.chat_service import ChatService
from tests.api._chat_test_helpers import (
    FakeConfigService,
    FakeWorkspaceContextService,
    make_context,
    make_education,
    make_opportunity,
    make_order,
    make_portfolio_summary,
    make_position,
    make_workspace_snapshot,
)
from api.models.chat import WorkspaceIntelligenceContext


def test_chat_service_uses_deterministic_portfolio_answer_when_llm_disabled():
    context = make_context(
        orders=[make_order()],
        positions=[make_position()],
        portfolio_summary=make_portfolio_summary(),
    )
    service = ChatService(
        workspace_context_service=FakeWorkspaceContextService(context),
        config_service=FakeConfigService(llm_enabled=False),
    )

    response = service.answer(ChatAnswerRequest(question="What pending orders do I have?"))

    assert "pending orders" in response.answer
    assert "portfolio.orders.pending_count" in response.facts_used


def test_chat_service_blocks_action_requests_with_read_only_guardrail():
    context = make_context(selected_ticker="AAPL")
    service = ChatService(
        workspace_context_service=FakeWorkspaceContextService(context),
        config_service=FakeConfigService(llm_enabled=False),
    )

    response = service.answer(ChatAnswerRequest(question="Please create order for AAPL"))

    assert "read-only in v1" in response.answer.lower()
    assert "Read-only guardrail enforced." in response.warnings


def test_chat_service_replaces_speculative_llm_answer_with_fallback(monkeypatch):
    context = make_context(
        selected_ticker="AAPL",
        orders=[make_order()],
        positions=[make_position()],
        portfolio_summary=make_portfolio_summary(),
        screener_snapshot=make_workspace_snapshot("AAPL"),
        intelligence=WorkspaceIntelligenceContext(
            asof_date="2026-03-13",
            opportunities=[make_opportunity("AAPL")],
            events=[],
            education=make_education("AAPL"),
        ),
    )
    service = ChatService(
        workspace_context_service=FakeWorkspaceContextService(context),
        config_service=FakeConfigService(llm_enabled=True, provider="openai"),
    )

    def fake_invoke_structured_output(runtime_cfg, *, schema, system_prompt, payload):
        del runtime_cfg, system_prompt, payload
        if schema is chat_service_module._IntentResult:
            return chat_service_module._IntentResult(intent="general")
        return chat_service_module._AnswerResult(
            answer="AAPL might keep improving from here.",
            facts_used=["nonexistent.fact"],
            warnings=[],
        )

    monkeypatch.setattr(service, "_invoke_structured_output", fake_invoke_structured_output)

    response = service.answer(ChatAnswerRequest(question="What does the latest context say about AAPL?"))

    assert "might keep improving" not in response.answer
    assert any("replaced because it was empty or speculative" in warning for warning in response.warnings)
    assert response.facts_used


def test_chat_service_returns_bounded_scenario_analysis_for_forecast_questions():
    context = make_context(
        selected_ticker="AAPL",
        orders=[make_order()],
        positions=[make_position()],
        portfolio_summary=make_portfolio_summary(),
        screener_snapshot=make_workspace_snapshot("AAPL"),
        intelligence=WorkspaceIntelligenceContext(
            asof_date="2026-03-13",
            opportunities=[make_opportunity("AAPL")],
            events=[],
            education=make_education("AAPL"),
        ),
    )
    service = ChatService(
        workspace_context_service=FakeWorkspaceContextService(context),
        config_service=FakeConfigService(llm_enabled=False),
    )

    response = service.answer(
        ChatAnswerRequest(question="Given how this symbol is going, do you foresee any drop or increase in the future?")
    )

    assert "scenario analysis for AAPL" in response.answer
    assert "Bull case:" in response.answer
    assert "Bear case:" in response.answer
    assert any("scenario-based and not price predictions" in warning for warning in response.warnings)
    assert "screener.selected_candidate.entry" in response.facts_used or "screener.selected_candidate.stop" in response.facts_used
