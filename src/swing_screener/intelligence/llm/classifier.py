"""Event classifier with caching and audit logging."""

from __future__ import annotations

import hashlib
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from .gateway import LangChainLLMGateway, get_llm_gateway
from .prompts import PROMPT_VERSION
from .schemas import ClassificationResult, EventClassification, RawNewsItem


class EventClassifier:
    """Production-grade event classifier with caching and audit logging."""

    def __init__(
        self,
        provider: Any,
        cache_path: Optional[Path | str] = None,
        cache_dir: Optional[Path | str] = None,
        audit_path: Optional[Path | str] = None,
        enable_cache: bool = True,
        enable_audit: bool = True,
    ):
        self.provider = provider
        self.enable_cache = enable_cache
        self.enable_audit = enable_audit

        if cache_path is None:
            if cache_dir is not None:
                cache_path = Path(cache_dir) / "llm_cache.json"
            else:
                cache_path = Path("data/intelligence/llm_cache.json")
        if audit_path is None:
            audit_path = Path("data/intelligence/llm_audit")

        self.cache_path = Path(cache_path)
        self.audit_path = Path(audit_path)

        if enable_cache:
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        if enable_audit:
            self.audit_path.mkdir(parents=True, exist_ok=True)

        self._cache: dict[str, dict] = {}
        if enable_cache and self.cache_path.exists():
            try:
                with open(self.cache_path, encoding="utf-8") as handle:
                    self._cache = json.load(handle)
            except Exception:
                self._cache = {}

    @classmethod
    def from_provider_config(
        cls,
        *,
        provider_name: str,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        cache_path: Optional[Path | str] = None,
        cache_dir: Optional[Path | str] = None,
        audit_path: Optional[Path | str] = None,
        enable_cache: bool = True,
        enable_audit: bool = True,
    ) -> "EventClassifier":
        gateway = get_llm_gateway(
            provider_name=provider_name,
            model=model,
            api_key=api_key,
            base_url=base_url,
        )
        return cls(
            provider=gateway,
            cache_path=cache_path,
            cache_dir=cache_dir,
            audit_path=audit_path,
            enable_cache=enable_cache,
            enable_audit=enable_audit,
        )

    @property
    def model_name(self) -> str:
        return str(getattr(self.provider, "model_name", "unknown"))

    @property
    def provider_name(self) -> str:
        if isinstance(self.provider, LangChainLLMGateway):
            return self.provider.provider_name
        return str(getattr(self.provider, "provider_name", "legacy"))

    @property
    def availability_error(self) -> Optional[str]:
        return getattr(self.provider, "availability_error", None)

    def is_available(self) -> bool:
        checker = getattr(self.provider, "is_available", None)
        if callable(checker):
            try:
                return bool(checker())
            except Exception:
                return False
        return True

    def _compute_cache_key(self, headline: str, snippet: str) -> str:
        text = f"{headline}|{snippet}|{PROMPT_VERSION}"
        return hashlib.sha256(text.encode()).hexdigest()

    def _get_from_cache(self, cache_key: str) -> Optional[EventClassification]:
        if not self.enable_cache:
            return None

        cached_data = self._cache.get(cache_key)
        if cached_data is None:
            return None

        try:
            return EventClassification.model_validate(cached_data)
        except Exception:
            return None

    def _save_to_cache(self, cache_key: str, classification: EventClassification):
        if not self.enable_cache:
            return

        self._cache[cache_key] = classification.model_dump()

        tmp_path = self.cache_path.with_suffix(".tmp")
        try:
            with open(tmp_path, "w", encoding="utf-8") as handle:
                json.dump(self._cache, handle, indent=2)
            tmp_path.replace(self.cache_path)
        except Exception:
            if tmp_path.exists():
                tmp_path.unlink()

    def _write_audit_log(self, result: ClassificationResult):
        if not self.enable_audit:
            return

        date_str = datetime.now().strftime("%Y-%m-%d")
        log_file = self.audit_path / f"{date_str}.jsonl"

        try:
            with open(log_file, "a", encoding="utf-8") as handle:
                payload = {
                    "timestamp": datetime.now().isoformat(),
                    "headline": result.news_item.headline,
                    "snippet": result.news_item.snippet,
                    "classification": result.classification.model_dump(),
                    "model": result.model_name,
                    "prompt_version": result.prompt_version,
                    "cached": result.cached,
                    "processing_time_ms": result.processing_time_ms,
                }
                handle.write(json.dumps(payload) + "\n")
        except Exception:
            pass

    def _classify_uncached(self, headline: str, snippet: str) -> EventClassification:
        classifier = getattr(self.provider, "classify_event", None)
        if not callable(classifier):
            raise RuntimeError("Configured LLM provider does not implement classify_event.")
        return classifier(headline, snippet or "")

    def classify(
        self,
        headline: str,
        snippet: str = "",
        source: Optional[str] = None,
        timestamp: Optional[str] = None,
    ) -> ClassificationResult:
        news_item = RawNewsItem(
            headline=headline,
            snippet=snippet,
            source=source,
            timestamp=timestamp,
        )

        cache_key = self._compute_cache_key(headline, snippet or "")
        cached_classification = self._get_from_cache(cache_key)
        if cached_classification is not None:
            return ClassificationResult(
                news_item=news_item,
                classification=cached_classification,
                model_name=self.model_name,
                prompt_version=PROMPT_VERSION,
                processing_time_ms=0.0,
                cached=True,
            )

        start_time = time.perf_counter()
        classification = self._classify_uncached(headline, snippet)
        end_time = time.perf_counter()

        processing_time_ms = (end_time - start_time) * 1000
        self._save_to_cache(cache_key, classification)

        result = ClassificationResult(
            news_item=news_item,
            classification=classification,
            model_name=self.model_name,
            prompt_version=PROMPT_VERSION,
            processing_time_ms=processing_time_ms,
            cached=False,
        )
        self._write_audit_log(result)
        return result

    def classify_batch(self, items: list[tuple[str, str]]) -> list[ClassificationResult]:
        return [self.classify(headline, snippet) for headline, snippet in items]

    def get_cache_stats(self) -> dict:
        return {
            "total_entries": len(self._cache),
            "cache_enabled": self.enable_cache,
            "cache_path": str(self.cache_path),
        }

    def clear_cache(self):
        self._cache = {}
        if self.cache_path.exists():
            self.cache_path.unlink()
