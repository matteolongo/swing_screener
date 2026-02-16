"""Tests for LLM event classifier with caching and audit logging."""

import json
import tempfile
from pathlib import Path

import pytest

from swing_screener.intelligence.llm.classifier import EventClassifier
from swing_screener.intelligence.llm.client import MockLLMProvider
from swing_screener.intelligence.llm.schemas import EventSeverity, EventType


class TestEventClassifier:
    """Test event classifier functionality."""
    
    def test_classify_single_event(self):
        """Test classifying a single news headline."""
        provider = MockLLMProvider()
        classifier = EventClassifier(provider=provider, enable_cache=False, enable_audit=False)
        
        result = classifier.classify(
            headline="NVDA beats earnings expectations",
            snippet="NVIDIA reported strong quarterly results.",
        )
        
        assert result is not None
        assert result.classification is not None
        assert result.model_name == "mock-classifier"
        assert result.processing_time_ms >= 0
        assert result.cached is False
    
    def test_classify_with_caching(self):
        """Test that identical headlines are cached."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache_path = Path(tmpdir) / "test_cache.json"
            provider = MockLLMProvider()
            classifier = EventClassifier(
                provider=provider,
                cache_path=cache_path,
                enable_cache=True,
                enable_audit=False,
            )
            
            # First call - not cached
            result1 = classifier.classify(
                headline="AAPL announces new product",
                snippet="Apple unveiled a new device.",
            )
            assert result1.cached is False
            
            # Second call - should be cached
            result2 = classifier.classify(
                headline="AAPL announces new product",
                snippet="Apple unveiled a new device.",
            )
            assert result2.cached is True
            assert result2.classification.event_type == result1.classification.event_type
            
            # Different headline - not cached
            result3 = classifier.classify(
                headline="MSFT reports earnings",
                snippet="Microsoft beat expectations.",
            )
            assert result3.cached is False
    
    def test_cache_persistence(self):
        """Test that cache persists across classifier instances."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache_path = Path(tmpdir) / "test_cache.json"
            provider = MockLLMProvider()
            
            # First classifier instance
            classifier1 = EventClassifier(
                provider=provider,
                cache_path=cache_path,
                enable_cache=True,
                enable_audit=False,
            )
            
            result1 = classifier1.classify(
                headline="Test headline for caching",
                snippet="Test snippet.",
            )
            assert result1.cached is False
            
            # Second classifier instance (loads cache)
            classifier2 = EventClassifier(
                provider=provider,
                cache_path=cache_path,
                enable_cache=True,
                enable_audit=False,
            )
            
            result2 = classifier2.classify(
                headline="Test headline for caching",
                snippet="Test snippet.",
            )
            assert result2.cached is True
    
    def test_audit_logging(self):
        """Test that classifications are logged to audit file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            audit_path = Path(tmpdir) / "audit"
            provider = MockLLMProvider()
            classifier = EventClassifier(
                provider=provider,
                enable_cache=False,
                audit_path=audit_path,
                enable_audit=True,
            )
            
            classifier.classify(
                headline="Test audit logging",
                snippet="Test snippet.",
            )
            
            # Check audit file was created
            audit_files = list(audit_path.glob("*.jsonl"))
            assert len(audit_files) == 1
            
            # Check audit entry
            with open(audit_files[0]) as f:
                line = f.readline()
                entry = json.loads(line)
                
            assert "timestamp" in entry
            assert entry["headline"] == "Test audit logging"
            assert entry["snippet"] == "Test snippet."
            assert "classification" in entry
            assert entry["model"] == "mock-classifier"
    
    def test_classify_batch(self):
        """Test batch classification."""
        provider = MockLLMProvider()
        classifier = EventClassifier(provider=provider, enable_cache=False, enable_audit=False)
        
        items = [
            ("AAPL beats earnings", "Apple reported strong results."),
            ("MSFT launches product", "Microsoft unveiled new software."),
            ("GOOGL faces regulatory scrutiny", "Google under investigation."),
        ]
        
        results = classifier.classify_batch(items)
        
        assert len(results) == 3
        assert all(r.classification is not None for r in results)
        assert results[0].news_item.headline == "AAPL beats earnings"
        assert results[1].news_item.headline == "MSFT launches product"
        assert results[2].news_item.headline == "GOOGL faces regulatory scrutiny"
    
    def test_get_cache_stats(self):
        """Test cache statistics."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache_path = Path(tmpdir) / "test_cache.json"
            provider = MockLLMProvider()
            classifier = EventClassifier(
                provider=provider,
                cache_path=cache_path,
                enable_cache=True,
                enable_audit=False,
            )
            
            # Initially empty
            stats = classifier.get_cache_stats()
            assert stats["total_entries"] == 0
            assert stats["cache_enabled"] is True
            
            # Add one entry
            classifier.classify("Test headline for stats", "")
            
            stats = classifier.get_cache_stats()
            assert stats["total_entries"] == 1
    
    def test_clear_cache(self):
        """Test clearing cache."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache_path = Path(tmpdir) / "test_cache.json"
            provider = MockLLMProvider()
            classifier = EventClassifier(
                provider=provider,
                cache_path=cache_path,
                enable_cache=True,
                enable_audit=False,
            )
            
            # Add entry
            classifier.classify("Test headline", "")
            assert classifier.get_cache_stats()["total_entries"] == 1
            
            # Clear cache
            classifier.clear_cache()
            assert classifier.get_cache_stats()["total_entries"] == 0
    
    def test_disabled_cache(self):
        """Test that cache can be disabled."""
        provider = MockLLMProvider()
        classifier = EventClassifier(provider=provider, enable_cache=False, enable_audit=False)
        
        # Two identical calls should both show cached=False
        result1 = classifier.classify("Test headline", "")
        result2 = classifier.classify("Test headline", "")
        
        assert result1.cached is False
        assert result2.cached is False


class TestMockLLMProvider:
    """Test mock LLM provider behavior."""
    
    def test_mock_provider_always_available(self):
        """Test mock provider reports as available."""
        provider = MockLLMProvider()
        assert provider.is_available() is True
    
    def test_mock_provider_model_name(self):
        """Test mock provider returns correct model name."""
        provider = MockLLMProvider()
        assert provider.model_name == "mock-classifier"
    
    def test_mock_earnings_classification(self):
        """Test mock provider classifies earnings correctly."""
        provider = MockLLMProvider()
        classification = provider.classify_event(
            headline="AAPL beats earnings with strong revenue growth",
            snippet="",
        )
        
        assert classification.event_type == EventType.EARNINGS
        assert classification.severity == EventSeverity.HIGH
        assert classification.primary_symbol == "AAPL"
    
    def test_mock_product_classification(self):
        """Test mock provider classifies product launches."""
        provider = MockLLMProvider()
        classification = provider.classify_event(
            headline="Company launches new product line",
            snippet="",
        )
        
        assert classification.event_type == EventType.PRODUCT
        assert classification.severity == EventSeverity.MEDIUM
    
    def test_mock_analyst_classification(self):
        """Test mock provider classifies analyst actions."""
        provider = MockLLMProvider()
        classification = provider.classify_event(
            headline="Analyst upgrades TSLA to Buy rating",
            snippet="",
        )
        
        assert classification.event_type == EventType.ANALYST
        assert classification.severity == EventSeverity.LOW
    
    def test_mock_symbol_extraction(self):
        """Test mock provider extracts ticker symbols."""
        provider = MockLLMProvider()
        classification = provider.classify_event(
            headline="NVDA and AMD benefit from AI chip demand",
            snippet="",
        )
        
        assert classification.primary_symbol in ["NVDA", "AMD"]
        # Either could be secondary depending on which is primary
        assert len(classification.secondary_symbols) >= 0
