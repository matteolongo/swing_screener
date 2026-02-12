"""Set active strategy tool for MCP server.

This module provides the SetActiveStrategyTool for changing the
currently active trading strategy.
"""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.strategy._common import get_strategy_service, logger


class SetActiveStrategyTool(BaseTool):
    """Set the active trading strategy."""
    
    @property
    def feature(self) -> str:
        return "strategy"
    
    @property
    def name(self) -> str:
        return "set_active_strategy"
    
    @property
    def description(self) -> str:
        return "Set a trading strategy as active for use in screening and trading operations."
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "strategy_id": {
                    "type": "string",
                    "description": "The unique identifier of the strategy to set as active"
                }
            },
            "required": ["strategy_id"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> Any:
        """Execute set_active_strategy tool.
        
        Args:
            arguments: Tool input containing strategy_id
            
        Returns:
            The activated strategy object,
            or error dict if operation fails
        """
        # Validate input
        if "strategy_id" not in arguments:
            logger.error("Missing required parameter: strategy_id")
            return {"error": "Missing required parameter: strategy_id"}
        
        strategy_id = arguments.get("strategy_id")
        
        if not isinstance(strategy_id, str) or not strategy_id.strip():
            logger.error(f"Invalid strategy_id: must be a non-empty string, got {type(strategy_id).__name__}")
            return {"error": "strategy_id must be a non-empty string"}
        
        service = get_strategy_service()
        
        try:
            # Import the request model
            from api.models.strategy import ActiveStrategyRequest
            
            request = ActiveStrategyRequest(strategy_id=strategy_id.strip())
            strategy = service.set_active_strategy(request)
            return {"strategy": strategy}
        except Exception as e:
            logger.error(f"Error setting active strategy {strategy_id}: {e}")
            return {"error": str(e)}
