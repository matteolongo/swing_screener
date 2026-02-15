"""Tests for LLM classification with mocked Ollama (no external dependencies)."""

import pytest

from swing_screener.intelligence.llm import (
    EventClassifier,
    EventSeverity,
    EventType,
    OllamaProvider,
)


class TestOllamaWithMocks:
    """Test Ollama provider with mocked client - no real Ollama needed."""
    
    def test_ollama_availability(self, mock_ollama_provider):
        """Test that mocked Ollama reports as available."""
        provider = mock_ollama_provider(model="mistral:7b-instruct")
        assert provider.is_available()
        assert provider.model_name == "mistral:7b-instruct"
    
    def test_ollama_classify_earnings_event(self, mock_ollama_provider):
        """Test classifying an earnings event with mocked Ollama."""
        provider = mock_ollama_provider(model="mistral:7b-instruct")
        
        classifier = EventClassifier(
            provider=provider,
            enable_cache=False,
            enable_audit=False,
        )
        
        result = classifier.classify(
            headline="Apple reports record Q4 earnings beating analyst estimates",
            snippet="Apple Inc. announced quarterly revenue of $90B, exceeding expectations.",
        )
        
        # Verify classification structure
        assert result.classification is not None
        assert result.classification.event_type == EventType.EARNINGS
        assert result.classification.severity == EventSeverity.HIGH
        assert result.classification.confidence >= 0.7
        assert len(result.classification.summary) >= 10
        assert result.processing_time_ms > 0
        assert result.cached is False
    
    def test_ollama_classify_ma_event(self, mock_ollama_provider):
        """Test classifying an M&A event with mocked Ollama."""
        provider = mock_ollama_provider(model="mistral:7b-instruct")
        
        classifier = EventClassifier(
            provider=provider,
            enable_cache=False,
            enable_audit=False,
        )
        
        result = classifier.classify(
            headline="Microsoft announces acquisition of gaming company for $69 billion",
            snippet="Microsoft Corp will acquire Activision Blizzard in largest gaming deal.",
        )
        
        assert result.classification.event_type == EventType.M_AND_A
        assert result.classification.severity == EventSeverity.HIGH
        assert result.classification.is_material is True
    
    def test_ollama_classify_product_event(self, mock_ollama_provider):
        """Test classifying a product launch with mocked Ollama."""
        provider = mock_ollama_provider(model="mistral:7b-instruct")
        
        classifier = EventClassifier(
            provider=provider,
            enable_cache=False,
            enable_audit=False,
        )
        
        result = classifier.classify(
            headline="Tesla unveils new electric vehicle model with extended range",
            snippet="Tesla Inc. introduced Model Y with 400-mile range at launch event.",
        )
        
        assert result.classification.event_type == EventType.PRODUCT
        assert result.classification.severity in (EventSeverity.HIGH, EventSeverity.MEDIUM)
    
    def test_ollama_batch_classification(self, mock_ollama_provider):
        """Test batch classification with mocked Ollama."""
        provider = mock_ollama_provider(model="mistral:7b-instruct")
        
        classifier = EventClassifier(
            provider=provider,
            enable_cache=False,
            enable_audit=False,
        )
        
        items = [
            ("NVDA reports strong GPU earnings", ""),
            ("Amazon announces new product launch", ""),
            ("Fed raises interest rates by 25 basis points", ""),
        ]
        
        results = classifier.classify_batch(items)
        
        assert len(results) == 3
        # First one should be earnings (contains "earnings")
        assert results[0].classification.event_type == EventType.EARNINGS
    
    def test_ollama_caching_behavior(self, mock_ollama_provider, tmp_path):
        """Test that caching works with mocked Ollama."""
        provider = mock_ollama_provider(model="mistral:7b-instruct")
        
        classifier = EventClassifier(
            provider=provider,
            enable_cache=True,
            cache_path=tmp_path / "cache" / "llm_cache.json",
            enable_audit=False,
        )
        
        headline = "Unique headline for caching test with timestamp 12345"
        
        # First call - not cached
        result1 = classifier.classify(headline, "")
        assert result1.cached is False
        
        # Second call - should be cached
        result2 = classifier.classify(headline, "")
        assert result2.cached is True
        assert result2.processing_time_ms < result1.processing_time_ms
        
        # Verify same classification
        assert result1.classification.event_type == result2.classification.event_type
    
    def test_ollama_with_custom_base_url(self, mock_ollama_provider):
        """Test Ollama with custom base URL."""
        provider = mock_ollama_provider(
            model="mistral:7b-instruct",
            base_url="http://test-ollama:11434",
        )
        
        assert provider.is_available()
        
        classifier = EventClassifier(provider=provider, enable_cache=False, enable_audit=False)
        result = classifier.classify("Test headline for custom URL", "")
        assert result.classification is not None
