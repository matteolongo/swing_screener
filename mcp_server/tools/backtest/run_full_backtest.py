"""Run full backtest tool."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.backtest._common import get_backtest_svc, logger
from api.models.backtest import FullBacktestRequest


class RunFullBacktestTool(BaseTool):
    """Run a comprehensive backtest and persist results to disk."""
    
    @property
    def feature(self) -> str:
        return "backtest"
    
    @property
    def name(self) -> str:
        return "run_full_backtest"
    
    @property
    def description(self) -> str:
        return (
            "Run a comprehensive backtest on one or more tickers and save results. "
            "Supports multiple entry types and full strategy parameters. "
            "Results are persisted to disk for later analysis."
        )
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "tickers": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of tickers to backtest"
                },
                "start_date": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD format"
                },
                "end_date": {
                    "type": "string",
                    "description": "End date in YYYY-MM-DD format"
                },
                "name": {
                    "type": "string",
                    "description": "Name for this backtest simulation"
                },
                "strategy_id": {
                    "type": "string",
                    "description": "Strategy ID to use for backtesting"
                }
            },
            "required": ["tickers", "start_date", "end_date"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute run_full_backtest tool.
        
        Args:
            arguments: Tool input with tickers and parameters
            
        Returns:
            Dictionary with simulation ID and summary statistics
        """
        service = get_backtest_svc()
        
        try:
            request = FullBacktestRequest(
                tickers=arguments["tickers"],
                start_date=arguments["start_date"],
                end_date=arguments["end_date"],
                name=arguments.get("name"),
                strategy_id=arguments.get("strategy_id")
            )
            
            result = service.run_full_backtest(request)
            return result.model_dump()
            
        except Exception as e:
            logger.error(f"Error running full backtest: {e}")
            return {
                "error": str(e),
                "sim_id": None,
                "metrics": None
            }
