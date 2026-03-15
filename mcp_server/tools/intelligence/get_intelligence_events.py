"""Get cached intelligence events."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.intelligence._common import get_intelligence_service, logger


class GetIntelligenceEventsTool(BaseTool):
    @property
    def feature(self) -> str:
        return "intelligence"

    @property
    def name(self) -> str:
        return "get_intelligence_events"

    @property
    def description(self) -> str:
        return "Return cached intelligence events for an optional as-of date, symbols, and event filters."

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
                "event_types": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "min_materiality": {"type": "number"},
            },
        }

    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        service = get_intelligence_service()
        try:
            result = service.get_events(
                asof_date=arguments.get("asof_date"),
                symbols=arguments.get("symbols"),
                event_types=arguments.get("event_types"),
                min_materiality=arguments.get("min_materiality"),
            )
            return result.model_dump(mode="json")
        except Exception as exc:
            logger.error("Error loading intelligence events: %s", exc)
            return {"error": str(exc), "events": [], "asof_date": None}
