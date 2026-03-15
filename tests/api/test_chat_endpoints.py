from __future__ import annotations

from fastapi.testclient import TestClient

from api.dependencies import get_chat_service
from api.main import app
from api.models.chat import WorkspaceIntelligenceContext
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


def _override_chat_service(context):
    return ChatService(
        workspace_context_service=FakeWorkspaceContextService(context),
        config_service=FakeConfigService(llm_enabled=False),
    )


def test_chat_answer_endpoint_returns_answer_and_freshness_metadata():
    app.dependency_overrides[get_chat_service] = lambda: _override_chat_service(
        make_context(
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
    )

    try:
        client = TestClient(app)
        response = client.post(
            "/api/chat/answer",
            json={
                "question": "What pending orders do I have?",
                "selected_ticker": "aapl",
                "workspace_snapshot": {
                    "asof_date": "2026-03-13",
                    "data_freshness": "final_close",
                    "total_screened": 1,
                    "candidates": [{"ticker": "AAPL", "reasons_short": []}],
                },
            },
        )
    finally:
        app.dependency_overrides.pop(get_chat_service, None)

    assert response.status_code == 200
    payload = response.json()
    assert payload["answer"]
    assert payload["context_meta"]["selected_ticker"] == "AAPL"
    assert any(source["source"] == "portfolio" for source in payload["context_meta"]["sources"])
    assert len(payload["conversation_state"]) == 2


def test_chat_answer_endpoint_rejects_malformed_workspace_snapshot():
    client = TestClient(app)
    response = client.post(
        "/api/chat/answer",
        json={
            "question": "What is the setup?",
            "workspace_snapshot": {
                "candidates": [{"ticker": "", "reasons_short": []}],
            },
        },
    )

    assert response.status_code == 422


def test_chat_answer_endpoint_handles_empty_portfolio():
    app.dependency_overrides[get_chat_service] = lambda: _override_chat_service(make_context())

    try:
        client = TestClient(app)
        response = client.post("/api/chat/answer", json={"question": "What positions do I have?"})
    finally:
        app.dependency_overrides.pop(get_chat_service, None)

    assert response.status_code == 200
    assert "no stored orders or positions" in response.json()["answer"].lower()


def test_chat_answer_endpoint_warns_when_intelligence_is_missing():
    app.dependency_overrides[get_chat_service] = lambda: _override_chat_service(
        make_context(
            selected_ticker="AAPL",
            screener_snapshot=make_workspace_snapshot("AAPL"),
        )
    )

    try:
        client = TestClient(app)
        response = client.post(
            "/api/chat/answer",
            json={"question": "What does intelligence say about AAPL?", "selected_ticker": "AAPL"},
        )
    finally:
        app.dependency_overrides.pop(get_chat_service, None)

    assert response.status_code == 200
    payload = response.json()
    assert "no cached intelligence context" in payload["answer"].lower()
    assert any("cached intelligence data is missing" in warning.lower() for warning in payload["warnings"])


def test_chat_answer_endpoint_supports_bounded_forward_looking_scenarios():
    app.dependency_overrides[get_chat_service] = lambda: _override_chat_service(
        make_context(
            selected_ticker="AAPL",
            screener_snapshot=make_workspace_snapshot("AAPL"),
            intelligence=WorkspaceIntelligenceContext(
                asof_date="2026-03-13",
                opportunities=[make_opportunity("AAPL")],
                events=[],
                education=make_education("AAPL"),
            ),
        )
    )

    try:
        client = TestClient(app)
        response = client.post(
            "/api/chat/answer",
            json={
                "question": "Given how this symbol is going, do you foresee any drop or increase in the future?",
                "selected_ticker": "AAPL",
            },
        )
    finally:
        app.dependency_overrides.pop(get_chat_service, None)

    assert response.status_code == 200
    payload = response.json()
    assert "scenario analysis" in payload["answer"].lower()
    assert "bull case:" in payload["answer"].lower()
    assert any("scenario-based and not price predictions" in warning.lower() for warning in payload["warnings"])
