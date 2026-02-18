"""Common utilities for intelligence tools."""
from __future__ import annotations

import logging

from api.dependencies import get_intelligence_service
from api.services.intelligence_service import IntelligenceService

logger = logging.getLogger(__name__)


def get_intelligence_svc() -> IntelligenceService:
    """Get intelligence service instance.
    
    Returns:
        IntelligenceService instance
    """
    return get_intelligence_service()
