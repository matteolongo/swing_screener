"""Close position tool for MCP server.

This module provides the ClosePositionTool for manually closing trading positions.
"""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.portfolio._common import get_portfolio_service, logger


class ClosePositionTool(BaseTool):
    """Manually close a trading position."""
    
    @property
    def feature(self) -> str:
        return "portfolio"
    
    @property
    def name(self) -> str:
        return "close_position"
    
    @property
    def description(self) -> str:
        return ("Manually close an open trading position. "
                "Records exit price and date, marks position as closed.")
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "position_id": {
                    "type": "string",
                    "description": "Unique identifier of the position"
                },
                "exit_price": {
                    "type": "number",
                    "description": "Price at which position was closed",
                    "minimum": 0.01
                },
                "reason": {
                    "type": "string",
                    "description": "Reason for closing the position (optional)",
                    "default": ""
                }
            },
            "required": ["position_id", "exit_price"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute close_position tool.
        
        Args:
            arguments: Tool input with position_id, exit_price, and optional reason
            
        Returns:
            Close result with status
        """
        from api.models.portfolio import ClosePositionRequest
        
        service = get_portfolio_service()
        position_id = arguments.get("position_id")
        exit_price = arguments.get("exit_price")
        reason = arguments.get("reason", "")
        
        if not position_id or exit_price is None:
            return {"error": "position_id and exit_price are required"}
        
        try:
            request = ClosePositionRequest(exit_price=exit_price, reason=reason)
            result = service.close_position(position_id, request)
            return result
        except Exception as e:
            logger.error(f"Error closing position {position_id}: {e}")
            return {"error": str(e)}
