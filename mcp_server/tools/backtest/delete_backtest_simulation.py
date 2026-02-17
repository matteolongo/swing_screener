"""Delete backtest simulation tool."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.backtest._common import get_backtest_svc, logger


class DeleteBacktestSimulationTool(BaseTool):
    """Delete a saved backtest simulation."""
    
    @property
    def feature(self) -> str:
        return "backtest"
    
    @property
    def name(self) -> str:
        return "delete_backtest_simulation"
    
    @property
    def description(self) -> str:
        return "Delete a saved backtest simulation from disk."
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "sim_id": {
                    "type": "string",
                    "description": "Simulation ID to delete"
                }
            },
            "required": ["sim_id"]
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute delete_backtest_simulation tool.
        
        Args:
            arguments: Tool input with sim_id
            
        Returns:
            Dictionary with deletion status
        """
        service = get_backtest_svc()
        sim_id = arguments["sim_id"]
        
        try:
            service.delete_simulation(sim_id)
            return {
                "success": True,
                "sim_id": sim_id,
                "message": f"Simulation {sim_id} deleted successfully"
            }
            
        except Exception as e:
            logger.error(f"Error deleting backtest simulation {sim_id}: {e}")
            return {
                "error": str(e),
                "success": False,
                "sim_id": sim_id
            }
