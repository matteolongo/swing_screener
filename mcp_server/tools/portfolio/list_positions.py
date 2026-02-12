"""List positions tool."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.portfolio._common import get_portfolio_service, logger


class ListPositionsTool(BaseTool):
    """List all trading positions with optional status filter."""
    
    @property
    def feature(self) -> str:
        return "portfolio"
    
    @property
    def name(self) -> str:
        return "list_positions"
    
    @property
    def description(self) -> str:
        return "List all trading positions. Can filter by status (open/closed/all)."
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["open", "closed"],
                    "description": "Filter positions by status. Omit to get all positions."
                }
            }
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute list_positions tool.
        
        Args:
            arguments: Tool input with optional 'status' filter
            
        Returns:
            Dictionary with positions list and asof date
        """
        service = get_portfolio_service()
        status = arguments.get("status")
        
        try:
            result = service.list_positions(status=status)
            return result.model_dump()
        except Exception as e:
            logger.error(f"Error listing positions: {e}")
            return {
                "error": str(e),
                "positions": [],
                "asof": None
            }
