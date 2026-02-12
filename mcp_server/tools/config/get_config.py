"""Get current configuration tool for MCP server.

This module provides the GetConfigTool for retrieving the current
application configuration including risk, indicators, and management settings.
"""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.config._common import get_config_from_router, logger


class GetConfigTool(BaseTool):
    """Get current application configuration."""
    
    @property
    def feature(self) -> str:
        return "config"
    
    @property
    def name(self) -> str:
        return "get_config"
    
    @property
    def description(self) -> str:
        return "Get the current application configuration including risk settings, indicators, and position management parameters."
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {},
            "required": []
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute get_config tool.
        
        Args:
            arguments: Tool input (no parameters required)
            
        Returns:
            Current AppConfig as dictionary, or error dict if operation fails
        """
        try:
            config = get_config_from_router()
            return config.model_dump()
        except Exception as e:
            logger.error(f"Error getting config: {e}")
            return {
                "error": str(e),
                "config": None
            }
