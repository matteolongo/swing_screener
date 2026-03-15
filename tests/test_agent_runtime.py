from __future__ import annotations

import asyncio
from pathlib import Path
import subprocess
import sys

import agent.client as agent_client_module
from agent.agent import SwingScreenerAgent
from api.models.chat import ChatAnswerResponse, ChatTurn, WorkspaceContextMeta, WorkspaceContextSourceMeta


class FakeChatService:
    def answer(self, request):
        return ChatAnswerResponse(
            answer=f"Agent reply: {request.question}",
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
                ChatTurn(role="assistant", content=f"Agent reply: {request.question}"),
            ],
        )


async def _ask_agent_question() -> dict:
    agent = SwingScreenerAgent()
    await agent.start()
    try:
        return await agent.ask("What pending orders do I have?", selected_ticker="AAPL")
    finally:
        await agent.stop()


def test_agent_chat_graph_returns_shared_chat_shape(monkeypatch):
    monkeypatch.setattr(agent_client_module, "get_chat_service", lambda: FakeChatService())

    result = asyncio.run(_ask_agent_question())

    assert result["answer"] == "Agent reply: What pending orders do I have?"
    assert result["context_meta"]["selected_ticker"] == "AAPL"
    assert result["facts_used"] == ["portfolio.orders.pending_count"]


def test_agent_cli_orders_list_command_succeeds():
    repo_root = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        [sys.executable, "-m", "agent.cli", "orders", "list", "--status", "pending"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0
    assert "Orders (status: pending)" in result.stdout
