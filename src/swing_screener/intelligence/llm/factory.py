"""Factory helpers for intelligence LLM providers, chat models, and classifiers."""
from __future__ import annotations

from typing import Optional

from swing_screener.intelligence.config import default_model_for_llm_provider
from swing_screener.runtime_env import get_openai_api_key, get_openai_base_url

from .classifier import EventClassifier
from .client import MockLLMProvider
from .langchain_provider import LangChainOpenAIProvider


def build_langchain_chat_model(
    *,
    provider_name: str,
    model: str,
    base_url: Optional[str],
    api_key: Optional[str] = None,
    temperature: float = 0,
    max_retries: int = 0,
):
    """Build a LangChain chat model for shared API/agent orchestration."""
    normalized = str(provider_name).strip().lower()

    if normalized == "openai":
        resolved_api_key = str(api_key or get_openai_api_key()).strip()
        if not resolved_api_key:
            raise RuntimeError("OPENAI API key is required for provider 'openai'.")
        try:
            from langchain_openai import ChatOpenAI
        except ImportError as exc:
            raise RuntimeError(
                "langchain-openai is not installed. Install dependencies for OpenAI integration."
            ) from exc
        return ChatOpenAI(
            model=str(model).strip() or default_model_for_llm_provider("openai"),
            temperature=temperature,
            api_key=resolved_api_key,
            base_url=base_url or get_openai_base_url(),
            max_retries=max_retries,
        )

    if normalized == "mock":
        raise RuntimeError("Provider 'mock' does not expose a LangChain chat model.")

    raise RuntimeError(f"Unsupported LangChain chat model provider: {provider_name}")


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
    if normalized == "openai":
        return LangChainOpenAIProvider(
            model=model,
            base_url=base_url,
            api_key=api_key,
            system_prompt=system_prompt,
            user_prompt_template=user_prompt_template,
        )
    raise ValueError(f"Unsupported LLM provider: {provider_name}. Allowed: mock, openai")


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
