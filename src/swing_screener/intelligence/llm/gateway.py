"""LangChain-based gateway for event classification providers."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any, Optional
from urllib.parse import urlparse

from .prompts import SYSTEM_PROMPT, build_user_prompt
from .schemas import EventClassification, EventSeverity, EventType

SUPPORTED_LLM_PROVIDERS = {"openai", "anthropic", "ollama", "mock"}

_DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-3-haiku-20240307",
    "ollama": "mistral:7b-instruct",
    "mock": "mock-classifier",
}


def _is_ollama_root_base_url(base_url: str | None) -> bool:
    if not base_url:
        return False
    try:
        parsed = urlparse(base_url)
    except Exception:
        return False

    host = (parsed.hostname or "").strip().lower()
    port = parsed.port
    path = (parsed.path or "").rstrip("/").lower()

    # Keep explicit OpenAI-compatible endpoints (e.g. /v1) configurable.
    if path and path not in {"/", "/api"}:
        return False

    ollama_env = str(os.environ.get("OLLAMA_HOST", "")).strip().lower().rstrip("/")
    value_norm = str(base_url).strip().lower().rstrip("/")
    if ollama_env and value_norm == ollama_env:
        return True

    return host in {"localhost", "127.0.0.1", "ollama"} and port == 11434


@dataclass(frozen=True)
class LLMGatewayConfig:
    provider_name: str
    model: str
    api_key: str | None = None
    base_url: str | None = None


class LangChainLLMGateway:
    """Provider-agnostic LLM gateway backed by LangChain chat models."""

    def __init__(
        self,
        provider_name: str,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> None:
        provider = str(provider_name).strip().lower()
        if provider not in SUPPORTED_LLM_PROVIDERS:
            allowed = ", ".join(sorted(SUPPORTED_LLM_PROVIDERS))
            raise ValueError(f"Unsupported LLM provider: {provider_name}. Supported: {allowed}")

        resolved_model = str(model or _DEFAULT_MODELS[provider]).strip()
        if not resolved_model:
            raise ValueError("LLM model must be a non-empty string.")

        resolved_api_key = str(api_key or "").strip() or None
        resolved_base_url = str(base_url or "").strip() or None
        if provider in {"openai", "anthropic"} and _is_ollama_root_base_url(resolved_base_url):
            # Ignore inherited Ollama default for cloud providers.
            resolved_base_url = None

        if provider == "openai" and not (resolved_api_key or os.environ.get("OPENAI_API_KEY")):
            raise ValueError(
                "OpenAI API key required. Set OPENAI_API_KEY environment variable or configure llm.api_key."
            )
        if provider == "anthropic" and not (resolved_api_key or os.environ.get("ANTHROPIC_API_KEY")):
            raise ValueError(
                "Anthropic API key required. Set ANTHROPIC_API_KEY environment variable or configure llm.api_key."
            )

        self.config = LLMGatewayConfig(
            provider_name=provider,
            model=resolved_model,
            api_key=resolved_api_key,
            base_url=resolved_base_url,
        )
        self._last_availability_error: Optional[str] = None
        self._chat_model: Any | None = None

    @property
    def model_name(self) -> str:
        return self.config.model

    @property
    def provider_name(self) -> str:
        return self.config.provider_name

    @property
    def availability_error(self) -> Optional[str]:
        return self._last_availability_error

    def is_available(self) -> bool:
        provider = self.config.provider_name
        try:
            if provider == "mock":
                self._last_availability_error = None
                return True
            if provider == "ollama":
                self._probe_ollama()
                self._last_availability_error = None
                return True
            if provider == "openai":
                self._probe_openai()
                self._last_availability_error = None
                return True
            if provider == "anthropic":
                self._probe_anthropic()
                self._last_availability_error = None
                return True
            self._last_availability_error = f"Unsupported provider: {provider}"
            return False
        except Exception as exc:  # pragma: no cover - defensive logging path
            self._last_availability_error = str(exc)
            return False

    def classify_event(self, headline: str, snippet: str = "") -> EventClassification:
        if self.provider_name == "mock":
            return _mock_classification(headline=headline, snippet=snippet)

        chat_model = self._get_chat_model()
        user_prompt = build_user_prompt(headline, snippet)
        messages = [
            ("system", SYSTEM_PROMPT),
            ("human", user_prompt),
        ]

        structured_error: Exception | None = None
        try:
            structured_model = chat_model.with_structured_output(EventClassification)
            response = structured_model.invoke(messages)
            return EventClassification.model_validate(response)
        except Exception as exc:  # pragma: no cover - provider-dependent
            structured_error = exc

        try:
            raw = chat_model.invoke(messages)
            content = _coerce_llm_content(raw)
            data = json.loads(content)
            return EventClassification.model_validate(data)
        except Exception as fallback_exc:  # pragma: no cover - provider-dependent
            raise RuntimeError(
                "Classification failed with structured output and JSON fallback. "
                f"structured_error={structured_error}; fallback_error={fallback_exc}"
            ) from fallback_exc

    def _get_chat_model(self) -> Any:
        if self._chat_model is not None:
            return self._chat_model

        provider = self.provider_name
        model = self.model_name
        if provider == "openai":
            try:
                from langchain_openai import ChatOpenAI
            except Exception as exc:  # pragma: no cover - import-time failures vary
                raise RuntimeError(
                    "langchain-openai is unavailable. Install compatible langchain/openai dependencies."
                ) from exc
            kwargs: dict[str, Any] = {"model": model, "temperature": 0}
            if self.config.api_key:
                kwargs["api_key"] = self.config.api_key
            if self.config.base_url:
                kwargs["base_url"] = self.config.base_url
            self._chat_model = ChatOpenAI(**kwargs)
            return self._chat_model

        if provider == "anthropic":
            try:
                from langchain_anthropic import ChatAnthropic
            except Exception as exc:  # pragma: no cover - import-time failures vary
                raise RuntimeError(
                    "langchain-anthropic is unavailable. Install compatible langchain/anthropic dependencies."
                ) from exc
            kwargs = {"model": model, "temperature": 0, "max_tokens": 500}
            if self.config.api_key:
                kwargs["api_key"] = self.config.api_key
            self._chat_model = ChatAnthropic(**kwargs)
            return self._chat_model

        if provider == "ollama":
            try:
                from langchain_ollama import ChatOllama
            except Exception as exc:  # pragma: no cover - import-time failures vary
                raise RuntimeError(
                    "langchain-ollama is unavailable. Install compatible langchain/ollama dependencies."
                ) from exc
            self._chat_model = ChatOllama(
                model=model,
                temperature=0,
                base_url=self._resolved_ollama_base_url(),
                num_predict=500,
            )
            return self._chat_model

        raise RuntimeError(f"Chat model is not available for provider: {provider}")

    def _probe_openai(self) -> None:
        from openai import OpenAI

        key = self.config.api_key or os.environ.get("OPENAI_API_KEY")
        if not key:
            raise RuntimeError("OPENAI_API_KEY is not configured.")
        kwargs: dict[str, Any] = {"api_key": key}
        if self.config.base_url:
            kwargs["base_url"] = self.config.base_url
        client = OpenAI(**kwargs)
        client.models.list()

    def _probe_anthropic(self) -> None:
        from anthropic import Anthropic

        key = self.config.api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError("ANTHROPIC_API_KEY is not configured.")
        client = Anthropic(api_key=key)
        client.messages.create(
            model=self.model_name,
            max_tokens=1,
            messages=[{"role": "user", "content": "ping"}],
        )

    def _probe_ollama(self) -> None:
        import ollama

        client = ollama.Client(host=self._resolved_ollama_base_url())
        models = client.list()
        raw_models = models.get("models", []) if isinstance(models, dict) else getattr(models, "models", [])
        names: list[str] = []
        for item in raw_models or []:
            if isinstance(item, dict):
                name = item.get("name") or item.get("model") or ""
            else:
                name = getattr(item, "name", "") or getattr(item, "model", "")
            text = str(name).strip()
            if text:
                names.append(text)
        if not any(self.model_name in item for item in names):
            raise RuntimeError(
                f"Ollama model '{self.model_name}' not found at '{self._resolved_ollama_base_url()}'."
            )

    def _resolved_ollama_base_url(self) -> str:
        return self.config.base_url or os.environ.get("OLLAMA_HOST", "http://localhost:11434")


def get_llm_gateway(
    provider_name: str,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> LangChainLLMGateway:
    return LangChainLLMGateway(
        provider_name=provider_name,
        model=model,
        api_key=api_key,
        base_url=base_url,
    )


def _coerce_llm_content(raw: Any) -> str:
    if isinstance(raw, str):
        return raw
    content = getattr(raw, "content", raw)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        chunks: list[str] = []
        for item in content:
            if isinstance(item, str):
                chunks.append(item)
            elif isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    chunks.append(text)
            else:
                text = getattr(item, "text", None)
                if isinstance(text, str):
                    chunks.append(text)
        return "".join(chunks).strip()
    return str(content)


def _mock_classification(headline: str, snippet: str = "") -> EventClassification:
    headline_lower = str(headline).lower()

    if "earnings" in headline_lower or "revenue" in headline_lower:
        event_type = EventType.EARNINGS
        severity = EventSeverity.HIGH
    elif "m&a" in headline_lower or "acquisition" in headline_lower:
        event_type = EventType.M_AND_A
        severity = EventSeverity.HIGH
    elif "product" in headline_lower or "launch" in headline_lower:
        event_type = EventType.PRODUCT
        severity = EventSeverity.MEDIUM
    elif "analyst" in headline_lower or "upgrade" in headline_lower:
        event_type = EventType.ANALYST
        severity = EventSeverity.LOW
    else:
        event_type = EventType.OTHER
        severity = EventSeverity.LOW

    symbols = re.findall(r"\b[A-Z]{2,5}\b", str(headline))
    primary_symbol = symbols[0] if symbols else None
    secondary_symbols = symbols[1:3] if len(symbols) > 1 else []
    summary_input = f"{headline} {snippet}".strip()
    summary = f"Mock classification: {summary_input[:160]}".strip()
    if len(summary) < 10:
        summary = "Mock classification for provided headline."

    return EventClassification(
        event_type=event_type,
        severity=severity,
        primary_symbol=primary_symbol,
        secondary_symbols=secondary_symbols,
        is_material=severity in (EventSeverity.HIGH, EventSeverity.MEDIUM),
        confidence=0.85,
        summary=summary,
    )
