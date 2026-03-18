from __future__ import annotations

from api.models.screener import ScreenerCandidate
from api.services.screener_service import _apply_cached_fundamentals_context
from swing_screener.fundamentals.models import FundamentalSnapshot
from swing_screener.fundamentals.storage import FundamentalsStorage


def _candidate() -> ScreenerCandidate:
    return ScreenerCandidate(
        ticker="AAPL",
        currency="USD",
        close=180.0,
        sma_20=175.0,
        sma_50=170.0,
        sma_200=160.0,
        atr=3.0,
        momentum_6m=0.2,
        momentum_12m=0.3,
        rel_strength=1.1,
        score=0.82,
        confidence=79.0,
        rank=1,
    )


def test_apply_cached_fundamentals_context_uses_snapshot_summary(tmp_path):
    storage = FundamentalsStorage(tmp_path / "fundamentals")
    storage.save_snapshot(
        FundamentalSnapshot(
            symbol="AAPL",
            asof_date="2026-03-19",
            provider="yfinance",
            updated_at="2026-03-19T09:00:00",
            coverage_status="supported",
            freshness_status="current",
            highlights=["Growth metrics are supportive."],
        )
    )

    enriched = _apply_cached_fundamentals_context([_candidate()], storage=storage)

    assert enriched[0].fundamentals_coverage_status == "supported"
    assert enriched[0].fundamentals_freshness_status == "current"
    assert enriched[0].fundamentals_summary == "Growth metrics are supportive."
