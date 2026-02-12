"""Common utilities for screener tools.

This module provides shared functionality for screener tool classes.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def get_screener_service():
    """Lazy import and create screener service to avoid loading FastAPI at module level.
    
    Returns:
        Screener service instance with run_screener, list_universes, and preview_order methods.
    """
    from mcp_server.dependencies import get_screener_service
    return get_screener_service()
