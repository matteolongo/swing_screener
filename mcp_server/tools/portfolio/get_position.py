"""Get position tool."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.portfolio._common import get_portfolio_service, logger


class GetPositionTool(BaseTool):
    """Get details of a specific position by ID."""
    
    @property
    def feature(self) -> str:
        return "portfolio"
    
    @property
    def name(self) -> str:
        return "get_position"
    
    @property
    def description(self) -> str:
        return "Get detailed information about a specific trading position by its ID."
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "position_id": {
                    "type": "string",
                    "description": "Unique identifier of the position"
                }
            },
            "required": ["position_id"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute get_position tool.
        
        Args:
            arguments: Tool input with 'position_id'
            
        Returns:
            Position details dictionary
        """
        service = get_portfolio_service()
        position_id = arguments.get("position_id")
        
        if not position_id:
            return {"error": "position_id is required"}
        
        try:
            result = service.get_position(position_id)
            return result.model_dump()
        except Exception as e:
            logger.error(f"Error getting position {position_id}: {e}")
            return {"error": str(e)}
