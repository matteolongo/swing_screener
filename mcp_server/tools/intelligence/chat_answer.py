"""Read-only workspace chat answer tool."""
from __future__ import annotations

from typing import Any

from api.models.chat import ChatAnswerRequest
from mcp_server.tools.base import BaseTool
from mcp_server.tools.intelligence._common import get_chat_service, logger


class ChatAnswerTool(BaseTool):
    @property
    def feature(self) -> str:
        return "intelligence"

    @property
    def name(self) -> str:
        return "chat_answer"

    @property
    def description(self) -> str:
        return "Answer a read-only workspace chat question using portfolio state, screener snapshot, and cached intelligence context."

    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "question": {"type": "string"},
                "conversation": {
                    "type": "array",
                    "items": {"type": "object"},
                },
                "selected_ticker": {"type": "string"},
                "workspace_snapshot": {"type": "object"},
            },
            "required": ["question"],
        }

    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        service = get_chat_service()
        try:
            request = ChatAnswerRequest.model_validate(arguments)
            result = service.answer(request)
            return result.model_dump(mode="json")
        except Exception as exc:
            logger.error("Error answering workspace chat question: %s", exc)
            return {"error": str(exc)}
