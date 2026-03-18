from __future__ import annotations

import os
from pathlib import Path


def project_root() -> Path:
    configured = os.environ.get("SWING_SCREENER_PROJECT_ROOT", "").strip()
    if configured:
        return Path(configured).expanduser().resolve()
    return Path(__file__).resolve().parents[3]


def repo_config_dir() -> Path:
    return project_root() / "config"


def config_dir() -> Path:
    configured = os.environ.get("SWING_SCREENER_CONFIG_DIR", "").strip()
    if configured:
        return Path(configured).expanduser().resolve()
    return repo_config_dir()


def data_dir() -> Path:
    configured = os.environ.get("SWING_SCREENER_DATA_DIR", "").strip()
    if configured:
        return Path(configured).expanduser().resolve()
    return project_root() / "data"


def defaults_yaml_path() -> Path:
    return config_dir() / "defaults.yaml"


def user_yaml_path() -> Path:
    return config_dir() / "user.yaml"


def strategies_yaml_path() -> Path:
    return config_dir() / "strategies.yaml"


def intelligence_yaml_path() -> Path:
    return config_dir() / "intelligence.yaml"


def mcp_yaml_path() -> Path:
    return config_dir() / "mcp.yaml"


def resolve_repo_path(value: str | Path) -> Path:
    path = Path(value).expanduser()
    if path.is_absolute():
        return path
    return (project_root() / path).resolve()
