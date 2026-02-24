"""Backtest tools for MCP server.

This package provides MCP tools for strategy backtesting and validation.
"""
from __future__ import annotations

from mcp_server.tools.base import BaseTool
from mcp_server.tools.backtest.run_quick_backtest import RunQuickBacktestTool
from mcp_server.tools.backtest.run_full_backtest import RunFullBacktestTool
from mcp_server.tools.backtest.list_backtest_simulations import ListBacktestSimulationsTool
from mcp_server.tools.backtest.get_backtest_simulation import GetBacktestSimulationTool
from mcp_server.tools.backtest.delete_backtest_simulation import DeleteBacktestSimulationTool


def get_backtest_tools() -> list[BaseTool]:
    """Get all backtest tools.
    
    Returns:
        List of backtest tool instances
    """
    return [
        RunQuickBacktestTool(),
        RunFullBacktestTool(),
        ListBacktestSimulationsTool(),
        GetBacktestSimulationTool(),
        DeleteBacktestSimulationTool(),
    ]


__all__ = [
    "get_backtest_tools",
    "RunQuickBacktestTool",
    "RunFullBacktestTool",
    "ListBacktestSimulationsTool",
    "GetBacktestSimulationTool",
    "DeleteBacktestSimulationTool",
]
