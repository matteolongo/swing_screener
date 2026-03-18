"""Common utilities for config tools."""
from __future__ import annotations

import logging

from api.models.config import AppConfig
from api.repositories.config_repo import ConfigRepository

logger = logging.getLogger(__name__)


def get_config_from_router():
    """Get current config from the shared YAML-backed repository."""
    return ConfigRepository().get()


def set_config_in_router(config):
    """Persist current config into the shared YAML-backed repository."""
    if not isinstance(config, AppConfig):
        config = AppConfig.model_validate(config)
    return ConfigRepository().update(config)


def get_default_config():
    """Get default config from the shared YAML-backed repository."""
    return ConfigRepository.get_defaults()
