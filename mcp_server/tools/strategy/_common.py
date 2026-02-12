"""Common utilities for strategy tools.

This module provides shared functionality for strategy tool classes.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def get_strategy_service():
    """Lazy import and create strategy service to avoid loading FastAPI at module level.
    
    Returns:
        Strategy service instance with list_strategies, get_strategy, 
        get_active_strategy, and set_active_strategy methods.
    """
    from mcp_server.dependencies import get_strategy_service
    return get_strategy_service()
