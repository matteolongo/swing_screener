"""Update position stop tool."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.portfolio._common import get_portfolio_service, logger


class UpdatePositionStopTool(BaseTool):
    """Update the stop price for a position (trailing stop)."""
    
    @property
    def feature(self) -> str:
        return "portfolio"
    
    @property
    def name(self) -> str:
        return "update_position_stop"
    
    @property
    def description(self) -> str:
        return ("Update (raise) the stop price for an open position. "
                "Stop can only move up (trailing stop logic). "
                "Creates a new stop order and cancels old ones.")
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "position_id": {
                    "type": "string",
                    "description": "Unique identifier of the position"
                },
                "new_stop": {
                    "type": "number",
                    "description": "New stop price (must be higher than current stop)",
                    "minimum": 0.01
                },
                "reason": {
                    "type": "string",
                    "description": "Reason for updating the stop (optional)",
                    "default": ""
                }
            },
            "required": ["position_id", "new_stop"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute update_position_stop tool.
        
        Args:
            arguments: Tool input with position_id, new_stop, and optional reason
            
        Returns:
            Update result with old/new stop prices and order IDs
        """
        from api.models.portfolio import UpdateStopRequest
        
        service = get_portfolio_service()
        position_id = arguments.get("position_id")
        new_stop = arguments.get("new_stop")
        reason = arguments.get("reason", "")
        
        if not position_id or new_stop is None:
            return {"error": "position_id and new_stop are required"}
        
        try:
            request = UpdateStopRequest(new_stop=new_stop, reason=reason)
            result = service.update_position_stop(position_id, request)
            return result
        except Exception as e:
            logger.error(f"Error updating stop for position {position_id}: {e}")
            return {"error": str(e)}
