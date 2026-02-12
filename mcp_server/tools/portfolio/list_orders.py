"""List orders tool."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.portfolio._common import get_portfolio_service, logger


class ListOrdersTool(BaseTool):
    """List all orders with optional filters."""
    
    @property
    def feature(self) -> str:
        return "portfolio"
    
    @property
    def name(self) -> str:
        return "list_orders"
    
    @property
    def description(self) -> str:
        return "List all orders. Can filter by status (pending/filled/cancelled) or ticker."
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["pending", "filled", "cancelled"],
                    "description": "Filter orders by status. Omit to get all orders."
                },
                "ticker": {
                    "type": "string",
                    "description": "Filter orders by ticker symbol. Omit to get all tickers."
                }
            }
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute list_orders tool.
        
        Args:
            arguments: Tool input with optional status and ticker filters
            
        Returns:
            Dictionary with orders list and asof date
        """
        service = get_portfolio_service()
        status = arguments.get("status")
        ticker = arguments.get("ticker")
        
        try:
            result = service.list_orders(status=status, ticker=ticker)
            return result.model_dump()
        except Exception as e:
            logger.error(f"Error listing orders: {e}")
            return {
                "error": str(e),
                "orders": [],
                "asof": None
            }
