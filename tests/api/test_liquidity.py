from __future__ import annotations

from api.models.screener import ScreenerCandidate


def _base_candidate(**kwargs) -> ScreenerCandidate:
    return ScreenerCandidate(
        ticker="AAPL",
        close=20.0,
        sma_20=19.0,
        sma_50=18.0,
        sma_200=17.0,
        atr=0.5,
        momentum_6m=0.1,
        momentum_12m=0.15,
        rel_strength=0.05,
        score=0.7,
        confidence=0.8,
        rank=1,
        **kwargs,
    )


def test_screener_candidate_default_avg_daily_volume_eur_is_none():
    c = _base_candidate()
    assert c.avg_daily_volume_eur is None


def test_screener_candidate_stores_avg_daily_volume_eur():
    c = _base_candidate(avg_daily_volume_eur=5_000_000.0)
    assert c.avg_daily_volume_eur == 5_000_000.0


def test_screener_candidate_serialises_avg_daily_volume_eur():
    c = _base_candidate(avg_daily_volume_eur=1_234_567.89)
    dumped = c.model_dump()
    assert dumped["avg_daily_volume_eur"] == 1_234_567.89
