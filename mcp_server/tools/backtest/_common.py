"""Common utilities for backtest tools."""
from __future__ import annotations

import logging

from api.dependencies import get_backtest_service
from api.services.backtest_service import BacktestService

logger = logging.getLogger(__name__)


def get_backtest_svc() -> BacktestService:
    """Get backtest service instance.
    
    Returns:
        BacktestService instance
    """
    return get_backtest_service()
