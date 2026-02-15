"""List strategies tool for MCP server.

This module provides the ListStrategiesTool for listing all available
trading strategies.
"""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.strategy._common import get_strategy_service, logger


class ListStrategiesTool(BaseTool):
    """List all available trading strategies."""
    
    @property
    def feature(self) -> str:
        return "strategy"
    
    @property
    def name(self) -> str:
        return "list_strategies"
    
    @property
    def description(self) -> str:
        return "List all available trading strategies with their configurations and details."
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {},
            "required": []
        }
    
    async def execute(self, arguments: dict[str, Any]) -> Any:
        """Execute list_strategies tool.
        
        Args:
            arguments: Tool input (no parameters required)
            
        Returns:
            List of strategy objects with all configurations,
            or error dict if operation fails
        """
        service = get_strategy_service()
        
        try:
            strategies = service.list_strategies()
            return {"strategies": strategies}
        except Exception as e:
            logger.error(f"Error listing strategies: {e}")
            return {"error": str(e)}
