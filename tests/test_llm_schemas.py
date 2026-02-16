"""Tests for LLM event classification schemas and validation."""

import pytest
from pydantic import ValidationError

from swing_screener.intelligence.llm.schemas import (
    EventClassification,
    EventSeverity,
    EventType,
    RawNewsItem,
)


class TestEventType:
    """Test event type enum."""
    
    def test_all_event_types_defined(self):
        """Ensure all 14 event types are present."""
        assert len(EventType) == 14
        
        # Tier 1
        assert EventType.EARNINGS in EventType
        assert EventType.GUIDANCE in EventType
        assert EventType.M_AND_A in EventType
        assert EventType.CAPITAL in EventType
        
        # Tier 2
        assert EventType.PRODUCT in EventType
        assert EventType.PARTNERSHIP in EventType
        assert EventType.MANAGEMENT in EventType
        
        # Tier 3
        assert EventType.REGULATORY in EventType
        assert EventType.LEGAL in EventType
        assert EventType.MACRO in EventType
        assert EventType.SECTOR in EventType
        
        # Tier 4
        assert EventType.ANALYST in EventType
        assert EventType.FLOW in EventType
        assert EventType.OTHER in EventType


class TestEventSeverity:
    """Test event severity enum."""
    
    def test_all_severity_levels_defined(self):
        """Ensure all 3 severity levels are present."""
        assert len(EventSeverity) == 3
        assert EventSeverity.LOW in EventSeverity
        assert EventSeverity.MEDIUM in EventSeverity
        assert EventSeverity.HIGH in EventSeverity


