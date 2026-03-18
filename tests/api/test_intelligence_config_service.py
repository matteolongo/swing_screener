from __future__ import annotations

from api.repositories.intelligence_config_repo import IntelligenceConfigRepository
from api.repositories.intelligence_symbol_sets_repo import IntelligenceSymbolSetsRepository
from api.services.intelligence_config_service import IntelligenceConfigService


class _FakeStrategyRepo:
    def get_active_strategy(self) -> dict:
        return {}


def test_get_config_sanitizes_legacy_llm_api_key(tmp_path):
    config_repo = IntelligenceConfigRepository(tmp_path / "config.json")
    symbol_sets_repo = IntelligenceSymbolSetsRepository(tmp_path / "symbol_sets.json")
    config_repo.save_raw(
        {
            "config": {
                "enabled": True,
                "providers": ["yahoo_finance"],
                "universe_scope": "screener_universe",
                "market_context_symbols": ["SPY"],
                "llm": {
                    "enabled": True,
                    "provider": "openai",
                    "model": "gpt-4.1-mini",
                    "base_url": "https://api.openai.com/v1",
                    "api_key": "legacy-inline-key",
                    "enable_cache": True,
                    "enable_audit": True,
                    "cache_path": "data/intelligence/llm_cache.json",
                    "audit_path": "data/intelligence/llm_audit",
                    "max_concurrency": 4,
                },
            },
            "bootstrapped_from_strategy": False,
            "updated_at": "2026-03-18T10:00:00",
        }
    )

    service = IntelligenceConfigService(
        strategy_repo=_FakeStrategyRepo(),
        config_repo=config_repo,
        symbol_sets_repo=symbol_sets_repo,
    )

    cfg = service.get_config()
    saved = config_repo.load_raw()

    assert cfg.llm.provider == "openai"
    assert saved is not None
    assert "api_key" not in saved["config"]["llm"]


def test_get_config_migrates_legacy_mock_provider_to_openai_when_env_ready(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    config_repo = IntelligenceConfigRepository(tmp_path / "config.json")
    symbol_sets_repo = IntelligenceSymbolSetsRepository(tmp_path / "symbol_sets.json")
    config_repo.save_raw(
        {
            "config": {
                "enabled": True,
                "providers": ["yahoo_finance"],
                "universe_scope": "screener_universe",
                "market_context_symbols": ["SPY"],
                "llm": {
                    "enabled": True,
                    "provider": "mock",
                    "model": "gpt-4.1-mini",
                    "base_url": "https://api.openai.com/v1",
                    "enable_cache": True,
                    "enable_audit": True,
                    "cache_path": "data/intelligence/llm_cache.json",
                    "audit_path": "data/intelligence/llm_audit",
                    "max_concurrency": 4,
                },
            },
            "bootstrapped_from_strategy": False,
            "updated_at": "2026-03-18T10:00:00",
        }
    )

    service = IntelligenceConfigService(
        strategy_repo=_FakeStrategyRepo(),
        config_repo=config_repo,
        symbol_sets_repo=symbol_sets_repo,
    )

    cfg = service.get_config()
    saved = config_repo.load_raw()

    assert cfg.llm.provider == "openai"
    assert saved is not None
    assert saved["config"]["llm"]["provider"] == "openai"
    assert saved["config"]["llm"]["model"] == "gpt-4.1-mini"
    assert saved["config"]["llm"]["base_url"] == "https://api.openai.com/v1"
