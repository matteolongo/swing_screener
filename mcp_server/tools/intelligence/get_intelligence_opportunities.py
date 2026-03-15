"""Get cached intelligence opportunities."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.intelligence._common import get_intelligence_service, logger


class GetIntelligenceOpportunitiesTool(BaseTool):
    @property
    def feature(self) -> str:
        return "intelligence"

    @property
    def name(self) -> str:
        return "get_intelligence_opportunities"

    @property
    def description(self) -> str:
        return "Return cached intelligence opportunities for an optional as-of date and symbol scope."

    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "asof_date": {"type": "string"},
                "symbols": {
                    "type": "array",
                    "items": {"type": "string"},
                },
            },
        }

    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        service = get_intelligence_service()
        try:
            result = service.get_opportunities(
                asof_date=arguments.get("asof_date"),
                symbols=arguments.get("symbols"),
            )
            return result.model_dump(mode="json")
        except Exception as exc:
            logger.error("Error loading intelligence opportunities: %s", exc)
            return {"error": str(exc), "opportunities": [], "asof_date": None}
