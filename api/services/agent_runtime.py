"""Persistent backend agent runtime for workspace chat."""
from __future__ import annotations

import asyncio
import logging

from agent.agent import SwingScreenerAgent
from api.models.chat import ChatAnswerRequest, ChatAnswerResponse

logger = logging.getLogger(__name__)


class AgentRuntime:
    """Keep a single lazy-started agent instance alive for API-side chat requests."""

    def __init__(self) -> None:
        self._agent: SwingScreenerAgent | None = None
        self._lock = asyncio.Lock()
        self._restart_count = 0
        self._last_error: str | None = None
        self._status = "stopped"

    async def answer(self, request: ChatAnswerRequest) -> ChatAnswerResponse:
        async with self._lock:
            agent = await self._ensure_started()
            try:
                return await self._run_request_locked(agent, request)
            except Exception as exc:
                await self._restart_after_failure_locked(exc)

            retry_agent = await self._ensure_started()
            try:
                return await self._run_request_locked(retry_agent, request)
            except Exception as exc:
                self._status = "error"
                self._last_error = self._format_error(exc)
                await self._discard_agent_locked()
                raise

    async def snapshot(self) -> dict[str, object]:
        async with self._lock:
            return {
                "status": self._status,
                "running": self._agent is not None,
                "restart_count": self._restart_count,
                "last_error": self._last_error,
            }

    async def shutdown(self) -> None:
        async with self._lock:
            await self._discard_agent_locked()
            self._status = "stopped"
            self._last_error = None

    async def _run_request_locked(
        self,
        agent: SwingScreenerAgent,
        request: ChatAnswerRequest,
    ) -> ChatAnswerResponse:
        result = await agent.ask(
            request.question,
            conversation=request.conversation,
            selected_ticker=request.selected_ticker,
            workspace_snapshot=request.workspace_snapshot,
        )
        response = ChatAnswerResponse.model_validate(result)
        self._status = "ready"
        self._last_error = None
        return response

    async def _restart_after_failure_locked(self, exc: Exception) -> None:
        self._restart_count += 1
        self._status = "error"
        self._last_error = self._format_error(exc)
        await self._discard_agent_locked()

    async def _discard_agent_locked(self) -> None:
        if self._agent is None:
            return

        agent = self._agent
        self._agent = None
        try:
            await agent.stop()
        except Exception:
            logger.warning("Failed to stop agent runtime cleanly", exc_info=True)

    async def _ensure_started(self) -> SwingScreenerAgent:
        if self._agent is not None:
            return self._agent

        agent = SwingScreenerAgent()
        try:
            await agent.start()
        except Exception as exc:
            self._status = "error"
            self._last_error = self._format_error(exc)
            try:
                await agent.stop()
            except Exception:
                logger.warning("Failed to stop agent after startup error", exc_info=True)
            raise

        self._agent = agent
        self._status = "ready"
        return agent

    @staticmethod
    def _format_error(exc: Exception) -> str:
        message = str(exc).strip()
        if not message:
            return type(exc).__name__
        return f"{type(exc).__name__}: {message}"
