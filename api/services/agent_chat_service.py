"""Workspace chat service that routes requests through the persistent agent MCP path."""
from __future__ import annotations

from api.models.chat import ChatAnswerRequest, ChatAnswerResponse
from api.services.agent_runtime import AgentRuntime


class AgentChatService:
    """Use the persistent backend agent and MCP transport as the workspace chat runtime."""

    def __init__(self, runtime: AgentRuntime) -> None:
        self._runtime = runtime

    async def answer(self, request: ChatAnswerRequest) -> ChatAnswerResponse:
        return await self._runtime.answer(request)
