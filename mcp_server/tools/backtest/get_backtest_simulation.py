"""Get backtest simulation tool."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.backtest._common import get_backtest_svc, logger


class GetBacktestSimulationTool(BaseTool):
    """Get detailed results for a specific backtest simulation."""
    
    @property
    def feature(self) -> str:
        return "backtest"
    
    @property
    def name(self) -> str:
        return "get_backtest_simulation"
    
    @property
    def description(self) -> str:
        return (
            "Get detailed results for a saved backtest simulation. "
            "Includes full trade history, metrics, and performance analysis."
        )
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "sim_id": {
                    "type": "string",
                    "description": "Simulation ID from list_backtest_simulations"
                }
            },
            "required": ["sim_id"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute get_backtest_simulation tool.
        
        Args:
            arguments: Tool input with sim_id
            
        Returns:
            Dictionary with complete simulation results
        """
        service = get_backtest_svc()
        sim_id = arguments["sim_id"]
        
        try:
            result = service.get_simulation(sim_id)
            return result.model_dump()
            
        except Exception as e:
            logger.error(f"Error getting backtest simulation {sim_id}: {e}")
            return {
                "error": str(e),
                "sim_id": sim_id
            }
