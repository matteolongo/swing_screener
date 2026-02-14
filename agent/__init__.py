"""Swing Screener Agent - AI-driven workflow automation via MCP.

This package provides an intelligent agent that connects to the MCP server
to automate trading workflows including:
- Screening for trade candidates
- Order creation and management
- Position management and stop updates
- Educational insights and analysis

The agent acts as an MCP client, orchestrating tool calls to mimic
the daily trading routine while providing explanations and feedback.
"""
from __future__ import annotations

__version__ = "0.1.0"

from agent.client import MCPClient
from agent.agent import SwingScreenerAgent
from agent.workflows import (
    ScreeningWorkflow,
    OrderManagementWorkflow,
    PositionManagementWorkflow,
)

__all__ = [
    "MCPClient",
    "SwingScreenerAgent",
    "ScreeningWorkflow",
    "OrderManagementWorkflow",
    "PositionManagementWorkflow",
    "__version__",
]
