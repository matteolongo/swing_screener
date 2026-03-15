"""Shared helpers for intelligence/chat MCP tools."""
from __future__ import annotations

import logging

from mcp_server.dependencies import (
    get_chat_service,
    get_intelligence_service,
    get_workspace_context_service,
)

logger = logging.getLogger(__name__)

__all__ = [
    "get_chat_service",
    "get_intelligence_service",
    "get_workspace_context_service",
    "logger",
]
