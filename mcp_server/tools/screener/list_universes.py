"""List universes tool for MCP server.

This module provides the ListUniversesTool for listing available
stock universes for screening.
"""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.screener._common import get_screener_service, logger


class ListUniversesTool(BaseTool):
    """List available stock universes for screening."""
    
    @property
    def feature(self) -> str:
        return "screener"
    
    @property
    def name(self) -> str:
        return "list_universes"
    
    @property
    def description(self) -> str:
        return "List all available stock universes that can be used for screening (e.g., mega_all, sp500, nasdaq100)."
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {}
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute list_universes tool.
        
        Args:
            arguments: Tool input (no parameters required)
            
        Returns:
            List of available universes
        """
        service = get_screener_service()
        
        try:
            result = service.list_universes()
            return result
        except Exception as e:
            logger.error(f"Error listing universes: {e}")
            return {"error": str(e), "universes": []}
