"""YAML-backed application configuration repository."""
from __future__ import annotations

from threading import Lock
from typing import Optional

from api.models.config import AppConfig
from swing_screener.settings import get_settings_manager


class ConfigRepository:
    """Thread-safe YAML-backed configuration repository."""

    def __init__(self, initial_config: Optional[AppConfig] = None) -> None:
        self._lock = Lock()
        self._initial_config = initial_config.model_copy(deep=True) if initial_config is not None else None

    def get(self) -> AppConfig:
        with self._lock:
            if self._initial_config is not None:
                return self._initial_config.model_copy(deep=True)
            payload = get_settings_manager().get_app_config_payload()
            return AppConfig.model_validate(payload)

    def update(self, config: AppConfig) -> AppConfig:
        with self._lock:
            if self._initial_config is not None:
                self._initial_config = config.model_copy(deep=True)
                return self._initial_config.model_copy(deep=True)
            get_settings_manager().set_app_config_payload(config.model_dump())
            return config.model_copy(deep=True)

    def reset(self) -> AppConfig:
        with self._lock:
            defaults = self.get_defaults()
            if self._initial_config is not None:
                self._initial_config = defaults.model_copy(deep=True)
                return self._initial_config.model_copy(deep=True)
            manager = get_settings_manager()
            user_doc = manager.load_user_document()
            user_doc["app_config"] = {}
            manager.save_user_document(user_doc)
            return defaults

    @staticmethod
    def get_defaults() -> AppConfig:
        payload = get_settings_manager().load_defaults_document().get("app_config", {})
        return AppConfig.model_validate(payload)
