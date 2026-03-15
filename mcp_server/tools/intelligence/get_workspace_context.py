"""Get normalized workspace context for external assistants."""
from __future__ import annotations

from typing import Any

from api.models.chat import WorkspaceSnapshot
from mcp_server.tools.base import BaseTool
from mcp_server.tools.intelligence._common import get_workspace_context_service, logger


class GetWorkspaceContextTool(BaseTool):
    @property
    def feature(self) -> str:
        return "intelligence"

    @property
    def name(self) -> str:
        return "get_workspace_context"

    @property
    def description(self) -> str:
        return "Build a normalized read-only workspace context from portfolio state, cached intelligence, and an optional UI screener snapshot."

    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "selected_ticker": {
                    "type": "string",
                    "description": "Optional selected ticker to focus the context.",
                },
                "workspace_snapshot": {
                    "type": "object",
                    "description": "Optional current screener snapshot from the UI.",
                },
            },
        }

    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        service = get_workspace_context_service()
        try:
            snapshot_payload = arguments.get("workspace_snapshot")
            snapshot = (
                WorkspaceSnapshot.model_validate(snapshot_payload)
                if isinstance(snapshot_payload, dict)
                else None
            )
            context = service.build_context(
                selected_ticker=arguments.get("selected_ticker"),
                workspace_snapshot=snapshot,
            )
            return context.model_dump(mode="json")
        except Exception as exc:
            logger.error("Error building workspace context: %s", exc)
            return {"error": str(exc)}
