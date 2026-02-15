"""Keyword-based sentiment analyzer (simple, fast)."""
from __future__ import annotations

import re

from swing_screener.social.sentiment.base import SentimentResult


_POS_WORDS = {
    "beat",
    "bull",
    "bullish",
    "buy",
    "growth",
    "green",
    "gain",
    "good",
    "great",
    "strong",
    "winner",
    "up",
}

_NEG_WORDS = {
    "bear",
    "bearish",
    "bad",
    "crash",
    "down",
    "drop",
    "loss",
    "red",
    "risk",
    "weak",
    "sell",
}


class KeywordSentimentAnalyzer:
    """Simple keyword-based sentiment analyzer.
    
    Fast, deterministic, no external dependencies.
    Suitable for high-volume screening where speed matters.
    """
    
    name = "keyword"
    
    def analyze(self, text: str) -> SentimentResult:
        """Analyze sentiment using keyword matching."""
        if not text:
            return SentimentResult(0.0, 0.0)
            
        tokens = re.findall(r"[A-Za-z']+", text.lower())
        if not tokens:
            return SentimentResult(0.0, 0.0)
            
        pos = sum(1 for t in tokens if t in _POS_WORDS)
        neg = sum(1 for t in tokens if t in _NEG_WORDS)
        
        if pos == 0 and neg == 0:
            return SentimentResult(0.0, 0.0)
            
        total = pos + neg
        score = (pos - neg) / total
        
        # Confidence based on signal strength
        confidence = min(total / len(tokens), 1.0)
        
        return SentimentResult(score, confidence)
