from __future__ import annotations

from copy import deepcopy
from datetime import datetime
import json
from pathlib import Path
from typing import Any

from swing_screener.settings import get_settings_manager
from swing_screener.settings.io import dump_yaml_file, load_yaml_file
from swing_screener.settings.paths import data_dir, repo_config_dir


def _legacy_mcp_file() -> Path:
    return repo_config_dir() / "mcp_features.yaml"


def _legacy_strategies_file() -> Path:
    return data_dir() / "strategies.json"


def _legacy_active_strategy_file() -> Path:
    return data_dir() / "active_strategy.json"


def _legacy_intelligence_file() -> Path:
    return data_dir() / "intelligence" / "config.json"


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat()


def _load_json_file(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def _sanitize_intelligence_secret_fields(config: dict[str, Any]) -> dict[str, Any]:
    payload = deepcopy(config)
    llm = payload.get("llm")
    if isinstance(llm, dict):
        llm.pop("api_key", None)
    return payload


def _sanitize_strategy(strategy: dict[str, Any]) -> dict[str, Any]:
    payload = deepcopy(strategy)
    market_intelligence = payload.get("market_intelligence")
    if isinstance(market_intelligence, dict):
        llm = market_intelligence.get("llm")
        if isinstance(llm, dict):
            llm.pop("api_key", None)
    return payload


def migrate_legacy_config_to_yaml(*, force: bool = False, cleanup: bool = False) -> list[str]:
    manager = get_settings_manager()
    actions: list[str] = []

    strategies_doc = manager.load_strategies_document()
    if force or not strategies_doc:
        legacy_strategies = []
        legacy_strategies_file = _legacy_strategies_file()
        if legacy_strategies_file.exists():
            payload = _load_json_file(legacy_strategies_file)
            if isinstance(payload, list):
                legacy_strategies = [_sanitize_strategy(item) for item in payload if isinstance(item, dict)]

        active_strategy_id = "default"
        legacy_active_strategy_file = _legacy_active_strategy_file()
        if legacy_active_strategy_file.exists():
            payload = _load_json_file(legacy_active_strategy_file)
            if isinstance(payload, dict) and payload.get("id"):
                active_strategy_id = str(payload["id"])

        if not legacy_strategies:
            seed = manager.get_strategy_defaults_payload()
            timestamp = _now_iso()
            seed.setdefault("created_at", timestamp)
            seed.setdefault("updated_at", timestamp)
            legacy_strategies = [seed]

        if not any(str(item.get("id", "")).strip() == "default" for item in legacy_strategies):
            seed = manager.get_strategy_defaults_payload()
            timestamp = _now_iso()
            seed.setdefault("created_at", timestamp)
            seed.setdefault("updated_at", timestamp)
            legacy_strategies.insert(0, seed)

        manager.save_strategies_document(
            {
                "active_strategy_id": active_strategy_id,
                "strategies": legacy_strategies,
            }
        )
        actions.append(f"wrote {manager.current_config_dir / 'strategies.yaml'}")

    intelligence_doc = manager.load_intelligence_document()
    if force or not intelligence_doc:
        legacy_doc: dict[str, Any] | None = None
        legacy_intelligence_file = _legacy_intelligence_file()
        if legacy_intelligence_file.exists():
            payload = _load_json_file(legacy_intelligence_file)
            if isinstance(payload, dict):
                legacy_doc = deepcopy(payload)

        if legacy_doc is None:
            legacy_doc = {
                "config": manager.get_intelligence_defaults_payload(),
                "bootstrapped_from_strategy": True,
                "updated_at": _now_iso(),
            }
        else:
            config_payload = legacy_doc.get("config", {})
            if not isinstance(config_payload, dict):
                config_payload = manager.get_intelligence_defaults_payload()
            legacy_doc["config"] = _sanitize_intelligence_secret_fields(config_payload)
            legacy_doc["bootstrapped_from_strategy"] = bool(
                legacy_doc.get("bootstrapped_from_strategy", False)
            )
            legacy_doc["updated_at"] = str(legacy_doc.get("updated_at") or _now_iso())

        manager.save_intelligence_document(legacy_doc)
        actions.append(f"wrote {manager.current_config_dir / 'intelligence.yaml'}")

    mcp_doc = manager.load_mcp_document()
    if force or not mcp_doc:
        legacy_mcp_file = _legacy_mcp_file()
        if legacy_mcp_file.exists():
            payload = load_yaml_file(legacy_mcp_file)
            if isinstance(payload, dict):
                dump_yaml_file(manager.current_config_dir / "mcp.yaml", payload)
                actions.append(f"wrote {manager.current_config_dir / 'mcp.yaml'}")

    if cleanup:
        legacy_paths = (
            _legacy_strategies_file(),
            _legacy_active_strategy_file(),
            _legacy_intelligence_file(),
            _legacy_mcp_file(),
        )
        for legacy_path in legacy_paths:
            if legacy_path.exists():
                legacy_path.unlink()
                actions.append(f"deleted {legacy_path}")

    return actions
