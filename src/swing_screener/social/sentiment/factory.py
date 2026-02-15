"""Factory for creating sentiment analyzers."""
from __future__ import annotations

from typing import Optional

from swing_screener.social.sentiment.base import SentimentAnalyzer
from swing_screener.social.sentiment.keyword import KeywordSentimentAnalyzer


def get_sentiment_analyzer(name: str = "keyword") -> SentimentAnalyzer:
    """
    Get sentiment analyzer by name.
    
    Args:
        name: Analyzer name ('keyword' or 'vader')
        
    Returns:
        SentimentAnalyzer instance
        
    Raises:
        ValueError: If analyzer name is not supported
        ImportError: If analyzer requires missing dependencies
    """
    name = name.lower().strip()
    
    if name == "keyword":
        return KeywordSentimentAnalyzer()
    elif name == "vader":
        from swing_screener.social.sentiment.vader import VaderSentimentAnalyzer
        return VaderSentimentAnalyzer()
    else:
        raise ValueError(
            f"Unknown sentiment analyzer: {name}. "
            f"Supported: 'keyword', 'vader'"
        )


def list_available_analyzers() -> list[str]:
    """
    List available sentiment analyzers.
    
    Returns:
        List of analyzer names that can be instantiated
    """
    available = ["keyword"]
    
    try:
        from swing_screener.social.sentiment.vader import VaderSentimentAnalyzer
        # Try to instantiate to check dependencies
        VaderSentimentAnalyzer()
        available.append("vader")
    except ImportError:
        pass
    
    return available
