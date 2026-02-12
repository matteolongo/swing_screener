"""Get active strategy tool for MCP server.

This module provides the GetActiveStrategyTool for retrieving the
currently active trading strategy.
"""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.strategy._common import get_strategy_service, logger


class GetActiveStrategyTool(BaseTool):
    """Get the currently active trading strategy."""
    
    @property
    def feature(self) -> str:
        return "strategy"
    
    @property
    def name(self) -> str:
        return "get_active_strategy"
    
    @property
    def description(self) -> str:
        return "Get the currently active trading strategy being used for screening and trading."
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {},
            "required": []
        }
    
    async def execute(self, arguments: dict[str, Any]) -> Any:
        """Execute get_active_strategy tool.
        
        Args:
            arguments: Tool input (no parameters required)
            
        Returns:
            Currently active strategy object,
            or error dict if operation fails
        """
        service = get_strategy_service()
        
        try:
            strategy = service.get_active_strategy()
            return {"strategy": strategy}
        except Exception as e:
            logger.error(f"Error getting active strategy: {e}")
            return {"error": str(e)}