class TestEventClassification:
    """Test event classification model."""
    
    def test_valid_classification(self):
        """Test creating valid classification."""
        classification = EventClassification(
            event_type=EventType.EARNINGS,
            severity=EventSeverity.HIGH,
            primary_symbol="AAPL",
            secondary_symbols=["MSFT", "GOOGL"],
            is_material=True,
            confidence=0.95,
            summary="Apple reported strong quarterly earnings exceeding expectations.",
        )
        
        assert classification.event_type == EventType.EARNINGS
        assert classification.severity == EventSeverity.HIGH
        assert classification.primary_symbol == "AAPL"
        assert len(classification.secondary_symbols) == 2
        assert classification.is_material is True
        assert classification.confidence == 0.95
    
    def test_optional_symbols(self):
        """Test classification with no symbols."""
        classification = EventClassification(
            event_type=EventType.MACRO,
            severity=EventSeverity.HIGH,
            primary_symbol=None,
            secondary_symbols=[],
            is_material=True,
            confidence=0.88,
            summary="Federal Reserve raised interest rates by 25 basis points.",
        )
        
        assert classification.primary_symbol is None
        assert classification.secondary_symbols == []
    
    def test_summary_validation_min_length(self):
        """Test summary must be at least 10 characters."""
        with pytest.raises(ValidationError):
            EventClassification(
                event_type=EventType.EARNINGS,
                severity=EventSeverity.HIGH,
                primary_symbol="AAPL",
                secondary_symbols=[],
                is_material=True,
                confidence=0.95,
                summary="Short",  # Too short
            )
    
    def test_summary_validation_max_length(self):
        """Test summary must not exceed 200 characters."""
        with pytest.raises(ValidationError):
            EventClassification(
                event_type=EventType.EARNINGS,
                severity=EventSeverity.HIGH,
                primary_symbol="AAPL",
                secondary_symbols=[],
                is_material=True,
                confidence=0.95,
                summary="X" * 201,  # Too long
            )
    
    def test_summary_rejects_speculative_language(self):
        """Test summary validation rejects speculative phrases."""
        speculative_phrases = [
            "This could drive growth in the future.",
            "Earnings might improve next quarter.",
            "The stock may rise on this news.",
            "Potentially a strong catalyst for the sector.",
            "Results are likely better than expected.",
            "Expected to benefit from new policies.",
            "Will drive significant revenue growth.",
            "Should improve margins going forward.",
            "Would indicate strong demand trends.",
        ]
        
        for summary in speculative_phrases:
            with pytest.raises(ValidationError, match="speculative language"):
                EventClassification(
                    event_type=EventType.EARNINGS,
                    severity=EventSeverity.HIGH,
                    primary_symbol="AAPL",
                    secondary_symbols=[],
                    is_material=True,
                    confidence=0.95,
                    summary=summary,
                )
    
    def test_summary_accepts_factual_language(self):
        """Test summary accepts factual statements."""
        factual_summaries = [
            "Apple reported quarterly earnings exceeding analyst estimates.",
            "The company announced a new product launch date.",
            "Federal Reserve raised interest rates by 25 basis points.",
            "CEO announced resignation effective next month.",
        ]
        
        for summary in factual_summaries:
            classification = EventClassification(
                event_type=EventType.EARNINGS,
                severity=EventSeverity.HIGH,
                primary_symbol="AAPL",
                secondary_symbols=[],
                is_material=True,
                confidence=0.95,
                summary=summary,
            )
            assert classification.summary == summary
    
    def test_confidence_validation(self):
        """Test confidence must be between 0 and 1."""
        # Valid confidence
        classification = EventClassification(
            event_type=EventType.EARNINGS,
            severity=EventSeverity.HIGH,
            primary_symbol="AAPL",
            secondary_symbols=[],
            is_material=True,
            confidence=0.5,
            summary="Apple reported quarterly earnings.",
        )
        assert classification.confidence == 0.5
        
        # Invalid: too low
        with pytest.raises(ValidationError):
            EventClassification(
                event_type=EventType.EARNINGS,
                severity=EventSeverity.HIGH,
                primary_symbol="AAPL",
                secondary_symbols=[],
                is_material=True,
                confidence=-0.1,
                summary="Apple reported quarterly earnings.",
            )
        
        # Invalid: too high
        with pytest.raises(ValidationError):
            EventClassification(
                event_type=EventType.EARNINGS,
                severity=EventSeverity.HIGH,
                primary_symbol="AAPL",
                secondary_symbols=[],
                is_material=True,
                confidence=1.5,
                summary="Apple reported quarterly earnings.",
            )
    
    def test_symbol_validation(self):
        """Test symbol format validation."""
        # Valid symbols
        classification = EventClassification(
            event_type=EventType.EARNINGS,
            severity=EventSeverity.HIGH,
            primary_symbol="AAPL",
            secondary_symbols=["MSFT", "GOOGL"],
            is_material=True,
            confidence=0.95,
            summary="Apple reported quarterly earnings.",
        )
        assert classification.primary_symbol == "AAPL"
        
        # Invalid: lowercase
        with pytest.raises(ValidationError):
            EventClassification(
                event_type=EventType.EARNINGS,
                severity=EventSeverity.HIGH,
                primary_symbol="aapl",
                secondary_symbols=[],
                is_material=True,
                confidence=0.95,
                summary="Apple reported quarterly earnings.",
            )
        
        # Invalid: too long
        with pytest.raises(ValidationError):
            EventClassification(
                event_type=EventType.EARNINGS,
                severity=EventSeverity.HIGH,
                primary_symbol="TOOLONG",
                secondary_symbols=[],
                is_material=True,
                confidence=0.95,
                summary="Apple reported quarterly earnings.",
            )


class TestRawNewsItem:
    """Test raw news item model."""
    
    def test_minimal_news_item(self):
        """Test creating news item with just headline."""
        item = RawNewsItem(headline="Test headline for validation")
        assert item.headline == "Test headline for validation"
        assert item.snippet is None
        assert item.source is None
        assert item.timestamp is None
    
    def test_full_news_item(self):
        """Test creating news item with all fields."""
        item = RawNewsItem(
            headline="Apple beats earnings",
            snippet="Full article text here",
            source="Bloomberg",
            timestamp="2024-01-15T10:30:00Z",
        )
        assert item.headline == "Apple beats earnings"
        assert item.snippet == "Full article text here"
        assert item.source == "Bloomberg"
        assert item.timestamp == "2024-01-15T10:30:00Z"
    
    def test_headline_min_length(self):
        """Test headline must be at least 10 characters."""
        with pytest.raises(ValidationError):
            RawNewsItem(headline="Short")
