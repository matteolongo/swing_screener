"""Create strategy tool."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.strategy._common import get_strategy_service, logger
from api.models.strategy import StrategyCreateRequest


class CreateStrategyTool(BaseTool):
    """Create a new trading strategy."""
    
    @property
    def feature(self) -> str:
        return "strategy"
    
    @property
    def name(self) -> str:
        return "create_strategy"
    
    @property
    def description(self) -> str:
        return "Create a new trading strategy with custom configuration."
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Strategy name"
                },
                "description": {
                    "type": "string",
                    "description": "Strategy description"
                },
                "universe": {
                    "type": "object",
                    "description": "Universe configuration"
                },
                "filters": {
                    "type": "object",
                    "description": "Filter criteria"
                },
                "manage": {
                    "type": "object",
                    "description": "Position management rules"
                }
            },
            "required": ["name"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute create_strategy tool."""
        service = get_strategy_service()
        
        try:
            request = StrategyCreateRequest(**arguments)
            result = service.create_strategy(request)
            return {"strategy": result}
        except Exception as e:
            logger.error(f"Error creating strategy: {e}")
            return {"error": str(e)}
