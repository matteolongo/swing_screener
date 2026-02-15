"""Event classifier with caching and audit logging.

Wraps LLM provider with production features:
- Hash-based response caching to reduce API calls
- Audit logging (raw inputs/outputs) for debugging
- Timing and metadata tracking
"""

import hashlib
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

from .client import LLMProvider
from .prompts import PROMPT_VERSION
from .schemas import ClassificationResult, EventClassification, RawNewsItem


class EventClassifier:
    """Production-grade event classifier with caching and logging.
    
    Coordinates between LLM provider, cache storage, and audit logs
    to provide reliable, auditable event classification.
    """
    
    def __init__(
        self,
        provider: LLMProvider,
        cache_path: Optional[Path] = None,
        audit_path: Optional[Path] = None,
        enable_cache: bool = True,
        enable_audit: bool = True,
    ):
        """Initialize event classifier.
        
        Args:
            provider: LLM provider instance
            cache_path: Path to cache file (default: data/intelligence/llm_cache.json)
            audit_path: Path to audit log directory (default: data/intelligence/llm_audit/)
            enable_cache: Whether to use caching
            enable_audit: Whether to write audit logs
        """
        self.provider = provider
        self.enable_cache = enable_cache
        self.enable_audit = enable_audit
        
        # Set default paths
        if cache_path is None:
            cache_path = Path("data/intelligence/llm_cache.json")
        if audit_path is None:
            audit_path = Path("data/intelligence/llm_audit")
        
        self.cache_path = cache_path
        self.audit_path = audit_path
        
        # Ensure directories exist
        if enable_cache:
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        if enable_audit:
            self.audit_path.mkdir(parents=True, exist_ok=True)
        
        # Load cache
        self._cache: dict[str, dict] = {}
        if enable_cache and self.cache_path.exists():
            try:
                with open(self.cache_path) as f:
                    self._cache = json.load(f)
            except Exception:
                # If cache is corrupted, start fresh
                self._cache = {}
    
    def _compute_cache_key(self, headline: str, snippet: str) -> str:
        """Compute cache key from headline and snippet.
        
        Uses SHA256 hash of concatenated text to create deterministic key.
        """
        text = f"{headline}|{snippet}|{PROMPT_VERSION}"
        return hashlib.sha256(text.encode()).hexdigest()
    
    def _get_from_cache(self, cache_key: str) -> Optional[EventClassification]:
        """Retrieve classification from cache if available."""
        if not self.enable_cache:
            return None
        
        cached_data = self._cache.get(cache_key)
        if cached_data is None:
            return None
        
        try:
            return EventClassification.model_validate(cached_data)
        except Exception:
            # If cached data is invalid, ignore it
            return None
    
    def _save_to_cache(self, cache_key: str, classification: EventClassification):
        """Save classification to cache."""
        if not self.enable_cache:
            return
        
        self._cache[cache_key] = classification.model_dump()
        
        # Write cache file (atomic write)
        tmp_path = self.cache_path.with_suffix(".tmp")
        try:
            with open(tmp_path, "w") as f:
                json.dump(self._cache, f, indent=2)
            tmp_path.replace(self.cache_path)
        except Exception:
            # If cache write fails, continue without caching
            if tmp_path.exists():
                tmp_path.unlink()
    
    def _write_audit_log(self, result: ClassificationResult):
        """Append classification result to audit log.
        
        Writes one JSONL entry per classification to daily log file.
        """
        if not self.enable_audit:
            return
        
        # Use daily log files
        date_str = datetime.now().strftime("%Y-%m-%d")
        log_file = self.audit_path / f"{date_str}.jsonl"
        
        try:
            with open(log_file, "a") as f:
                log_entry = {
                    "timestamp": datetime.now().isoformat(),
                    "headline": result.news_item.headline,
                    "snippet": result.news_item.snippet,
                    "classification": result.classification.model_dump(),
                    "model": result.model_name,
                    "prompt_version": result.prompt_version,
                    "cached": result.cached,
                    "processing_time_ms": result.processing_time_ms,
                }
                f.write(json.dumps(log_entry) + "\n")
        except Exception:
            # If audit write fails, continue without logging
            pass
    
    def classify(
        self,
        headline: str,
        snippet: str = "",
        source: Optional[str] = None,
        timestamp: Optional[str] = None,
    ) -> ClassificationResult:
        """Classify a news headline into structured event.
        
        Checks cache first, then calls LLM provider if needed.
        Records timing, metadata, and writes audit log.
        
        Args:
            headline: News headline to classify
            snippet: Optional article snippet for context
            source: Optional news source
            timestamp: Optional publication timestamp
        
        Returns:
            ClassificationResult with classification and metadata
        
        Raises:
            RuntimeError: If LLM provider is unavailable
            ValueError: If classification fails validation
        """
        news_item = RawNewsItem(
            headline=headline,
            snippet=snippet,
            source=source,
            timestamp=timestamp,
        )
        
        # Check cache
        cache_key = self._compute_cache_key(headline, snippet or "")
        cached_classification = self._get_from_cache(cache_key)
        
        if cached_classification is not None:
            # Return cached result
            result = ClassificationResult(
                news_item=news_item,
                classification=cached_classification,
                model_name=self.provider.model_name,
                prompt_version=PROMPT_VERSION,
                processing_time_ms=0.0,
                cached=True,
            )
            return result
        
        # Call LLM provider
        start_time = time.perf_counter()
        classification = self.provider.classify_event(headline, snippet or "")
        end_time = time.perf_counter()
        
        processing_time_ms = (end_time - start_time) * 1000
        
        # Save to cache
        self._save_to_cache(cache_key, classification)
        
        # Build result
        result = ClassificationResult(
            news_item=news_item,
            classification=classification,
            model_name=self.provider.model_name,
            prompt_version=PROMPT_VERSION,
            processing_time_ms=processing_time_ms,
            cached=False,
        )
        
        # Write audit log
        self._write_audit_log(result)
        
        return result
    
    def classify_batch(
        self,
        items: list[tuple[str, str]],
    ) -> list[ClassificationResult]:
        """Classify multiple headlines in batch.
        
        Args:
            items: List of (headline, snippet) tuples
        
        Returns:
            List of ClassificationResult objects in same order
        """
        results = []
        for headline, snippet in items:
            result = self.classify(headline, snippet)
            results.append(result)
        return results
    
    def get_cache_stats(self) -> dict:
        """Return cache statistics."""
        return {
            "total_entries": len(self._cache),
            "cache_enabled": self.enable_cache,
            "cache_path": str(self.cache_path),
        }
    
    def clear_cache(self):
        """Clear all cached classifications."""
        self._cache = {}
        if self.cache_path.exists():
            self.cache_path.unlink()
