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


def test_finnhub_client_is_created_after_dotenv_load_when_dependencies_import_first(tmp_path, monkeypatch):
    import api.dependencies as dependencies

    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("FINNHUB_API_KEY", raising=False)
    (tmp_path / ".env").write_text("FINNHUB_API_KEY=test-finnhub-from-dotenv\n", encoding="utf-8")

    ensure_runtime_env_loaded.cache_clear()
    monkeypatch.setattr(dependencies, "_finnhub_client", None)
    monkeypatch.setattr(dependencies, "_finnhub_client_api_key", None)
    try:
        client = dependencies.get_finnhub_client()

        assert client is not None
        assert client._api_key == "test-finnhub-from-dotenv"
    finally:
        ensure_runtime_env_loaded.cache_clear()
