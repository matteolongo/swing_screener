from __future__ import annotations

from swing_screener.runtime_env import ensure_runtime_env_loaded, get_openai_api_key


def test_runtime_env_loads_openai_api_key_from_dotenv(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    (tmp_path / ".env").write_text("OPENAI_API_KEY=test-from-dotenv\n", encoding="utf-8")

    ensure_runtime_env_loaded.cache_clear()
    try:
        assert get_openai_api_key() == "test-from-dotenv"
    finally:
        ensure_runtime_env_loaded.cache_clear()
