"""Fill order tool for MCP server.

This module provides the FillOrderTool for marking orders as filled.
"""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.portfolio._common import get_portfolio_service, logger


class FillOrderTool(BaseTool):
    """Mark an order as filled and optionally create a position."""
    
    @property
    def feature(self) -> str:
        return "portfolio"
    
    @property
    def name(self) -> str:
        return "fill_order"
    
    @property
    def description(self) -> str:
        return ("Mark an order as filled. For entry orders, creates a new position. "
                "Records fill price and date.")
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "order_id": {
                    "type": "string",
                    "description": "Unique identifier of the order"
                },
                "filled_price": {
                    "type": "number",
                    "description": "Price at which order was filled",
                    "minimum": 0.01
                },
                "filled_date": {
                    "type": "string",
                    "description": "Date when order was filled (YYYY-MM-DD format)",
                    "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
                },
                "stop_price": {
                    "type": "number",
                    "description": "Stop price for entry orders (required for entry fills)",
                    "minimum": 0.01
                },
                "fee_eur": {
                    "type": "number",
                    "description": "Execution fee in EUR (optional)",
                    "minimum": 0
                },
                "fill_fx_rate": {
                    "type": "number",
                    "description": "FX rate quote_ccy per EUR at fill time (optional, e.g. 1.18 for USD/EUR)",
                    "minimum": 0.000001
                }
            },
            "required": ["order_id", "filled_price", "filled_date"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute fill_order tool.
        
        Args:
            arguments: Tool input with order_id, filled_price, filled_date, and optional stop_price
            
        Returns:
            Fill result with position_id if entry order
        """
        from api.models.portfolio import FillOrderRequest
        
        service = get_portfolio_service()
        order_id = arguments.get("order_id")
        filled_price = arguments.get("filled_price")
        filled_date = arguments.get("filled_date")
        stop_price = arguments.get("stop_price")
        fee_eur = arguments.get("fee_eur")
        fill_fx_rate = arguments.get("fill_fx_rate")
        
        if not order_id or filled_price is None or not filled_date:
            return {"error": "order_id, filled_price, and filled_date are required"}
        
        try:
            request = FillOrderRequest(
                filled_price=filled_price,
                filled_date=filled_date,
                stop_price=stop_price,
                fee_eur=fee_eur,
                fill_fx_rate=fill_fx_rate,
            )
            result = service.fill_order(order_id, request)
            return result
        except Exception as e:
            logger.error(f"Error filling order {order_id}: {e}")
            return {"error": str(e)}
