"""Integration tests for LLM classification with live Ollama.

These tests require a running Ollama instance and are skipped by default.
Run with: pytest -m integration
"""

import pytest

from swing_screener.intelligence.llm import (
    EventClassifier,
    EventSeverity,
    EventType,
    OllamaProvider,
)


@pytest.mark.integration
class TestOllamaIntegration:
    """Integration tests for Ollama provider.
    
    These tests require Ollama to be running with mistral:7b-instruct model.
    Skip with: pytest -m "not integration"
    """
    
    def test_ollama_availability(self):
        """Test that Ollama is available and model is loaded."""
        provider = OllamaProvider(model="mistral:7b-instruct")
        assert provider.is_available(), (
            "Ollama not available. Ensure Ollama is running and "
            "mistral:7b-instruct model is pulled."
        )
    
    def test_ollama_classify_earnings_event(self):
        """Test classifying an earnings event with live Ollama."""
        provider = OllamaProvider(model="mistral:7b-instruct")
        
        if not provider.is_available():
            pytest.skip("Ollama not available")
        
        classifier = EventClassifier(
            provider=provider,
            enable_cache=False,  # Disable cache for integration test
            enable_audit=False,
        )
        
        result = classifier.classify(
            headline="Apple reports record Q4 earnings beating analyst estimates",
            snippet="Apple Inc. announced quarterly revenue of $90B, exceeding expectations.",
        )
        
        # Verify classification structure
        assert result.classification is not None
        assert result.classification.event_type == EventType.EARNINGS
        assert result.classification.severity in (EventSeverity.HIGH, EventSeverity.MEDIUM)
        assert result.classification.primary_symbol in ("AAPL", None)
        assert result.classification.confidence >= 0.7
        assert len(result.classification.summary) >= 10
        assert result.processing_time_ms > 0
        assert result.cached is False
    
    def test_ollama_classify_ma_event(self):
        """Test classifying an M&A event with live Ollama."""
        provider = OllamaProvider(model="mistral:7b-instruct")
        
        if not provider.is_available():
            pytest.skip("Ollama not available")
        
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
    
    def test_ollama_classify_product_event(self):
        """Test classifying a product launch with live Ollama."""
        provider = OllamaProvider(model="mistral:7b-instruct")
        
        if not provider.is_available():
            pytest.skip("Ollama not available")
        
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
    
    def test_ollama_batch_classification(self):
        """Test batch classification with live Ollama."""
        provider = OllamaProvider(model="mistral:7b-instruct")
        
        if not provider.is_available():
            pytest.skip("Ollama not available")
        
        classifier = EventClassifier(
            provider=provider,
            enable_cache=False,
            enable_audit=False,
        )
        
        items = [
            ("NVDA reports strong GPU sales", ""),
            ("Amazon announces partnership with major retailer", ""),
            ("Fed raises interest rates by 25 basis points", ""),
        ]
        
        results = classifier.classify_batch(items)
        
        assert len(results) == 3
        assert results[0].classification.event_type == EventType.EARNINGS
        assert results[1].classification.event_type == EventType.PARTNERSHIP
        assert results[2].classification.event_type == EventType.MACRO
    
    def test_ollama_caching_behavior(self):
        """Test that caching works with live Ollama."""
        provider = OllamaProvider(model="mistral:7b-instruct")
        
        if not provider.is_available():
            pytest.skip("Ollama not available")
        
        classifier = EventClassifier(
            provider=provider,
            enable_cache=True,
            enable_audit=False,
        )
        
        headline = "Unique headline for caching test with timestamp 12345"
        
        # First call - not cached
        result1 = classifier.classify(headline, "")
        assert result1.cached is False
        assert result1.processing_time_ms > 0
        
        # Second call - should be cached
        result2 = classifier.classify(headline, "")
        assert result2.cached is True
        assert result2.processing_time_ms < result1.processing_time_ms
        
        # Verify same classification
        assert result1.classification.event_type == result2.classification.event_type
    
    def test_ollama_summary_validation(self):
        """Test that Ollama produces valid summaries."""
        provider = OllamaProvider(model="mistral:7b-instruct")
        
        if not provider.is_available():
            pytest.skip("Ollama not available")
        
        classifier = EventClassifier(
            provider=provider,
            enable_cache=False,
            enable_audit=False,
        )
        
        result = classifier.classify(
            headline="Google announces quarterly results",
            snippet="Alphabet Inc. reported Q3 financial results.",
        )
        
        summary = result.classification.summary
        
        # Check summary doesn't contain speculative language
        prohibited = ["could", "might", "may", "likely", "expected to", "will drive"]
        summary_lower = summary.lower()
        for phrase in prohibited:
            assert phrase not in summary_lower, f"Summary contains prohibited phrase: {phrase}"
        
        # Check summary is within length bounds
        assert 10 <= len(summary) <= 200
    
    def test_ollama_with_custom_base_url(self):
        """Test Ollama with custom base URL."""
        import os
        base_url = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
        
        provider = OllamaProvider(
            model="mistral:7b-instruct",
            base_url=base_url,
        )
        
        # Should work with custom URL if Ollama is running
        if provider.is_available():
            classifier = EventClassifier(provider=provider, enable_cache=False, enable_audit=False)
            result = classifier.classify("Test headline for custom URL", "")
            assert result.classification is not None
