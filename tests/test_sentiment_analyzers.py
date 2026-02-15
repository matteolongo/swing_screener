"""Tests for sentiment analyzers."""
import pytest

from swing_screener.social.sentiment.base import SentimentResult
from swing_screener.social.sentiment.keyword import KeywordSentimentAnalyzer
from swing_screener.social.sentiment.factory import (
    get_sentiment_analyzer,
    list_available_analyzers,
)


def test_sentiment_result_bounds():
    """Test that sentiment result enforces bounds."""
    result = SentimentResult(1.5, 1.2)
    assert result.score == 1.0
    assert result.confidence == 1.0
    
    result = SentimentResult(-1.5, -0.1)
    assert result.score == -1.0
    assert result.confidence == 0.0


def test_keyword_analyzer_positive():
    """Test keyword analyzer with positive sentiment."""
    analyzer = KeywordSentimentAnalyzer()
    assert analyzer.name == "keyword"
    
    result = analyzer.analyze("This stock is bullish and great! Buy the dip!")
    assert result.score > 0
    assert result.confidence > 0


def test_keyword_analyzer_negative():
    """Test keyword analyzer with negative sentiment."""
    analyzer = KeywordSentimentAnalyzer()
    
    result = analyzer.analyze("Bearish crash incoming. Sell everything.")
    assert result.score < 0
    assert result.confidence > 0


def test_keyword_analyzer_neutral():
    """Test keyword analyzer with neutral text."""
    analyzer = KeywordSentimentAnalyzer()
    
    result = analyzer.analyze("The company reported quarterly earnings.")
    assert result.score == 0.0
    assert result.confidence == 0.0


def test_keyword_analyzer_empty():
    """Test keyword analyzer with empty text."""
    analyzer = KeywordSentimentAnalyzer()
    
    result = analyzer.analyze("")
    assert result.score == 0.0
    assert result.confidence == 0.0


def test_get_sentiment_analyzer_keyword():
    """Test factory returns keyword analyzer."""
    analyzer = get_sentiment_analyzer("keyword")
    assert analyzer.name == "keyword"
    assert isinstance(analyzer, KeywordSentimentAnalyzer)


def test_get_sentiment_analyzer_unknown():
    """Test factory raises error for unknown analyzer."""
    with pytest.raises(ValueError, match="Unknown sentiment analyzer"):
        get_sentiment_analyzer("unknown")


def test_list_available_analyzers():
    """Test listing available analyzers."""
    available = list_available_analyzers()
    assert "keyword" in available
    # vader may or may not be available depending on dependencies


@pytest.mark.skipif(
    not any("vader" in a for a in list_available_analyzers()),
    reason="vaderSentiment not installed"
)
def test_vader_analyzer():
    """Test VADER analyzer if available."""
    from swing_screener.social.sentiment.vader import VaderSentimentAnalyzer
    
    analyzer = VaderSentimentAnalyzer()
    assert analyzer.name == "vader"
    
    # VADER should handle more complex sentiment
    result = analyzer.analyze("This is GREAT!!! 😊")
    assert result.score > 0
    assert result.confidence > 0
    
    result = analyzer.analyze("This is terrible 😢")
    assert result.score < 0
    assert result.confidence > 0
