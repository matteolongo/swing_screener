"""Run quick backtest tool."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.backtest._common import get_backtest_svc, logger
from api.models.backtest import QuickBacktestRequest


class RunQuickBacktestTool(BaseTool):
    """Run a quick backtest on a single ticker with recent data."""
    
    @property
    def feature(self) -> str:
        return "backtest"
    
    @property
    def name(self) -> str:
        return "run_quick_backtest"
    
    @property
    def description(self) -> str:
        return (
            "Run a quick backtest on a single ticker using recent data. "
            "Auto-detects entry type and uses default parameters. "
            "Returns summary statistics and trade details."
        )
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker to backtest"
                },
                "entry_type": {
                    "type": "string",
                    "enum": ["pullback", "breakout", "channel"],
                    "description": "Entry type (auto-detected if not specified)"
                },
                "start_date": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD format (default: 1 year ago)"
                },
                "end_date": {
                    "type": "string",
                    "description": "End date in YYYY-MM-DD format (default: today)"
                }
            },
            "required": ["ticker"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute run_quick_backtest tool.
        
        Args:
            arguments: Tool input with ticker and optional parameters
            
        Returns:
            Dictionary with backtest results and statistics
        """
        service = get_backtest_svc()
        
        try:
            request = QuickBacktestRequest(
                ticker=arguments["ticker"],
                entry_type=arguments.get("entry_type"),
                start_date=arguments.get("start_date"),
                end_date=arguments.get("end_date")
            )
            
            result = service.quick_backtest(request)
            return result.model_dump()
            
        except Exception as e:
            logger.error(f"Error running quick backtest: {e}")
            return {
                "error": str(e),
                "ticker": arguments.get("ticker"),
                "metrics": None
            }
