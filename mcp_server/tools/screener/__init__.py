"""Screener tools for MCP server.

This package provides MCP tools for stock screening and analysis.
"""
from __future__ import annotations

from mcp_server.tools.base import BaseTool
from mcp_server.tools.screener.list_universes import ListUniversesTool
from mcp_server.tools.screener.preview_order import PreviewOrderTool
from mcp_server.tools.screener.run_screener import RunScreenerTool

__all__ = [
    "RunScreenerTool",
    "ListUniversesTool",
    "PreviewOrderTool",
    "get_screener_tools",
]


def get_screener_tools() -> list[BaseTool]:
    """Get all screener tools.
    
    Returns:
        List of screener tool instances
    """
    return [
        RunScreenerTool(),
        ListUniversesTool(),
        PreviewOrderTool(),
    ]
