"""Base protocol for sentiment analyzers."""
from __future__ import annotations

from typing import Protocol


class SentimentResult:
    """Result from sentiment analysis."""
    
    def __init__(self, score: float, confidence: float):
        """
        Initialize sentiment result.
        
        Args:
            score: Sentiment score in range [-1.0, 1.0]
                  -1.0 = most negative, 0.0 = neutral, 1.0 = most positive
            confidence: Confidence in range [0.0, 1.0]
                       0.0 = no confidence, 1.0 = maximum confidence
        """
        self.score = max(-1.0, min(1.0, score))
        self.confidence = max(0.0, min(1.0, confidence))


class SentimentAnalyzer(Protocol):
    """Protocol for sentiment analysis engines."""
    
    name: str
    
    def analyze(self, text: str) -> SentimentResult:
        """
        Analyze sentiment of text.
        
        Args:
            text: Text to analyze
            
        Returns:
            SentimentResult with score and confidence
        """
        ...
