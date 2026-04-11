"""Portfolio tools for MCP server.

This package provides MCP tools for portfolio management including
positions and live DeGiro order reads.
"""
from __future__ import annotations

from mcp_server.tools.base import BaseTool
from mcp_server.tools.portfolio.list_positions import ListPositionsTool
from mcp_server.tools.portfolio.get_position import GetPositionTool
from mcp_server.tools.portfolio.update_position_stop import UpdatePositionStopTool
from mcp_server.tools.portfolio.list_orders import ListOrdersTool
from mcp_server.tools.portfolio.suggest_position_stop import SuggestPositionStopTool
from mcp_server.tools.portfolio.close_position import ClosePositionTool


def get_portfolio_tools() -> list[BaseTool]:
    """Get all portfolio tools."""
    return [
        ListPositionsTool(),
        GetPositionTool(),
        UpdatePositionStopTool(),
        ListOrdersTool(),
        SuggestPositionStopTool(),
        ClosePositionTool(),
    ]


__all__ = [
    "get_portfolio_tools",
    "ListPositionsTool",
    "GetPositionTool",
    "UpdatePositionStopTool",
    "ListOrdersTool",
    "SuggestPositionStopTool",
    "ClosePositionTool",
]
