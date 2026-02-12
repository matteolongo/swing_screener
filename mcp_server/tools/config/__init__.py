"""Configuration tools for MCP server.

This package provides MCP tools for configuration management including
getting and updating application configuration.
"""
from __future__ import annotations

from mcp_server.tools.base import BaseTool
from mcp_server.tools.config.get_config import GetConfigTool
from mcp_server.tools.config.update_config import UpdateConfigTool


def get_config_tools() -> list[BaseTool]:
    """Get all config tools.
    
    Returns:
        List of config tool instances
    """
    return [
        GetConfigTool(),
        UpdateConfigTool(),
    ]


__all__ = [
    "get_config_tools",
    "GetConfigTool",
    "UpdateConfigTool",
]
