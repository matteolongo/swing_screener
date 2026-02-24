"""Tests for LangChain LLM gateway behavior."""

from __future__ import annotations

import sys

import pytest

from swing_screener.intelligence.llm.gateway import LangChainLLMGateway, get_llm_gateway
from swing_screener.intelligence.llm.schemas import EventType


def test_gateway_mock_classification_and_availability():
    gateway = get_llm_gateway(provider_name="mock", model="mock-classifier")

    assert gateway.is_available() is True
    result = gateway.classify_event("NVDA beats earnings expectations", "")
    assert result.event_type in {EventType.EARNINGS, EventType.OTHER}
    assert len(result.summary) >= 10


def test_gateway_rejects_unknown_provider():
    with pytest.raises(ValueError, match="Unsupported LLM provider"):
        get_llm_gateway(provider_name="invalid-provider")


def test_gateway_openai_requires_api_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(ValueError, match="OpenAI API key required"):
        get_llm_gateway(provider_name="openai", model="gpt-4o-mini", api_key="")


def test_gateway_openai_ignores_inherited_ollama_base_url():
    gateway = get_llm_gateway(
        provider_name="openai",
        model="gpt-4o-mini",
        api_key="test-key",
        base_url="http://ollama:11434",
    )
    assert gateway.config.base_url is None


def test_gateway_openai_keeps_explicit_compatible_base_url():
    gateway = get_llm_gateway(
        provider_name="openai",
        model="gpt-4o-mini",
        api_key="test-key",
        base_url="http://ollama:11434/v1",
    )
    assert gateway.config.base_url == "http://ollama:11434/v1"


def test_gateway_anthropic_requires_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(ValueError, match="Anthropic API key required"):
        get_llm_gateway(provider_name="anthropic", model="claude-3-haiku-20240307", api_key="")


def test_gateway_ollama_probe_uses_model_list(monkeypatch):
    class _FakeClient:
        def __init__(self, host: str):
            self.host = host

        def list(self):
            return {"models": [{"name": "mistral:7b-instruct"}]}

    class _FakeOllamaModule:
        Client = _FakeClient

    monkeypatch.setitem(sys.modules, "ollama", _FakeOllamaModule)
    gateway = LangChainLLMGateway(
        provider_name="ollama",
        model="mistral:7b-instruct",
        base_url="http://ollama:11434",
    )
    assert gateway.is_available() is True


def test_gateway_ollama_probe_surfaces_reason(monkeypatch):
    class _FakeClient:
        def __init__(self, host: str):
            self.host = host

        def list(self):
            return {"models": [{"name": "llama3:latest"}]}

    class _FakeOllamaModule:
        Client = _FakeClient

    monkeypatch.setitem(sys.modules, "ollama", _FakeOllamaModule)
    gateway = LangChainLLMGateway(
        provider_name="ollama",
        model="mistral:7b-instruct",
        base_url="http://ollama:11434",
    )
    assert gateway.is_available() is False
    assert gateway.availability_error is not None
