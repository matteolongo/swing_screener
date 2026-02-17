"""List intelligence opportunities tool."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.intelligence._common import get_intelligence_svc, logger


class ListIntelligenceOpportunitiesTool(BaseTool):
    """List AI-discovered trading opportunities from intelligence analysis."""
    
    @property
    def feature(self) -> str:
        return "intelligence"
    
    @property
    def name(self) -> str:
        return "list_intelligence_opportunities"
    
    @property
    def description(self) -> str:
        return (
            "List AI-discovered trading opportunities from intelligence analysis. "
            "Shows actionable insights with sentiment, events, and recommendations. "
            "Can filter by date and specific symbols."
        )
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "asof_date": {
                    "type": "string",
                    "description": "Filter by analysis date in YYYY-MM-DD format"
                },
                "symbols": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Filter by specific tickers (e.g., ['AAPL', 'MSFT'])"
                }
            }
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute list_intelligence_opportunities tool.
        
        Args:
            arguments: Tool input with optional filters
            
        Returns:
            Dictionary with opportunities list and metadata
        """
        service = get_intelligence_svc()
        
        try:
            result = service.get_opportunities(
                asof_date=arguments.get("asof_date"),
                symbols=arguments.get("symbols")
            )
            return result.model_dump()
            
        except Exception as e:
            logger.error(f"Error listing intelligence opportunities: {e}")
            return {
                "error": str(e),
                "opportunities": [],
                "asof_date": None
            }
