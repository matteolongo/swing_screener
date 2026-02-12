"""Create order tool for MCP server.

This module provides the CreateOrderTool for creating new orders.
"""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.portfolio._common import get_portfolio_service, logger


class CreateOrderTool(BaseTool):
    """Create a new order."""
    
    @property
    def feature(self) -> str:
        return "portfolio"
    
    @property
    def name(self) -> str:
        return "create_order"
    
    @property
    def description(self) -> str:
        return ("Create a new order (entry or exit). "
                "Supports LIMIT, STOP, and MARKET order types.")
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol (e.g., AAPL, MSFT)"
                },
                "order_type": {
                    "type": "string",
                    "enum": ["LIMIT", "STOP", "MARKET"],
                    "description": "Type of order"
                },
                "quantity": {
                    "type": "integer",
                    "description": "Number of shares",
                    "minimum": 1
                },
                "limit_price": {
                    "type": "number",
                    "description": "Limit price (required for LIMIT orders)",
                    "minimum": 0.01
                },
                "stop_price": {
                    "type": "number",
                    "description": "Stop price (required for STOP orders)",
                    "minimum": 0.01
                },
                "notes": {
                    "type": "string",
                    "description": "Optional notes about the order",
                    "default": ""
                },
                "order_kind": {
                    "type": "string",
                    "enum": ["entry", "stop", "target"],
                    "description": "Kind of order (entry/stop/target). Optional."
                }
            },
            "required": ["ticker", "order_type", "quantity"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute create_order tool.
        
        Args:
            arguments: Tool input with order details
            
        Returns:
            Created order details
        """
        from api.models.portfolio import CreateOrderRequest
        
        service = get_portfolio_service()
        
        try:
            request = CreateOrderRequest(
                ticker=arguments["ticker"],
                order_type=arguments["order_type"],
                quantity=arguments["quantity"],
                limit_price=arguments.get("limit_price"),
                stop_price=arguments.get("stop_price"),
                notes=arguments.get("notes", ""),
                order_kind=arguments.get("order_kind")
            )
            result = service.create_order(request)
            return result.model_dump()
        except Exception as e:
            logger.error(f"Error creating order: {e}")
            return {"error": str(e)}
