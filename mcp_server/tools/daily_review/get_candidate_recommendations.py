"""Get candidate recommendations tool."""
from __future__ import annotations

from typing import Any

from mcp_server.tools.base import BaseTool
from mcp_server.tools.daily_review._common import get_daily_review_service, logger


class GetCandidateRecommendationsTool(BaseTool):
    """Get new trade candidate recommendations from daily review screening."""
    
    @property
    def feature(self) -> str:
        return "daily_review"
    
    @property
    def name(self) -> str:
        return "get_candidate_recommendations"
    
    @property
    def description(self) -> str:
        return "Get the latest trade candidate recommendations from the daily review screener, including ticker, signal, entry/stop prices, and risk/reward analysis."
    
    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "top_n": {
                    "type": "integer",
                    "description": "Number of top candidates to include (default: 10)",
                    "minimum": 1,
                    "maximum": 100
                }
            }
        }
    
    async def execute(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute get_candidate_recommendations tool.
        
        Args:
            arguments: Tool input with optional 'top_n' parameter
            
        Returns:
            Dictionary with list of candidate recommendations and summary statistics
        """
        service = get_daily_review_service()
        top_n = arguments.get("top_n", 10)
        
        try:
            # Generate the full daily review to get candidates
            review = service.generate_daily_review(top_n=top_n)
            
            # Extract candidates from the review
            candidates_data = [candidate.model_dump() for candidate in review.new_candidates]
            
            return {
                "candidates": candidates_data,
                "total_candidates": len(candidates_data),
                "review_date": review.summary.review_date.isoformat()
            }
        except Exception as e:
            logger.error(f"Error getting candidate recommendations: {e}")
            return {"error": str(e)}
