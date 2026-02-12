"""Common utilities for social tools.

This module provides shared functionality for social tool classes.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def get_social_service():
    """Lazy import and create social service to avoid loading FastAPI at module level.
    
    Returns:
        Social service instance with analyze method.
    """
    from mcp_server.dependencies import get_social_service
    return get_social_service()
