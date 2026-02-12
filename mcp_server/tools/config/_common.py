"""Common utilities for config tools."""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def get_config_from_router():
    """Get current config from the FastAPI router.
    
    Lazy import to avoid loading FastAPI at module level.
    
    Returns:
        Current AppConfig from the router's global state
    """
    from api.routers.config import current_config
    return current_config


def set_config_in_router(config):
    """Set current config in the FastAPI router.
    
    Lazy import to avoid loading FastAPI at module level.
    
    Args:
        config: The AppConfig to set as current
    """
    import api.routers.config as config_router
    config_router.current_config = config.model_copy(deep=True)
    return config_router.current_config


def get_default_config():
    """Get default config from the FastAPI router.
    
    Returns:
        Default AppConfig from the router
    """
    from api.routers.config import DEFAULT_CONFIG
    return DEFAULT_CONFIG
