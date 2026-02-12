"""Screener tools for MCP server.

This module provides MCP tools for stock screening and analysis.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from mcp_server.tools.base import BaseTool

logger = logging.getLogger(__name__)


def _get_screener_service():
    """Lazy import and create screener service to avoid loading FastAPI at module level."""
    from mcp_server.dependencies import get_screener_service
    return get_screener_service()


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
        
        service = _get_screener_service()
        
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


class ListUniversesTool(BaseTool):
    """List available stock universes for screening."""
    
    @property
    def feature(self) -> str:
        return "screener"
    
    @property
    def name(self) -> str:
        return "list_universes"
    
    @property
    def description(self) -> str:
        return "List all available stock universes that can be used for screening (e.g., mega_all, sp500, nasdaq100)."
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {}
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute list_universes tool.
        
        Args:
            arguments: Tool input (no parameters required)
            
        Returns:
            List of available universes
        """
        service = _get_screener_service()
        
        try:
            result = service.list_universes()
            return result
        except Exception as e:
            logger.error(f"Error listing universes: {e}")
            return {"error": str(e), "universes": []}


class PreviewOrderTool(BaseTool):
    """Calculate position sizing and risk for a potential order."""
    
    @property
    def feature(self) -> str:
        return "screener"
    
    @property
    def name(self) -> str:
        return "preview_order"
    
    @property
    def description(self) -> str:
        return ("Calculate position sizing, shares, and risk metrics for a potential order "
                "given entry and stop prices.")
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol"
                },
                "entry_price": {
                    "type": "number",
                    "description": "Proposed entry price",
                    "minimum": 0.01
                },
                "stop_price": {
                    "type": "number",
                    "description": "Proposed stop price",
                    "minimum": 0.01
                },
                "account_size": {
                    "type": "number",
                    "description": "Account size in dollars (defaults to 50000)",
                    "minimum": 1,
                    "default": 50000
                },
                "risk_pct": {
                    "type": "number",
                    "description": "Risk percentage per trade (defaults to 0.01 = 1%)",
                    "minimum": 0.0001,
                    "maximum": 0.1,
                    "default": 0.01
                }
            },
            "required": ["ticker", "entry_price", "stop_price"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute preview_order tool.
        
        Args:
            arguments: Tool input with ticker, entry, stop, account size, and risk %
            
        Returns:
            Order preview with calculated shares, position size, and risk
        """
        service = _get_screener_service()
        
        ticker = arguments.get("ticker")
        entry_price = arguments.get("entry_price")
        stop_price = arguments.get("stop_price")
        account_size = arguments.get("account_size", 50000)
        risk_pct = arguments.get("risk_pct", 0.01)
        
        if not ticker or entry_price is None or stop_price is None:
            return {"error": "ticker, entry_price, and stop_price are required"}
        
        try:
            result = service.preview_order(
                ticker=ticker,
                entry_price=entry_price,
                stop_price=stop_price,
                account_size=account_size,
                risk_pct=risk_pct
            )
            return result.model_dump()
        except Exception as e:
            logger.error(f"Error previewing order for {ticker}: {e}")
            return {"error": str(e)}


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
