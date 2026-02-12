"""Cancel order tool for MCP server.

This module provides the CancelOrderTool for cancelling pending orders.
"""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.portfolio._common import get_portfolio_service, logger


class CancelOrderTool(BaseTool):
    """Cancel a pending order."""
    
    @property
    def feature(self) -> str:
        return "portfolio"
    
    @property
    def name(self) -> str:
        return "cancel_order"
    
    @property
    def description(self) -> str:
        return "Cancel a pending order. Only pending orders can be cancelled."
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "order_id": {
                    "type": "string",
                    "description": "Unique identifier of the order to cancel"
                }
            },
            "required": ["order_id"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute cancel_order tool.
        
        Args:
            arguments: Tool input with order_id
            
        Returns:
            Cancel result with status
        """
        service = get_portfolio_service()
        order_id = arguments.get("order_id")
        
        if not order_id:
            return {"error": "order_id is required"}
        
        try:
            result = service.cancel_order(order_id)
            return result
        except Exception as e:
            logger.error(f"Error cancelling order {order_id}: {e}")
            return {"error": str(e)}
