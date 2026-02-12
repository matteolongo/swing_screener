"""Social tools for MCP server.

This package provides MCP tools for social sentiment analysis and research.
"""
from __future__ import annotations

from mcp_server.tools.base import BaseTool
from mcp_server.tools.social.get_social_sentiment import GetSocialSentimentTool
from mcp_server.tools.social.analyze_ticker_sentiment import AnalyzeTickerSentimentTool

__all__ = [
    "GetSocialSentimentTool",
    "AnalyzeTickerSentimentTool",
    "get_social_tools",
]


def get_social_tools() -> list[BaseTool]:
    """Get all social tools.
    
    Returns:
        List of social tool instances
    """
    return [
        GetSocialSentimentTool(),
        AnalyzeTickerSentimentTool(),
    ]
