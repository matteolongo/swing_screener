"""Explain a symbol using cached intelligence education."""
from __future__ import annotations

from typing import Any

from api.models.intelligence import IntelligenceExplainSymbolRequest
from mcp_server.tools.base import BaseTool
from mcp_server.tools.intelligence._common import get_intelligence_service, logger


class ExplainSymbolTool(BaseTool):
    @property
    def feature(self) -> str:
        return "intelligence"

    @property
    def name(self) -> str:
        return "explain_symbol"

    @property
    def description(self) -> str:
        return "Explain the currently cached intelligence thesis for a symbol."

    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "symbol": {"type": "string"},
                "asof_date": {"type": "string"},
                "candidate_context": {"type": "object"},
            },
            "required": ["symbol"],
        }

    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        service = get_intelligence_service()
        try:
            request = IntelligenceExplainSymbolRequest.model_validate(arguments)
            result = service.explain_symbol(request)
            return result.model_dump(mode="json")
        except Exception as exc:
            logger.error("Error explaining symbol: %s", exc)
            return {"error": str(exc)}
