"""Get daily review tool."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.daily_review._common import get_daily_review_service, logger


class GetDailyReviewTool(BaseTool):
    """Generate a comprehensive daily review with trade candidates and position actions."""
    
    @property
    def feature(self) -> str:
        return "daily_review"
    
    @property
    def name(self) -> str:
        return "get_daily_review"
    
    @property
    def description(self) -> str:
        return "Generate a comprehensive daily review with new trade candidates from the screener and recommended actions for open positions."
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "top_n": {
                    "type": "integer",
                    "description": "Number of top screener candidates to include (default: 10)",
                    "minimum": 1,
                    "maximum": 100
                }
            }
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute get_daily_review tool.
        
        Args:
            arguments: Tool input with optional 'top_n' parameter
            
        Returns:
            Dictionary with daily review data including candidates and position actions
        """
        service = get_daily_review_service()
        top_n = arguments.get("top_n", 10)
        
        try:
            result = service.generate_daily_review(top_n=top_n)
            return result.model_dump()
        except Exception as e:
            logger.error(f"Error generating daily review: {e}")
            return {"error": str(e)}
