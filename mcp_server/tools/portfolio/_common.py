"""Common utilities for portfolio tools."""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def get_portfolio_service():
    """Lazy import and create portfolio service to avoid loading FastAPI at module level."""
    from mcp_server.dependencies import get_portfolio_service
    return get_portfolio_service()
