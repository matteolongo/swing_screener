"""LLM-based event classification for market intelligence.

This module provides semantic interpretation of financial news using LLMs
while preserving deterministic decision-making. LLMs classify and structure
events but never predict prices or generate trading signals.
"""

from .classifier import EventClassifier
from .client import (
    AnthropicProvider,
    LLMProvider,
    MockLLMProvider,
    OllamaProvider,
    OpenAIProvider,
    get_llm_provider,
)
from .schemas import (
    EventClassification,
    EventSeverity,
    EventType,
)

__all__ = [
    "EventClassifier",
    "EventClassification",
    "EventSeverity",
    "EventType",
    "LLMProvider",
    "MockLLMProvider",
    "OllamaProvider",
    "OpenAIProvider",
    "AnthropicProvider",
    "get_llm_provider",
]
