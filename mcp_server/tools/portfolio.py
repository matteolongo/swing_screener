"""Portfolio tools for MCP server.

This module provides MCP tools for portfolio management including
positions and orders operations.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from mcp_server.tools.base import BaseTool

logger = logging.getLogger(__name__)


def _get_portfolio_service():
    """Lazy import and create portfolio service to avoid loading FastAPI at module level."""
    from mcp_server.dependencies import get_portfolio_service
    return get_portfolio_service()


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
        service = _get_portfolio_service()
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
        service = _get_portfolio_service()
        position_id = arguments.get("position_id")
        
        if not position_id:
            return {"error": "position_id is required"}
        
        try:
            result = service.get_position(position_id)
            return result.model_dump()
        except Exception as e:
            logger.error(f"Error getting position {position_id}: {e}")
            return {"error": str(e)}


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
        
        service = _get_portfolio_service()
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
        service = _get_portfolio_service()
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
        
        service = _get_portfolio_service()
        
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


def get_portfolio_tools() -> list[BaseTool]:
    """Get all portfolio tools.
    
    Returns:
        List of portfolio tool instances
    """
    return [
        ListPositionsTool(),
        GetPositionTool(),
        UpdatePositionStopTool(),
        ListOrdersTool(),
        CreateOrderTool(),
    ]
