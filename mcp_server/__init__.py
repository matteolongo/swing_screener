"""Swing Screener MCP Server.

Model Context Protocol (MCP) server exposing Swing Screener functionality
to AI assistants and other MCP-compatible clients.

The server is organized into feature domains:
- Portfolio: Position and order management
- Screener: Stock screening and analysis
- Strategy: Trading strategy configuration
- Backtest: Historical strategy testing
- Config: System configuration management
- Social: Social sentiment analysis
- Daily Review: Combined workflow tools

Phase 1 Status:
- ✅ Configuration system (YAML-based)
- ✅ Tool registry infrastructure
- ✅ Dependency injection (reuses api/services)
- ✅ Server skeleton and logging
- ⏳ Tool implementations (Phase 2+)
"""
from __future__ import annotations

__version__ = "0.1.0"

from mcp_server.config import MCPConfig, load_config
from mcp_server.main import MCPServer

__all__ = [
    "MCPConfig",
    "load_config",
    "MCPServer",
    "__version__",
]
