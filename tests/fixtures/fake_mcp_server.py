from __future__ import annotations

import asyncio

from pydantic import BaseModel, Field

import mcp_server.dependencies as dependencies
import mcp_server.tools.intelligence.chat_answer as chat_answer_tool
import mcp_server.tools.intelligence._common as intelligence_common
from api.models.chat import ChatAnswerResponse, ChatTurn, WorkspaceContextMeta, WorkspaceContextSourceMeta
from mcp_server.config import load_config
from mcp_server.main import MCPServer, setup_logging


class FakeScreenerResult(BaseModel):
    candidates: list[dict] = Field(default_factory=list)
    asof_date: str = "2026-03-17"
    total_screened: int = 1
    warnings: list[str] = Field(default_factory=list)


class FakeDailyReviewResult(BaseModel):
    summary: str
    candidates: list[dict] = Field(default_factory=list)
    position_actions: list[dict] = Field(default_factory=list)


class FakeScreenerService:
    def list_universes(self) -> dict[str, list[str]]:
        return {"universes": ["mega_all", "test_universe"]}

    def run_screener(self, request) -> FakeScreenerResult:
        top = int(getattr(request, "top", 1) or 1)
        return FakeScreenerResult(
            candidates=[
                {
                    "ticker": "AAPL",
                    "entry": 175.5,
                    "stop": 170.0,
                    "target": 186.0,
                    "momentum_6m": 0.24,
                    "atr_percent": 0.03,
                    "category": "Technology",
                    "max_loss_amount": 100.0,
                }
            ][:top],
            total_screened=1,
        )


class FakeStrategyService:
    def get_active_strategy(self) -> dict[str, str]:
        return {"id": "test-strategy"}


class FakeDailyReviewService:
    def generate_daily_review(self, top_n: int = 10) -> FakeDailyReviewResult:
        return FakeDailyReviewResult(
            summary=f"Review includes {top_n} candidate slots.",
            candidates=[{"ticker": "AAPL", "action": "watch"}],
            position_actions=[{"ticker": "MSFT", "action": "hold"}],
        )


class FakeChatService:
    def answer(self, request) -> ChatAnswerResponse:
        return ChatAnswerResponse(
            answer=f"Fake MCP answer: {request.question}",
            warnings=[],
            facts_used=["portfolio.orders.pending_count"],
            context_meta=WorkspaceContextMeta(
                selected_ticker=request.selected_ticker,
                sources=[
                    WorkspaceContextSourceMeta(
                        source="portfolio",
                        label="Portfolio",
                        loaded=True,
                        origin="test_fixture",
                        asof="2026-03-17",
                        count=1,
                    )
                ],
            ),
            conversation_state=[
                ChatTurn(role="user", content=request.question),
                ChatTurn(role="assistant", content=f"Fake MCP answer: {request.question}"),
            ],
        )


def _patch_dependencies() -> None:
    dependencies.get_screener_service = lambda: FakeScreenerService()
    dependencies.get_strategy_service = lambda: FakeStrategyService()
    dependencies.get_daily_review_service = lambda: FakeDailyReviewService()
    dependencies.get_chat_service = lambda: FakeChatService()
    intelligence_common.get_chat_service = lambda: FakeChatService()
    chat_answer_tool.get_chat_service = lambda: FakeChatService()


async def _run() -> None:
    _patch_dependencies()
    config = load_config()
    setup_logging(config)
    server = MCPServer(config)
    await server.start()


if __name__ == "__main__":
    asyncio.run(_run())
