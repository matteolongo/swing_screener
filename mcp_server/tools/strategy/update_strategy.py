"""Update strategy tool."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.strategy._common import get_strategy_service, logger
from api.models.strategy import StrategyUpdateRequest


class UpdateStrategyTool(BaseTool):
    """Update an existing trading strategy."""
    
    @property
    def feature(self) -> str:
        return "strategy"
    
    @property
    def name(self) -> str:
        return "update_strategy"
    
    @property
    def description(self) -> str:
        return "Update an existing trading strategy's configuration."
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "strategy_id": {
                    "type": "string",
                    "description": "Strategy ID to update"
                },
                "name": {
                    "type": "string",
                    "description": "New strategy name"
                },
                "description": {
                    "type": "string",
                    "description": "New description"
                },
                "universe": {
                    "type": "object",
                    "description": "Updated universe config"
                },
                "filters": {
                    "type": "object",
                    "description": "Updated filters"
                },
                "manage": {
                    "type": "object",
                    "description": "Updated management rules"
                }
            },
            "required": ["strategy_id"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute update_strategy tool."""
        service = get_strategy_service()
        strategy_id = arguments.pop("strategy_id")
        
        try:
            request = StrategyUpdateRequest(**arguments)
            result = service.update_strategy(strategy_id, request)
            return {"strategy": result}
        except Exception as e:
            logger.error(f"Error updating strategy {strategy_id}: {e}")
            return {"error": str(e)}
