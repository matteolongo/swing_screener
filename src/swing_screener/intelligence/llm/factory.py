"""Factory helpers for intelligence LLM providers and classifiers."""
from __future__ import annotations

from typing import Optional

from .classifier import EventClassifier
from .client import MockLLMProvider
from .langchain_provider import LangChainOllamaProvider, LangChainOpenAIProvider


def build_llm_provider(
    *,
    provider_name: str,
    model: str,
    base_url: Optional[str],
    api_key: Optional[str] = None,
    system_prompt: Optional[str] = None,
    user_prompt_template: Optional[str] = None,
):
    normalized = str(provider_name).strip().lower()
    if normalized == "mock":
        return MockLLMProvider()
    if normalized == "ollama":
        return LangChainOllamaProvider(
            model=model,
            base_url=base_url,
            system_prompt=system_prompt,
            user_prompt_template=user_prompt_template,
        )
    if normalized == "openai":
        return LangChainOpenAIProvider(
            model=model,
            base_url=base_url,
            api_key=api_key,
            system_prompt=system_prompt,
            user_prompt_template=user_prompt_template,
        )
    raise ValueError(f"Unsupported LLM provider: {provider_name}. Allowed: ollama, mock, openai")


def build_event_classifier(
    *,
    provider_name: str,
    model: str,
    base_url: Optional[str],
    api_key: Optional[str],
    cache_path: Optional[str],
    audit_path: Optional[str],
    enable_cache: bool,
    enable_audit: bool,
    system_prompt: Optional[str] = None,
    user_prompt_template: Optional[str] = None,
) -> EventClassifier:
    provider = build_llm_provider(
        provider_name=provider_name,
        model=model,
        base_url=base_url,
        api_key=api_key,
        system_prompt=system_prompt,
        user_prompt_template=user_prompt_template,
    )
    return EventClassifier(
        provider=provider,
        cache_path=cache_path,
        audit_path=audit_path,
        enable_cache=enable_cache,
        enable_audit=enable_audit,
    )
