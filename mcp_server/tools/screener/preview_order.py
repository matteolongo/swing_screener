"""Preview order tool for MCP server.

This module provides the PreviewOrderTool for calculating position sizing
and risk for potential orders.
"""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.screener._common import get_screener_service, logger


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
        service = get_screener_service()
        
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
