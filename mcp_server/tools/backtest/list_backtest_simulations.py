"""List backtest simulations tool."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.backtest._common import get_backtest_svc, logger


class ListBacktestSimulationsTool(BaseTool):
    """List all saved backtest simulations."""
    
    @property
    def feature(self) -> str:
        return "backtest"
    
    @property
    def name(self) -> str:
        return "list_backtest_simulations"
    
    @property
    def description(self) -> str:
        return (
            "List all saved backtest simulations with metadata. "
            "Shows simulation ID, name, date range, and summary statistics."
        )
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {}
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute list_backtest_simulations tool.
        
        Returns:
            Dictionary with list of simulation metadata
        """
        service = get_backtest_svc()
        
        try:
            result = service.list_simulations()
            return {"simulations": [sim.model_dump() for sim in result]}
            
        except Exception as e:
            logger.error(f"Error listing backtest simulations: {e}")
            return {
                "error": str(e),
                "simulations": []
            }
