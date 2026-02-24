"""Delete strategy tool."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.strategy._common import get_strategy_service, logger


class DeleteStrategyTool(BaseTool):
    """Delete a trading strategy."""
    
    @property
    def feature(self) -> str:
        return "strategy"
    
    @property
    def name(self) -> str:
        return "delete_strategy"
    
    @property
    def description(self) -> str:
        return "Delete a trading strategy. Default strategy cannot be deleted."
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "strategy_id": {
                    "type": "string",
                    "description": "Strategy ID to delete"
                }
            },
            "required": ["strategy_id"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute delete_strategy tool."""
        service = get_strategy_service()
        strategy_id = arguments["strategy_id"]
        
        try:
            service.delete_strategy(strategy_id)
            return {
                "success": True,
                "strategy_id": strategy_id,
                "message": f"Strategy {strategy_id} deleted successfully"
            }
        except Exception as e:
            logger.error(f"Error deleting strategy {strategy_id}: {e}")
            return {"error": str(e), "success": False}
