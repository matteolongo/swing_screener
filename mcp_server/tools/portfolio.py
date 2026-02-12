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


class SuggestPositionStopTool(BaseTool):
    """Get AI-powered stop price suggestion for a position."""
    
    @property
    def feature(self) -> str:
        return "portfolio"
    
    @property
    def name(self) -> str:
        return "suggest_position_stop"
    
    @property
    def description(self) -> str:
        return ("Get AI-powered stop price suggestion for an open position based on "
                "trailing stop rules, R-multiples, and technical indicators.")
    
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
        """Execute suggest_position_stop tool.
        
        Args:
            arguments: Tool input with position_id
            
        Returns:
            Suggested stop update with reasoning
        """
        service = _get_portfolio_service()
        position_id = arguments.get("position_id")
        
        if not position_id:
            return {"error": "position_id is required"}
        
        try:
            result = service.suggest_position_stop(position_id)
            return result.model_dump()
        except Exception as e:
            logger.error(f"Error suggesting stop for position {position_id}: {e}")
            return {"error": str(e)}


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
        
        service = _get_portfolio_service()
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
        
        service = _get_portfolio_service()
        order_id = arguments.get("order_id")
        filled_price = arguments.get("filled_price")
        filled_date = arguments.get("filled_date")
        stop_price = arguments.get("stop_price")
        
        if not order_id or filled_price is None or not filled_date:
            return {"error": "order_id, filled_price, and filled_date are required"}
        
        try:
            request = FillOrderRequest(
                filled_price=filled_price,
                filled_date=filled_date,
                stop_price=stop_price
            )
            result = service.fill_order(order_id, request)
            return result
        except Exception as e:
            logger.error(f"Error filling order {order_id}: {e}")
            return {"error": str(e)}


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
        service = _get_portfolio_service()
        order_id = arguments.get("order_id")
        
        if not order_id:
            return {"error": "order_id is required"}
        
        try:
            result = service.cancel_order(order_id)
            return result
        except Exception as e:
            logger.error(f"Error cancelling order {order_id}: {e}")
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
        SuggestPositionStopTool(),
        ClosePositionTool(),
        FillOrderTool(),
        CancelOrderTool(),
    ]
