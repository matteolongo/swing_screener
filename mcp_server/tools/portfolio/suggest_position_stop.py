"""Suggest position stop tool for MCP server.

This module provides the SuggestPositionStopTool for getting AI-powered stop price suggestions.
"""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.portfolio._common import get_portfolio_service, logger


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
        service = get_portfolio_service()
        position_id = arguments.get("position_id")
        
        if not position_id:
            return {"error": "position_id is required"}
        
        try:
            result = service.suggest_position_stop(position_id)
            return result.model_dump()
        except Exception as e:
            logger.error(f"Error suggesting stop for position {position_id}: {e}")
            return {"error": str(e)}
