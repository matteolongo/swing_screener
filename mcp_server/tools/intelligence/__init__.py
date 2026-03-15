"""Intelligence and workspace chat tools for MCP parity."""
from __future__ import annotations

from mcp_server.tools.base import BaseTool
from mcp_server.tools.intelligence.chat_answer import ChatAnswerTool
from mcp_server.tools.intelligence.explain_symbol import ExplainSymbolTool
from mcp_server.tools.intelligence.get_intelligence_events import GetIntelligenceEventsTool
from mcp_server.tools.intelligence.get_intelligence_opportunities import GetIntelligenceOpportunitiesTool
from mcp_server.tools.intelligence.get_workspace_context import GetWorkspaceContextTool


def get_intelligence_tools() -> list[BaseTool]:
    """Get all intelligence/chat tools."""
    return [
        GetWorkspaceContextTool(),
        GetIntelligenceOpportunitiesTool(),
        GetIntelligenceEventsTool(),
        ExplainSymbolTool(),
        ChatAnswerTool(),
    ]


__all__ = [
    "ChatAnswerTool",
    "ExplainSymbolTool",
    "GetIntelligenceEventsTool",
    "GetIntelligenceOpportunitiesTool",
    "GetWorkspaceContextTool",
    "get_intelligence_tools",
]
