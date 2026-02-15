"""Strategy tools for MCP server.

This package provides MCP tools for managing and using trading strategies.
"""
from __future__ import annotations

from mcp_server.tools.base import BaseTool
from mcp_server.tools.strategy.list_strategies import ListStrategiesTool
from mcp_server.tools.strategy.get_strategy import GetStrategyTool
from mcp_server.tools.strategy.get_active_strategy import GetActiveStrategyTool
from mcp_server.tools.strategy.set_active_strategy import SetActiveStrategyTool

__all__ = [
    "ListStrategiesTool",
    "GetStrategyTool",
    "GetActiveStrategyTool",
    "SetActiveStrategyTool",
    "get_strategy_tools",
]


def get_strategy_tools() -> list[BaseTool]:
    """Get all strategy tools.
    
    Returns:
        List of strategy tool instances
    """
    return [
        ListStrategiesTool(),
        GetStrategyTool(),
        GetActiveStrategyTool(),
        SetActiveStrategyTool(),
    ]
