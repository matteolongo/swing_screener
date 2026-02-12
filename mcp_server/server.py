"""MCP Server implementation for Swing Screener.

This module implements a Model Context Protocol server that exposes
screening, order management, and position management capabilities as tools
that can be called by AI agents.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Import API services
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from api.services.screener_service import ScreenerService
from api.services.portfolio_service import PortfolioService
from api.services.config_service import ConfigService
from api.models.screener import ScreenerRequest
from api.models.portfolio import (
    CreateOrderRequest,
    FillOrderRequest,
    UpdateStopRequest,
    ClosePositionRequest,
)

logger = logging.getLogger(__name__)

# Initialize services
screener_service = ScreenerService()
portfolio_service = PortfolioService()
config_service = ConfigService()

# Create MCP server instance
app = Server("swing-screener-mcp")


# ===== Screener Tools =====

@app.list_tools()
async def list_tools() -> list[Tool]:
    """List available MCP tools."""
    return [
        Tool(
            name="list_universes",
            description="List all available stock universes for screening",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="run_screener",
            description="Run the screener on a universe of stocks. Returns ranked candidates with scores and indicators.",
            inputSchema={
                "type": "object",
                "properties": {
                    "universe": {
                        "type": "string",
                        "description": "Universe name (e.g., 'mega_all', 'sp500')",
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of candidates to return (default: 20)",
                        "default": 20,
                    },
                },
                "required": ["universe"],
            },
        ),
        Tool(
            name="preview_order",
            description="Preview order calculations (position size, shares, risk) for a candidate trade",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticker": {"type": "string", "description": "Stock ticker symbol"},
                    "entry_price": {"type": "number", "description": "Intended entry price"},
                    "stop_price": {"type": "number", "description": "Stop loss price"},
                    "account_size": {
                        "type": "number",
                        "description": "Account size in dollars (default: 50000)",
                        "default": 50000,
                    },
                    "risk_pct": {
                        "type": "number",
                        "description": "Risk percentage per trade (default: 0.01 = 1%)",
                        "default": 0.01,
                    },
                },
                "required": ["ticker", "entry_price", "stop_price"],
            },
        ),
        # Position Management Tools
        Tool(
            name="list_positions",
            description="Get all open positions with their current status and R-values",
            inputSchema={
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "Filter by status: 'open' or 'closed' (optional)",
                        "enum": ["open", "closed"],
                    },
                },
                "required": [],
            },
        ),
        Tool(
            name="get_position",
            description="Get details for a specific position by ID",
            inputSchema={
                "type": "object",
                "properties": {
                    "position_id": {"type": "string", "description": "Position ID"},
                },
                "required": ["position_id"],
            },
        ),
        Tool(
            name="get_position_stop_suggestion",
            description="Get suggested stop price update for a position based on manage rules",
            inputSchema={
                "type": "object",
                "properties": {
                    "position_id": {"type": "string", "description": "Position ID"},
                },
                "required": ["position_id"],
            },
        ),
        Tool(
            name="update_position_stop",
            description="Update stop price for a position (trailing stops only)",
            inputSchema={
                "type": "object",
                "properties": {
                    "position_id": {"type": "string", "description": "Position ID"},
                    "new_stop": {"type": "number", "description": "New stop price"},
                    "reason": {
                        "type": "string",
                        "description": "Reason for stop update (optional)",
                    },
                },
                "required": ["position_id", "new_stop"],
            },
        ),
        Tool(
            name="close_position",
            description="Close a position at current market price",
            inputSchema={
                "type": "object",
                "properties": {
                    "position_id": {"type": "string", "description": "Position ID"},
                    "close_price": {"type": "number", "description": "Exit price"},
                    "reason": {
                        "type": "string",
                        "description": "Reason for closing (optional)",
                    },
                },
                "required": ["position_id", "close_price"],
            },
        ),
        # Order Management Tools
        Tool(
            name="list_orders",
            description="Get all orders with optional filtering by status or ticker",
            inputSchema={
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "Filter by status: 'pending', 'filled', 'cancelled' (optional)",
                        "enum": ["pending", "filled", "cancelled"],
                    },
                    "ticker": {
                        "type": "string",
                        "description": "Filter by ticker symbol (optional)",
                    },
                },
                "required": [],
            },
        ),
        Tool(
            name="get_order",
            description="Get details for a specific order by ID",
            inputSchema={
                "type": "object",
                "properties": {
                    "order_id": {"type": "string", "description": "Order ID"},
                },
                "required": ["order_id"],
            },
        ),
        Tool(
            name="create_order",
            description="Create a new order for a trade candidate",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticker": {"type": "string", "description": "Stock ticker symbol"},
                    "order_type": {
                        "type": "string",
                        "description": "Order type: LIMIT or STOP_LIMIT",
                        "enum": ["LIMIT", "STOP_LIMIT"],
                    },
                    "entry_price": {"type": "number", "description": "Entry price"},
                    "stop_price": {"type": "number", "description": "Stop loss price"},
                    "limit_price": {
                        "type": "number",
                        "description": "Limit price for LIMIT orders (optional)",
                    },
                    "quantity": {"type": "integer", "description": "Number of shares"},
                    "notes": {
                        "type": "string",
                        "description": "Additional notes (optional)",
                    },
                },
                "required": ["ticker", "order_type", "entry_price", "stop_price", "quantity"],
            },
        ),
        Tool(
            name="fill_order",
            description="Mark an order as filled at a specific price",
            inputSchema={
                "type": "object",
                "properties": {
                    "order_id": {"type": "string", "description": "Order ID"},
                    "fill_price": {"type": "number", "description": "Actual fill price"},
                },
                "required": ["order_id", "fill_price"],
            },
        ),
        Tool(
            name="cancel_order",
            description="Cancel a pending order",
            inputSchema={
                "type": "object",
                "properties": {
                    "order_id": {"type": "string", "description": "Order ID"},
                },
                "required": ["order_id"],
            },
        ),
        # Configuration Tools
        Tool(
            name="get_config",
            description="Get current application configuration",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    """Handle tool calls from the agent."""
    try:
        result = None
        
        # Screener Tools
        if name == "list_universes":
            result = screener_service.list_universes()
        
        elif name == "run_screener":
            request = ScreenerRequest(
                universe=arguments["universe"],
                max_results=arguments.get("max_results", 20),
            )
            result = screener_service.run_screener(request)
            # Convert to dict for serialization
            result = result.model_dump()
        
        elif name == "preview_order":
            result = screener_service.preview_order(
                ticker=arguments["ticker"],
                entry_price=arguments["entry_price"],
                stop_price=arguments["stop_price"],
                account_size=arguments.get("account_size", 50000),
                risk_pct=arguments.get("risk_pct", 0.01),
            )
            result = result.model_dump()
        
        # Position Management Tools
        elif name == "list_positions":
            response = portfolio_service.list_positions(
                status=arguments.get("status")
            )
            result = response.model_dump()
        
        elif name == "get_position":
            position = portfolio_service.get_position(arguments["position_id"])
            result = position.model_dump()
        
        elif name == "get_position_stop_suggestion":
            suggestion = portfolio_service.suggest_position_stop(
                arguments["position_id"]
            )
            result = suggestion.model_dump()
        
        elif name == "update_position_stop":
            request = UpdateStopRequest(
                new_stop=arguments["new_stop"],
                reason=arguments.get("reason"),
            )
            result = portfolio_service.update_position_stop(
                arguments["position_id"], request
            )
            result = result.model_dump()
        
        elif name == "close_position":
            request = ClosePositionRequest(
                close_price=arguments["close_price"],
                reason=arguments.get("reason"),
            )
            result = portfolio_service.close_position(
                arguments["position_id"], request
            )
            result = result.model_dump()
        
        # Order Management Tools
        elif name == "list_orders":
            response = portfolio_service.list_orders(
                status=arguments.get("status"),
                ticker=arguments.get("ticker"),
            )
            result = response.model_dump()
        
        elif name == "get_order":
            order = portfolio_service.get_order(arguments["order_id"])
            result = order.model_dump()
        
        elif name == "create_order":
            request = CreateOrderRequest(
                ticker=arguments["ticker"],
                order_type=arguments["order_type"],
                entry_price=arguments["entry_price"],
                stop_price=arguments["stop_price"],
                limit_price=arguments.get("limit_price"),
                quantity=arguments["quantity"],
                notes=arguments.get("notes"),
            )
            order = portfolio_service.create_order(request)
            result = order.model_dump()
        
        elif name == "fill_order":
            request = FillOrderRequest(fill_price=arguments["fill_price"])
            result = portfolio_service.fill_order(
                arguments["order_id"], request
            )
            result = result.model_dump()
        
        elif name == "cancel_order":
            result = portfolio_service.cancel_order(arguments["order_id"])
            result = result.model_dump()
        
        # Configuration Tools
        elif name == "get_config":
            result = config_service.get_config()
            result = result.model_dump()
        
        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]
        
        # Format result as JSON
        result_json = json.dumps(result, indent=2, default=str)
        return [TextContent(type="text", text=result_json)]
    
    except Exception as e:
        logger.error(f"Error calling tool {name}: {e}", exc_info=True)
        error_msg = f"Error: {str(e)}"
        return [TextContent(type="text", text=error_msg)]


async def main():
    """Run the MCP server."""
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
