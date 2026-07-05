from __future__ import annotations

from copy import deepcopy

import pytest

from api.models.portfolio import PositionUpdate, PositionWithMetrics
from api.models.position_review import PositionReviewRequest
from api.services.position_review_service import MissingPositionReviewContextError, PositionReviewService
from swing_screener.intelligence.evidence.models import SourceEvidence
from swing_screener.intelligence.models import (
    ClassifiedCatalyst,
    IntelligenceEvent,
    NewsItem,
    SymbolIntelligence,
)


def _position(**overrides) -> PositionWithMetrics:
    data = {
        "ticker": "MNST",
        "status": "open",
        "entry_date": "2026-06-01",
        "entry_price": 100.0,
        "stop_price": 92.0,
        "shares": 10,
        "position_id": "pos-mnst",
        "initial_risk": 8.0,
        "max_favorable_price": 118.0,
        "current_price": 118.0,
        "notes": "Earnings breakout thesis",
        "thesis": "Hold while demand remains strong.",
        "tags": [],
        "partial_closes": [],
        "trail_method": "sma20",
        "trail_param": None,
        "pnl": 180.0,
        "fees_eur": 0.0,
        "pnl_percent": 18.0,
        "r_now": 2.25,
        "entry_value": 1000.0,
        "current_value": 1180.0,
        "per_share_risk": 8.0,
        "total_risk": 80.0,
        "days_open": 32,
        "time_stop_warning": False,
        "price_source": "live",
        "r_uses_initial_risk": False,
    }
    data.update(overrides)
    return PositionWithMetrics(**data)


def _stop_update(**overrides) -> PositionUpdate:
    data = {
        "ticker": "MNST",
        "status": "open",
        "last": 118.0,
        "entry": 100.0,
        "stop_old": 92.0,
        "stop_suggested": 109.5,
        "shares": 10,
        "r_now": 2.25,
        "action": "MOVE_STOP_UP",
        "reason": "SMA trail: protect profit after >2R.",
    }
    data.update(overrides)
    return PositionUpdate(**data)


def _intelligence(**overrides) -> SymbolIntelligence:
    data = {
        "symbol": "MNST",
        "generated_at": "2026-07-03T10:00:00Z",
        "action": "MANAGE_ONLY",
        "conviction": "medium",
        "catalyst_urgency": "medium",
        "summary_line": "Earnings beat supports the move, but earnings date risk remains.",
        "narrative": "Momentum remains constructive while demand holds.",
        "upcoming_events": [
            IntelligenceEvent(
                type="earnings",
                date="2026-08-06",
                direction="neutral",
                summary="Next earnings report can add volatility.",
            )
        ],
        "position_signal": None,
        "sources": ["https://example.com/mnst-earnings"],
        "news": [
            NewsItem(
                headline="Monster Beverage beats profit estimates",
                url="https://example.com/mnst-earnings",
                date="2026-07-02",
                sentiment="bullish",
            )
        ],
        "classified_catalysts": [
            ClassifiedCatalyst(
                type="earnings_beat",
                direction="bullish",
                summary="Earnings beat confirms demand.",
                source_url="https://example.com/mnst-earnings",
                date="2026-07-02",
            )
        ],
    }
    data.update(overrides)
    return SymbolIntelligence(**data)


class FakePortfolioService:
    def __init__(self, position: PositionWithMetrics | None = None) -> None:
        self.position = position
        self.writes = 0

    def list_positions(self, status=None, **_kwargs):
        self_position = self.position if status in (None, "open") else None

        class Response:
            positions = [self_position] if self_position is not None else []

        return Response()

    def suggest_position_stop(self, _position_id: str) -> PositionUpdate:
        return _stop_update()


def test_review_position_protects_profit_without_mutating_position():
    original = _position()
    portfolio = FakePortfolioService(deepcopy(original))
    service = PositionReviewService(
        portfolio_service=portfolio,
        read_intelligence_fn=lambda _ticker: _intelligence(),
        collect_evidence_fn=lambda _ticker: [
            SourceEvidence(
                title="Macro risk update",
                url="https://example.com/macro",
                publisher="Example Macro",
                published_at="2026-07-03",
                quote_or_summary="Rates volatility can reduce technical follow-through.",
                relevance="macro risk",
            )
        ],
        now_fn=lambda: "2026-07-03T12:00:00Z",
    )

    response = service.review_position("pos-mnst", PositionReviewRequest(refresh_sources=True))

    assert response.mode == "position"
    assert response.ticker == "MNST"
    assert response.suggested_action == "TRIM"
    assert response.thesis_status == "intact"
    assert response.profit_protection.current_r == pytest.approx(2.25)
    assert response.profit_protection.trim_advice == "trim_25_percent"
    assert response.stop_advice.suggested_stop == pytest.approx(109.5)
    assert response.stop_advice.method == "trail_sma20"
    assert response.macro_overlay.technical_reliability == "reduced"
    assert any(evidence.source == "Example Macro" for evidence in response.evidence_used)
    assert portfolio.position == original
    assert portfolio.writes == 0


def test_review_symbol_requires_cached_intelligence_or_evidence():
    service = PositionReviewService(
        portfolio_service=FakePortfolioService(None),
        read_intelligence_fn=lambda _ticker: None,
        collect_evidence_fn=lambda _ticker: [],
        now_fn=lambda: "2026-07-03T12:00:00Z",
    )

    with pytest.raises(MissingPositionReviewContextError):
        service.review_symbol("msft", PositionReviewRequest(refresh_sources=False))


def test_review_symbol_uses_cached_intelligence_when_not_held():
    service = PositionReviewService(
        portfolio_service=FakePortfolioService(None),
        read_intelligence_fn=lambda _ticker: _intelligence(symbol="MSFT"),
        collect_evidence_fn=lambda _ticker: [],
        now_fn=lambda: "2026-07-03T12:00:00Z",
    )

    response = service.review_symbol("msft", PositionReviewRequest(refresh_sources=False))

    assert response.mode == "symbol"
    assert response.ticker == "MSFT"
    assert response.suggested_action == "WATCH"
    assert response.profit_protection.current_r is None
    assert response.stop_advice.method == "manual_review"
