from __future__ import annotations

import asyncio

import mcp_server.tools.intelligence.chat_answer as chat_answer_module
from api.models.chat import ChatAnswerResponse, ChatTurn, WorkspaceContextMeta, WorkspaceContextSourceMeta
from mcp_server.tools.intelligence.chat_answer import ChatAnswerTool


class FakeChatService:
    def answer(self, request):
        return ChatAnswerResponse(
            answer=f"Echo: {request.question}",
            warnings=[],
            facts_used=["portfolio.orders.pending_count"],
            context_meta=WorkspaceContextMeta(
                selected_ticker=request.selected_ticker,
                sources=[
                    WorkspaceContextSourceMeta(
                        source="portfolio",
                        label="Portfolio",
                        loaded=True,
                        origin="stored_state",
                        asof="2026-03-13",
                        count=2,
                    )
                ],
            ),
            conversation_state=[
                ChatTurn(role="user", content=request.question),
                ChatTurn(role="assistant", content=f"Echo: {request.question}"),
            ],
        )


def test_chat_answer_tool_returns_chat_response_shape(monkeypatch):
    monkeypatch.setattr(chat_answer_module, "get_chat_service", lambda: FakeChatService())
    tool = ChatAnswerTool()

    result = asyncio.run(
        tool.execute(
            {
                "question": "What pending orders do I have?",
                "selected_ticker": "AAPL",
            }
        )
    )

    assert result["answer"] == "Echo: What pending orders do I have?"
    assert result["context_meta"]["selected_ticker"] == "AAPL"
    assert result["facts_used"] == ["portfolio.orders.pending_count"]
    assert len(result["conversation_state"]) == 2
