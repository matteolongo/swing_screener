from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import threading
from typing import Any

from swing_screener.settings.io import CachedYamlFile
from swing_screener.settings.paths import (
    config_dir,
    data_dir,
    defaults_yaml_path,
    intelligence_yaml_path,
    mcp_yaml_path,
    repo_config_dir,
    resolve_repo_path,
    strategies_yaml_path,
    user_yaml_path,
)


def deep_merge_dicts(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge_dicts(merged[key], value)
        else:
            merged[key] = deepcopy(value)
    return merged


class SettingsManager:
    def __init__(self) -> None:
        repo_defaults = repo_config_dir() / "defaults.yaml"
        repo_mcp = repo_config_dir() / "mcp.yaml"
        self.defaults_store = CachedYamlFile(
            defaults_yaml_path(),
            default_factory=dict,
            fallback_path=repo_defaults if repo_defaults != defaults_yaml_path() else None,
        )
        self.user_store = CachedYamlFile(user_yaml_path(), default_factory=dict)
        self.strategies_store = CachedYamlFile(strategies_yaml_path(), default_factory=dict)
        self.intelligence_store = CachedYamlFile(intelligence_yaml_path(), default_factory=dict)
        self.mcp_store = CachedYamlFile(
            mcp_yaml_path(),
            default_factory=dict,
            fallback_path=repo_mcp if repo_mcp != mcp_yaml_path() else None,
        )

    @property
    def current_config_dir(self) -> Path:
        return config_dir()

    @property
    def current_data_dir(self) -> Path:
        return data_dir()

    def load_defaults_document(self) -> dict[str, Any]:
        payload = self.defaults_store.load()
        return payload if isinstance(payload, dict) else {}

    def load_user_document(self) -> dict[str, Any]:
        payload = self.user_store.load()
        return payload if isinstance(payload, dict) else {}

    def save_user_document(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.user_store.save(payload)

    def load_strategies_document(self) -> dict[str, Any]:
        payload = self.strategies_store.load()
        return payload if isinstance(payload, dict) else {}

    def save_strategies_document(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.strategies_store.save(payload)

    def load_intelligence_document(self) -> dict[str, Any]:
        payload = self.intelligence_store.load()
        return payload if isinstance(payload, dict) else {}

    def save_intelligence_document(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.intelligence_store.save(payload)

    def load_mcp_document(self) -> dict[str, Any]:
        payload = self.mcp_store.load()
        return payload if isinstance(payload, dict) else {}

    def save_mcp_document(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.mcp_store.save(payload)

    def merged_runtime_settings(self) -> dict[str, Any]:
        defaults_runtime = self.load_defaults_document().get("runtime", {})
        user_runtime = self.load_user_document().get("runtime", {})
        if not isinstance(defaults_runtime, dict):
            defaults_runtime = {}
        if not isinstance(user_runtime, dict):
            user_runtime = {}
        return deep_merge_dicts(defaults_runtime, user_runtime)

    def resolve_runtime_path(self, key: str, fallback: str | Path) -> Path:
        runtime = self.merged_runtime_settings()
        raw = runtime.get(key, fallback)
        return resolve_repo_path(raw)

    @staticmethod
    def _serialize_path(path: Path) -> str:
        repo_root = resolve_repo_path(".")
        try:
            return str(path.relative_to(repo_root))
        except ValueError:
            return str(path)

    def get_app_config_payload(self) -> dict[str, Any]:
        defaults_doc = self.load_defaults_document()
        user_doc = self.load_user_document()
        defaults_payload = defaults_doc.get("app_config", {})
        user_payload = user_doc.get("app_config", {})
        if not isinstance(defaults_payload, dict):
            defaults_payload = {}
        if not isinstance(user_payload, dict):
            user_payload = {}
        payload = deep_merge_dicts(defaults_payload, user_payload)
        positions_fallback = payload.get("positions_file", "data/positions.json")
        orders_fallback = payload.get("orders_file", "data/orders.json")
        payload["positions_file"] = self._serialize_path(
            self.resolve_runtime_path("positions_file", positions_fallback)
        )
        payload["orders_file"] = self._serialize_path(
            self.resolve_runtime_path("orders_file", orders_fallback)
        )
        return payload

    def set_app_config_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        user_doc = self.load_user_document()
        user_doc["app_config"] = deepcopy(payload)
        return self.save_user_document(user_doc)

    def get_strategy_defaults_payload(self) -> dict[str, Any]:
        defaults_doc = self.load_defaults_document()
        payload = defaults_doc.get("strategy", {})
        return deepcopy(payload if isinstance(payload, dict) else {})

    def get_intelligence_defaults_payload(self) -> dict[str, Any]:
        defaults_doc = self.load_defaults_document()
        payload = defaults_doc.get("intelligence", {})
        return deepcopy(payload if isinstance(payload, dict) else {})

    def get_intelligence_provider_catalog(self) -> dict[str, Any]:
        defaults_doc = self.load_defaults_document()
        ui_doc = defaults_doc.get("ui", {})
        if not isinstance(ui_doc, dict):
            return {}
        providers = ui_doc.get("intelligence_providers", {})
        return deepcopy(providers if isinstance(providers, dict) else {})

    def get_low_level_defaults_payload(self, section: str | None = None) -> dict[str, Any]:
        defaults_doc = self.load_defaults_document()
        low_level = defaults_doc.get("low_level", {})
        if not isinstance(low_level, dict):
            return {}
        if section is None:
            return deepcopy(low_level)
        payload = low_level.get(section, {})
        return deepcopy(payload if isinstance(payload, dict) else {})


_SETTINGS_LOCK = threading.Lock()
_SETTINGS_MANAGER: SettingsManager | None = None
_SETTINGS_KEY: tuple[str, str] | None = None


def get_settings_manager() -> SettingsManager:
    global _SETTINGS_MANAGER, _SETTINGS_KEY
    key = (str(config_dir()), str(data_dir()))
    if _SETTINGS_MANAGER is not None and _SETTINGS_KEY == key:
        return _SETTINGS_MANAGER
    with _SETTINGS_LOCK:
        if _SETTINGS_MANAGER is None or _SETTINGS_KEY != key:
            _SETTINGS_MANAGER = SettingsManager()
            _SETTINGS_KEY = key
    return _SETTINGS_MANAGER
