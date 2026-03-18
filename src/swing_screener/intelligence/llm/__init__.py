"""LLM-based event classification for market intelligence.

This module provides semantic interpretation of financial news using LLMs
while preserving deterministic decision-making. LLMs classify and structure
events but never predict prices or generate trading signals.
"""

from .classifier import EventClassifier
from .client import LLMProvider, MockLLMProvider
from .factory import build_event_classifier, build_llm_provider
from .langchain_provider import LangChainOpenAIProvider
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
    "LangChainOpenAIProvider",
    "build_event_classifier",
    "build_llm_provider",
]
