from __future__ import annotations

import asyncio
from fastapi.testclient import TestClient

from agent.agent import SwingScreenerAgent
from api.dependencies import get_agent_chat_service
from api.main import app
from mcp_server.config import load_config
from mcp_server.tools.registry import create_registry
from tests.fixtures.fake_mcp_server import FakeChatService

SERVER_COMMAND = ["uv", "run", "--extra", "mcp", "python", "-m", "tests.fixtures.fake_mcp_server"]


class FakeAgentChatService:
    async def answer(self, request):
        return FakeChatService().answer(request)


async def _ask_agent_question() -> dict:
    agent = SwingScreenerAgent(server_command=SERVER_COMMAND)
    await agent.start()
    try:
        return await agent.ask("What pending orders do I have?", selected_ticker="AAPL")
    finally:
        await agent.stop()


async def _load_agent_tools() -> list[str]:
    agent = SwingScreenerAgent(server_command=SERVER_COMMAND)
    await agent.start()
    try:
        return agent.get_available_tools()
    finally:
        await agent.stop()


async def _run_agent_flows() -> tuple[dict, dict, dict]:
    agent = SwingScreenerAgent(server_command=SERVER_COMMAND)
    await agent.start()
    try:
        screening = await agent.daily_screening(universe="mega_all", top=1)
        review = await agent.daily_review()
        chat = await agent.ask("What pending orders do I have?", selected_ticker="AAPL")
        return screening, review, chat
    finally:
        await agent.stop()


def test_agent_visible_tools_match_mcp_registry():
    registry = create_registry(load_config())
    expected_tools = sorted(tool.name for tool in registry.get_all_tools())

    actual_tools = sorted(asyncio.run(_load_agent_tools()))

    assert actual_tools == expected_tools


def test_agent_chat_matches_api_response_shape_over_mcp():
    app.dependency_overrides[get_agent_chat_service] = lambda: FakeAgentChatService()
    try:
        client = TestClient(app)
        api_response = client.post(
            "/api/chat/answer",
            json={"question": "What pending orders do I have?", "selected_ticker": "AAPL"},
        )
    finally:
        app.dependency_overrides.pop(get_agent_chat_service, None)

    agent_response = asyncio.run(_ask_agent_question())

    assert api_response.status_code == 200
    api_payload = api_response.json()
    assert set(agent_response.keys()) == set(api_payload.keys())
    assert set(agent_response["context_meta"].keys()) == set(api_payload["context_meta"].keys())
    assert agent_response["facts_used"] == api_payload["facts_used"]
    assert agent_response["answer"] == api_payload["answer"]


def test_agent_screen_daily_review_and_chat_flow_through_stdio_mcp():
    screening, review, chat = asyncio.run(_run_agent_flows())

    assert screening["universe"] == "mega_all"
    assert len(screening["candidates"]) == 1
    assert screening["candidates"][0]["ticker"] == "AAPL"
    assert screening["candidates"][0]["entry"] == 175.5
    assert screening["candidates"][0]["stop"] == 170.0
    assert "entry_price" not in screening["candidates"][0]
    assert "stop_price" not in screening["candidates"][0]
    assert "target_price" not in screening["candidates"][0]
    assert screening["insights"]

    assert "summary" in review
    assert "candidate slots" in review["summary"]

    assert chat["answer"] == "Fake MCP answer: What pending orders do I have?"
    assert chat["facts_used"] == ["portfolio.orders.pending_count"]
