from __future__ import annotations

import hashlib
import re
from typing import Iterable

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

_TICKER_RE = re.compile(r"\$?[A-Z]{1,5}\b")


def extract_tickers(text: str, symbols: Iterable[str]) -> list[str]:
    if not text:
        return []
    symbol_set = {str(s).upper() for s in symbols}
    matches = _TICKER_RE.findall(text.upper())
    found: list[str] = []
    for token in matches:
        token = token.lstrip("$")
        if token in symbol_set and token not in found:
            found.append(token)
    return found


def hash_author(author: str | None) -> str | None:
    if not author:
        return None
    return hashlib.sha256(author.encode("utf-8")).hexdigest()[:12]


def sentiment_score_event(text: str) -> float:
    if not text:
        return 0.0
    tokens = re.findall(r"[A-Za-z']+", text.lower())
    if not tokens:
        return 0.0
    pos = sum(1 for t in tokens if t in _POS_WORDS)
    neg = sum(1 for t in tokens if t in _NEG_WORDS)
    total = max(pos + neg, 1)
    score = (pos - neg) / total
    return max(-1.0, min(1.0, score))
