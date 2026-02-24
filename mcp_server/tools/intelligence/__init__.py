"""Intelligence tools for MCP server.

This package provides MCP tools for AI-powered trade discovery and analysis.
"""
from __future__ import annotations

from mcp_server.tools.base import BaseTool
from mcp_server.tools.intelligence.run_intelligence import RunIntelligenceTool
from mcp_server.tools.intelligence.get_intelligence_status import GetIntelligenceStatusTool
from mcp_server.tools.intelligence.list_intelligence_opportunities import ListIntelligenceOpportunitiesTool
from mcp_server.tools.intelligence.classify_news_sentiment import ClassifyNewsSentimentTool


def get_intelligence_tools() -> list[BaseTool]:
    """Get all intelligence tools.
    
    Returns:
        List of intelligence tool instances
    """
    return [
        RunIntelligenceTool(),
        GetIntelligenceStatusTool(),
        ListIntelligenceOpportunitiesTool(),
        ClassifyNewsSentimentTool(),
    ]


__all__ = [
    "get_intelligence_tools",
    "RunIntelligenceTool",
    "GetIntelligenceStatusTool",
    "ListIntelligenceOpportunitiesTool",
    "ClassifyNewsSentimentTool",
]
