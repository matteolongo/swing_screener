from __future__ import annotations

from types import SimpleNamespace

from swing_screener.intelligence.models import SymbolIntelligenceRequest
from swing_screener.intelligence.weighting.config import EvidenceWeightsConfig
from swing_screener.intelligence.weighting.ledger import weigh


def _draft(**kw):
    base = {"news": [], "upcoming_events": [], "classified_catalysts": []}
    base.update(kw)
    return SimpleNamespace(**base)


def test_bullish_hard_signals_sum():
    req = SymbolIntelligenceRequest(
        close=100.0,
        signal="BUY",
        insider_net_shares_90d=5000,
        analyst_upgrade_downgrade_net_30d=2,
        sma_20=99.0,
        sma_50=95.0,
        sma_200=90.0,
    )

    ledger = weigh(_draft(), req, EvidenceWeightsConfig())

    keys = {c.key for c in ledger.contributions}
    assert {"insider_activity", "analyst_actions", "sma_trend"} <= keys
    assert ledger.bull_weight > 0
    assert ledger.bear_weight == 0
    assert ledger.net == ledger.bull_weight
    assert ledger.balance_label in {"bullish", "strongly_bullish"}


def test_bearish_insider_contributes_negative():
    req = SymbolIntelligenceRequest(
        close=100.0,
        signal="WATCH",
        insider_net_shares_90d=-5000,
    )

    ledger = weigh(_draft(), req, EvidenceWeightsConfig())

    insider = next(c for c in ledger.contributions if c.key == "insider_activity")
    assert insider.direction == "bearish"
    assert insider.contribution == -10.0
    assert insider.explanation is not None
    assert "adds caution" in insider.explanation


def test_neutral_contributes_zero():
    req = SymbolIntelligenceRequest(
        close=100.0,
        signal="WATCH",
        insider_net_shares_90d=0,
    )

    ledger = weigh(_draft(), req, EvidenceWeightsConfig())

    insider = next((c for c in ledger.contributions if c.key == "insider_activity"), None)
    assert insider is None or insider.contribution == 0.0
    if insider is not None:
        assert insider.explanation is not None
        assert "balanced" in insider.explanation


def test_news_and_catalysts_are_cited():
    req = SymbolIntelligenceRequest(close=100.0, signal="BUY")
    draft = _draft(
        news=[
            SimpleNamespace(
                headline="Up",
                url="http://x",
                date=None,
                sentiment="bullish",
            )
        ],
        classified_catalysts=[
            SimpleNamespace(
                type="analyst_upgrade",
                direction="bullish",
                summary="GS upgrade",
                source_url="http://gs",
                date="2026-07-01",
            )
        ],
    )

    ledger = weigh(draft, req, EvidenceWeightsConfig())

    news = next(c for c in ledger.contributions if c.key == "news")
    catalyst = next(c for c in ledger.contributions if c.key == "catalyst.analyst_upgrade")
    assert news.source == "http://x"
    assert catalyst.event_date == "2026-07-01"
    assert catalyst.source in {"http://gs", "GS upgrade"}
    assert catalyst.contribution == 9.0
    assert news.explanation is not None
    assert "cited news item" in news.explanation
    assert catalyst.explanation is not None
    assert "GS upgrade" in catalyst.explanation


def test_thresholds_bucket_net():
    req = SymbolIntelligenceRequest(
        close=100.0,
        signal="BUY",
        insider_net_shares_90d=5000,
    )

    ledger = weigh(_draft(), req, EvidenceWeightsConfig())

    assert ledger.balance_label == "bullish"
