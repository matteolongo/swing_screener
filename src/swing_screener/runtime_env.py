from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def ensure_runtime_env_loaded() -> None:
    try:
        from dotenv import load_dotenv
    except Exception:
        return

    repo_root = Path(__file__).resolve().parents[2]
    candidates = [Path.cwd() / ".env", repo_root / ".env"]
    seen: set[Path] = set()
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved in seen or not resolved.is_file():
            continue
        seen.add(resolved)
        load_dotenv(resolved, override=False)


def get_env_value(name: str, default: str = "") -> str:
    ensure_runtime_env_loaded()
    return str(os.environ.get(name, default))


def get_openai_api_key() -> str:
    return get_env_value("OPENAI_API_KEY", "").strip()


def get_openai_base_url() -> str:
    value = get_env_value("OPENAI_BASE_URL", "https://api.openai.com/v1").strip()
    return value or "https://api.openai.com/v1"


def get_ollama_host() -> str:
    value = get_env_value("OLLAMA_HOST", "http://localhost:11434").strip()
    return value or "http://localhost:11434"
