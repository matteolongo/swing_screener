"""Common utilities for daily_review tools."""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def get_daily_review_service():
    """Lazy import and create daily_review service to avoid loading FastAPI at module level."""
    from mcp_server.dependencies import get_daily_review_service
    return get_daily_review_service()
