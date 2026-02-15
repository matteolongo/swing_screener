"""VADER sentiment analyzer for social media text."""
from __future__ import annotations

from swing_screener.social.sentiment.base import SentimentResult

try:
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer as _VADER
    _VADER_AVAILABLE = True
except ImportError:
    _VADER_AVAILABLE = False


class VaderSentimentAnalyzer:
    """VADER (Valence Aware Dictionary and sEntiment Reasoner) analyzer.
    
    More sophisticated than keyword matching:
    - Handles negations, intensifiers, contrasts
    - Tuned for social media text
    - Considers punctuation, capitalization, emoticons
    
    Requires: pip install vaderSentiment
    """
    
    name = "vader"
    
    def __init__(self):
        if not _VADER_AVAILABLE:
            raise ImportError(
                "vaderSentiment not installed. "
                "Install with: pip install vaderSentiment"
            )
        self._analyzer = _VADER()
    
    def analyze(self, text: str) -> SentimentResult:
        """Analyze sentiment using VADER."""
        if not text:
            return SentimentResult(0.0, 0.0)
            
        scores = self._analyzer.polarity_scores(text)
        
        # compound score is already normalized to [-1, 1]
        score = scores["compound"]
        
        # confidence based on how decisive the score is
        # VADER compound ranges from -1 to 1, with values close to 0 being neutral
        confidence = abs(score)
        
        return SentimentResult(score, confidence)
