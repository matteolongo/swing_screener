"""LangChain-backed provider implementations (Ollama and OpenAI)."""
from __future__ import annotations

import json
import os
from typing import Optional

from .client import LLMProvider
from .prompts import SYSTEM_PROMPT, build_user_prompt
from .schemas import EventClassification


def _extract_json_payload(raw_content: str) -> dict:
    text = str(raw_content or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise


class LangChainOllamaProvider(LLMProvider):
    """LLM provider using LangChain + Ollama chat models."""

    def __init__(
        self,
        model: str = "mistral:7b-instruct",
        base_url: Optional[str] = None,
    ) -> None:
        self._model = model
        self._base_url = base_url or os.environ.get("OLLAMA_HOST", "http://localhost:11434")
        self._llm = None

    def _get_llm(self):
        if self._llm is None:
            try:
                from langchain_ollama import ChatOllama
            except ImportError as exc:
                raise RuntimeError(
                    "langchain-ollama is not installed. Install dependencies for LangChain integration."
                ) from exc

            self._llm = ChatOllama(
                model=self._model,
                base_url=self._base_url,
                temperature=0,
            )
        return self._llm

    def is_available(self) -> bool:
        try:
            import ollama

            client = ollama.Client(host=self._base_url)
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
            return any(self._model in name for name in names)
        except Exception:
            return False

    @property
    def model_name(self) -> str:
        return self._model

    def classify_event(self, headline: str, snippet: str = "") -> EventClassification:
        if not self.is_available():
            raise RuntimeError(
                f"Ollama model '{self._model}' not available at '{self._base_url}'."
            )

        llm = self._get_llm()
        user_prompt = build_user_prompt(headline, snippet)
        try:
            from langchain_core.messages import HumanMessage, SystemMessage

            response = llm.invoke(
                [
                    SystemMessage(content=SYSTEM_PROMPT),
                    HumanMessage(content=user_prompt),
                ]
            )
            payload = _extract_json_payload(getattr(response, "content", ""))
            return EventClassification.model_validate(payload)
        except json.JSONDecodeError as exc:
            raise ValueError(f"LLM returned invalid JSON: {exc}") from exc
        except Exception as exc:
            raise RuntimeError(f"Classification failed: {exc}") from exc


class LangChainOpenAIProvider(LLMProvider):
    """LLM provider using LangChain + OpenAI chat models."""

    def __init__(
        self,
        model: str = "gpt-4o-mini",
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> None:
        self._model = str(model).strip() or "gpt-4o-mini"
        self._base_url = base_url or os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
        self._api_key = str(api_key or os.environ.get("OPENAI_API_KEY", "")).strip()
        self._llm = None

    def _get_llm(self):
        if self._llm is None:
            if not self._api_key:
                raise RuntimeError("OPENAI API key is required for provider 'openai'.")
            try:
                from langchain_openai import ChatOpenAI
            except ImportError as exc:
                raise RuntimeError(
                    "langchain-openai is not installed. Install dependencies for OpenAI integration."
                ) from exc

            self._llm = ChatOpenAI(
                model=self._model,
                temperature=0,
                api_key=self._api_key,
                base_url=self._base_url,
            )
        return self._llm

    def is_available(self) -> bool:
        return bool(self._api_key)

    @property
    def model_name(self) -> str:
        return self._model

    def classify_event(self, headline: str, snippet: str = "") -> EventClassification:
        if not self.is_available():
            raise RuntimeError("OpenAI API key is required and currently missing.")

        llm = self._get_llm()
        user_prompt = build_user_prompt(headline, snippet)
        try:
            from langchain_core.messages import HumanMessage, SystemMessage

            response = llm.invoke(
                [
                    SystemMessage(content=SYSTEM_PROMPT),
                    HumanMessage(content=user_prompt),
                ]
            )
            payload = _extract_json_payload(getattr(response, "content", ""))
            return EventClassification.model_validate(payload)
        except json.JSONDecodeError as exc:
            raise ValueError(f"LLM returned invalid JSON: {exc}") from exc
        except Exception as exc:
            raise RuntimeError(f"Classification failed: {exc}") from exc
