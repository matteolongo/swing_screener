"""Daily review tools for MCP server.

This package provides MCP tools for daily review functionality including
generating daily reviews and retrieving candidate recommendations.
"""
from __future__ import annotations

from mcp_server.tools.base import BaseTool
from mcp_server.tools.daily_review.get_daily_review import GetDailyReviewTool
from mcp_server.tools.daily_review.get_candidate_recommendations import GetCandidateRecommendationsTool


def get_daily_review_tools() -> list[BaseTool]:
    """Get all daily_review tools.
    
    Returns:
        List of daily_review tool instances
    """
    return [
        GetDailyReviewTool(),
        GetCandidateRecommendationsTool(),
    ]


__all__ = [
    "get_daily_review_tools",
    "GetDailyReviewTool",
    "GetCandidateRecommendationsTool",
]
