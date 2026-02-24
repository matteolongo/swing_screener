"""LLM-based event classification for market intelligence.

This module provides semantic interpretation of financial news using LLMs
while preserving deterministic decision-making. LLMs classify and structure
events but never predict prices or generate trading signals.
"""

from .classifier import EventClassifier
from .gateway import LangChainLLMGateway, get_llm_gateway
from .client import (
    AnthropicProvider,
    LLMProvider,
    MockLLMProvider,
    OllamaProvider,
    OpenAIProvider,
)
from .schemas import (
    EventClassification,
    EventSeverity,
    EventType,
)


def get_llm_provider(
    provider_name: str,
    model: str | None = None,
    api_key: str | None = None,
    base_url: str | None = None,
) -> LangChainLLMGateway:
    """Backward-compatible alias for gateway-based provider construction."""
    return get_llm_gateway(
        provider_name=provider_name,
        model=model,
        api_key=api_key,
        base_url=base_url,
    )


__all__ = [
    "EventClassifier",
    "EventClassification",
    "EventSeverity",
    "EventType",
    "LangChainLLMGateway",
    "get_llm_gateway",
    "get_llm_provider",
    "LLMProvider",
    "MockLLMProvider",
    "OllamaProvider",
    "OpenAIProvider",
    "AnthropicProvider",
]
