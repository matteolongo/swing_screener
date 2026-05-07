"""Tests for volume_ratio field propagation through the screener model."""
from __future__ import annotations

import pytest
from api.models.screener import ScreenerCandidate


def test_screener_candidate_accepts_volume_ratio() -> None:
    """ScreenerCandidate must accept volume_ratio and default to None."""
    c = ScreenerCandidate(
        ticker="TEST",
        close=100.0,
        sma_20=95.0,
        sma_50=90.0,
        sma_200=80.0,
        atr=2.0,
        momentum_6m=0.1,
        momentum_12m=0.15,
        rel_strength=0.05,
        score=0.8,
        confidence=0.75,
        rank=1,
    )
    assert c.volume_ratio is None


def test_screener_candidate_stores_volume_ratio() -> None:
    """volume_ratio is stored and serialised correctly."""
    c = ScreenerCandidate(
        ticker="TEST",
        close=100.0,
        sma_20=95.0,
        sma_50=90.0,
        sma_200=80.0,
        atr=2.0,
        momentum_6m=0.1,
        momentum_12m=0.15,
        rel_strength=0.05,
        score=0.8,
        confidence=0.75,
        rank=1,
        volume_ratio=1.87,
    )
    assert c.volume_ratio == pytest.approx(1.87)
    payload = c.model_dump()
    assert payload["volume_ratio"] == pytest.approx(1.87)
