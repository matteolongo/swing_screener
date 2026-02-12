"""Run screener tool for MCP server.

This module provides the RunScreenerTool for executing stock screening
with filters and momentum ranking.
"""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.screener._common import get_screener_service, logger


class RunScreenerTool(BaseTool):
    """Execute stock screening with filters and ranking."""
    
    @property
    def feature(self) -> str:
        return "screener"
    
    @property
    def name(self) -> str:
        return "run_screener"
    
    @property
    def description(self) -> str:
        return ("Run stock screening with technical filters and momentum ranking. "
                "Returns top candidates with entry/stop prices and position sizing.")
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "universe": {
                    "type": "string",
                    "description": "Stock universe to screen (e.g., mega_all, sp500, nasdaq100)"
                },
                "top": {
                    "type": "integer",
                    "description": "Number of top candidates to return",
                    "minimum": 1,
                    "maximum": 100,
                    "default": 20
                },
                "tickers": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional list of specific tickers to screen"
                },
                "strategy_id": {
                    "type": "string",
                    "description": "Strategy ID to use (optional, uses active strategy if not provided)"
                },
                "asof_date": {
                    "type": "string",
                    "description": "Date to run screener as of (YYYY-MM-DD format, defaults to today)",
                    "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
                },
                "min_price": {
                    "type": "number",
                    "description": "Minimum stock price filter",
                    "minimum": 0
                },
                "max_price": {
                    "type": "number",
                    "description": "Maximum stock price filter",
                    "minimum": 0
                },
                "currencies": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Currency filters (e.g., ['USD', 'EUR'])"
                },
                "breakout_lookback": {
                    "type": "integer",
                    "description": "Breakout lookback period in days",
                    "minimum": 1
                },
                "pullback_ma": {
                    "type": "integer",
                    "description": "Pullback moving average period",
                    "minimum": 1
                },
                "min_history": {
                    "type": "integer",
                    "description": "Minimum history required in days",
                    "minimum": 1
                }
            }
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute run_screener tool.
        
        Args:
            arguments: Tool input with screening parameters
            
        Returns:
            Screener results with candidates and metadata
        """
        from api.models.screener import ScreenerRequest
        
        service = get_screener_service()
        
        try:
            request = ScreenerRequest(
                universe=arguments.get("universe"),
                top=arguments.get("top"),
                tickers=arguments.get("tickers"),
                strategy_id=arguments.get("strategy_id"),
                asof_date=arguments.get("asof_date"),
                min_price=arguments.get("min_price"),
                max_price=arguments.get("max_price"),
                currencies=arguments.get("currencies"),
                breakout_lookback=arguments.get("breakout_lookback"),
                pullback_ma=arguments.get("pullback_ma"),
                min_history=arguments.get("min_history")
            )
            result = service.run_screener(request)
            return result.model_dump()
        except Exception as e:
            logger.error(f"Error running screener: {e}")
            return {"error": str(e), "candidates": [], "asof_date": None, "total_screened": 0, "warnings": []}
