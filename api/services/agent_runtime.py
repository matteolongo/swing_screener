"""Persistent backend agent runtime for workspace chat."""
from __future__ import annotations

import asyncio
from typing import Optional

from agent.agent import SwingScreenerAgent
from api.models.chat import ChatAnswerRequest, ChatAnswerResponse


class AgentRuntime:
    """Keep a single lazy-started agent instance alive for API-side chat requests."""

    def __init__(self, server_command: Optional[list[str]] = None) -> None:
        self._server_command = list(server_command) if server_command is not None else None
        self._agent: SwingScreenerAgent | None = None
        self._lock = asyncio.Lock()

    async def answer(self, request: ChatAnswerRequest) -> ChatAnswerResponse:
        async with self._lock:
            agent = await self._ensure_started()
            result = await agent.ask(
                request.question,
                conversation=request.conversation,
                selected_ticker=request.selected_ticker,
                workspace_snapshot=request.workspace_snapshot,
            )
            return ChatAnswerResponse.model_validate(result)

    async def shutdown(self) -> None:
        async with self._lock:
            if self._agent is None:
                return
            agent = self._agent
            self._agent = None
            await agent.stop()

    async def _ensure_started(self) -> SwingScreenerAgent:
        if self._agent is not None:
            return self._agent

        agent = SwingScreenerAgent(server_command=self._server_command)
        try:
            await agent.start()
        except Exception:
            await agent.stop()
            raise

        self._agent = agent
        return agent
