"""Tests for daily review service."""
from datetime import date
from unittest.mock import Mock
import pytest
from fastapi import HTTPException

from api.models.daily_review import DailyReview
from api.models.screener import ScreenerResponse, ScreenerCandidate, SameSymbolCandidateContext
from api.models.portfolio import Position, PositionUpdate, PositionsResponse
from api.services.daily_review_service import DailyReviewService
from swing_screener.recommendation.models import DecisionSummary
from swing_screener.strategy.storage import _default_strategy_payload


@pytest.fixture
def mock_screener_service():
    """Mock screener service."""
    service = Mock()
    service.run_screener.return_value = ScreenerResponse(
        candidates=[
            ScreenerCandidate(
                ticker="AAPL",
                signal="MOMENTUM",
                suggested_order_type="BUY_LIMIT",
                suggested_order_price=149.5,
                execution_note="Pullback setup. Place BUY LIMIT near moving-average reclaim level.",
                entry=150.0,
                stop=145.0,
                shares=10,
                rr=3.0,
                name="Apple Inc",
                sector="Technology",
                close=150.0,
                sma_20=148.0,
                sma_50=145.0,
                sma_200=140.0,
                atr=2.5,
                momentum_6m=0.15,
                momentum_12m=0.25,
                rel_strength=1.2,
                score=85.0,
                confidence=0.9,
                rank=2,
                priority_rank=1,
                decision_summary=DecisionSummary(
                    symbol="AAPL",
                    action="BUY_NOW",
                    conviction="high",
                    technical_label="strong",
                    fundamentals_label="strong",
                    valuation_label="fair",
                    catalyst_label="active",
                    why_now="Ready now.",
                    what_to_do="Act first.",
                    main_risk="Execution discipline.",
                ),
            ),
            ScreenerCandidate(
                ticker="MSFT",
                signal="BREAKOUT",
                suggested_order_type="BUY_STOP",
                suggested_order_price=301.5,
                execution_note="Breakout not triggered yet. Place BUY STOP slightly above breakout_level.",
                entry=300.0,
                stop=290.0,
                shares=5,
                rr=4.0,
                name="Microsoft",
                sector="Technology",
                close=300.0,
                sma_20=295.0,
                sma_50=290.0,
                sma_200=280.0,
                atr=5.0,
                momentum_6m=0.12,
                momentum_12m=0.20,
                rel_strength=1.1,
                score=82.0,
                confidence=0.85,
                rank=1,
                priority_rank=2,
                decision_summary=DecisionSummary(
                    symbol="MSFT",
                    action="BUY_ON_PULLBACK",
                    conviction="medium",
                    technical_label="strong",
                    fundamentals_label="strong",
                    valuation_label="expensive",
                    catalyst_label="active",
                    why_now="Good but extended.",
                    what_to_do="Wait for pullback.",
                    main_risk="Chasing strength.",
                ),
            ),
        ],
        asof_date=str(date.today()),
        total_screened=100,
    )
    return service


@pytest.fixture
def mock_portfolio_service():
    """Mock portfolio service."""
    service = Mock()
    
    # Mock positions (return PositionsResponse, not list)
    service.list_positions.return_value = PositionsResponse(
        positions=[
            Position(
                position_id="pos1",
                ticker="NVDA",
                entry_price=500.0,
                stop_price=490.0,
                shares=10,
                status="open",
                entry_date="2026-02-01",
            ),
            Position(
                position_id="pos2",
                ticker="GOOGL",
                entry_price=140.0,
                stop_price=135.0,
                shares=15,
                status="open",
                entry_date="2026-02-05",
            ),
            Position(
                position_id="pos3",
                ticker="TSLA",
                entry_price=200.0,
                stop_price=190.0,
                shares=8,
                status="open",
                entry_date="2026-01-20",
            ),
        ],
        asof="2026-02-11",
    )
    
    # Mock stop suggestions (different actions for each position)
    def mock_suggest_stop(position_id: str) -> PositionUpdate:
        if position_id == "pos1":
            # Position to hold (no action)
            return PositionUpdate(
                ticker="NVDA",
                status="open",
                last=520.0,
                entry=500.0,
                stop_old=490.0,
                stop_suggested=490.0,
                shares=10,
                r_now=2.0,
                action="NO_ACTION",
                reason="Price above stop, no trailing signal",
            )
        elif position_id == "pos2":
            # Position to update stop (move up)
            return PositionUpdate(
                ticker="GOOGL",
                status="open",
                last=155.0,
                entry=140.0,
                stop_old=135.0,
                stop_suggested=142.0,
                shares=15,
                r_now=1.33,
                action="MOVE_STOP_UP",
                reason="Price advanced 1R+, trail to breakeven",
            )
        else:  # pos3
            # Position to close (stop hit)
            return PositionUpdate(
                ticker="TSLA",
                status="open",
                last=188.0,
                entry=200.0,
                stop_old=190.0,
                stop_suggested=190.0,
                shares=8,
                r_now=-0.2,
                action="CLOSE_STOP_HIT",
                reason="Stop hit at $190.00",
            )
    
    service.suggest_position_stop.side_effect = mock_suggest_stop
    
    return service


def test_generate_daily_review_basic(mock_screener_service, mock_portfolio_service, tmp_path):
    """Test basic daily review generation."""
    service = DailyReviewService(mock_screener_service, mock_portfolio_service, data_dir=tmp_path)
    
    review = service.generate_daily_review(top_n=10)
    
    # Verify structure
    assert isinstance(review, DailyReview)
    assert len(review.new_candidates) == 2
    assert len(review.positions_hold) == 1
    assert len(review.positions_update_stop) == 1
    assert len(review.positions_close) == 1
    
    # Verify summary
    assert review.summary.total_positions == 3
    assert review.summary.no_action == 1
    assert review.summary.update_stop == 1
    assert review.summary.close_positions == 1
    assert review.summary.new_candidates == 2
    assert review.summary.review_date == date.today()


def test_generate_daily_review_top_n_limit(mock_screener_service, mock_portfolio_service, tmp_path):
    """Test that top_n correctly limits candidates."""
    service = DailyReviewService(mock_screener_service, mock_portfolio_service, data_dir=tmp_path)
    
    review = service.generate_daily_review(top_n=1)
    
    # Should only include 1 candidate (not 2)
    assert len(review.new_candidates) == 1
    assert review.new_candidates[0].ticker == "AAPL"  # First one
    assert review.summary.new_candidates == 1


def test_generate_daily_review_passes_universe_to_screener(mock_screener_service, mock_portfolio_service, tmp_path):
    """Daily review should reuse the requested screener universe when provided."""
    service = DailyReviewService(mock_screener_service, mock_portfolio_service, data_dir=tmp_path)

    service.generate_daily_review(top_n=10, universe="amsterdam_all")

    assert mock_screener_service.run_screener.call_count >= 1
    request = mock_screener_service.run_screener.call_args[0][0]
    assert request.universe == "amsterdam_all"


def test_generate_daily_review_candidates_fields(mock_screener_service, mock_portfolio_service, tmp_path):
    """Test that candidate fields are correctly mapped."""
    service = DailyReviewService(mock_screener_service, mock_portfolio_service, data_dir=tmp_path)
    
    review = service.generate_daily_review(top_n=10)
    
    candidate = review.new_candidates[0]
    assert candidate.ticker == "AAPL"
    assert candidate.confidence == 0.9
    assert candidate.signal == "MOMENTUM"
    assert candidate.close == 150.0
    assert candidate.entry == 150.0
    assert candidate.stop == 145.0
    assert candidate.shares == 10
    assert candidate.r_reward == 3.0
    assert candidate.name == "Apple Inc"
    assert candidate.sector == "Technology"
    assert candidate.suggested_order_type == "BUY_LIMIT"
    assert candidate.suggested_order_price == 149.5
    assert "BUY LIMIT" in candidate.execution_note
    assert candidate.rank == 2
    assert candidate.priority_rank == 1
    assert candidate.decision_summary is not None
    assert candidate.decision_summary.action == "BUY_NOW"


def test_generate_daily_review_position_hold(mock_screener_service, mock_portfolio_service, tmp_path):
    """Test position categorized as 'hold' (no action)."""
    service = DailyReviewService(mock_screener_service, mock_portfolio_service, data_dir=tmp_path)
    
    review = service.generate_daily_review(top_n=10)
    
    hold_pos = review.positions_hold[0]
    assert hold_pos.position_id == "pos1"
    assert hold_pos.ticker == "NVDA"
    assert hold_pos.entry_price == 500.0
    assert hold_pos.stop_price == 490.0
    assert hold_pos.current_price == 520.0
    assert hold_pos.r_now == 2.0
    assert "no trailing signal" in hold_pos.reason.lower()


def test_generate_daily_review_position_update(mock_screener_service, mock_portfolio_service, tmp_path):
    """Test position categorized as 'update stop'."""
    service = DailyReviewService(mock_screener_service, mock_portfolio_service, data_dir=tmp_path)
    
    review = service.generate_daily_review(top_n=10)
    
    update_pos = review.positions_update_stop[0]
    assert update_pos.position_id == "pos2"
    assert update_pos.ticker == "GOOGL"
    assert update_pos.stop_current == 135.0
    assert update_pos.stop_suggested == 142.0
    assert update_pos.current_price == 155.0
    assert "breakeven" in update_pos.reason.lower()


def test_generate_daily_review_separates_add_on_candidates(mock_portfolio_service, tmp_path):
    screener_service = Mock()
    screener_service.run_screener.return_value = ScreenerResponse(
        candidates=[
            ScreenerCandidate(
                ticker="REP.MC",
                signal="BREAKOUT",
                suggested_order_type="BUY_LIMIT",
                suggested_order_price=22.83,
                execution_note="Add-on using live stop.",
                entry=22.83,
                stop=21.62,
                shares=5,
                rr=2.0,
                name="Repsol",
                sector="Energy",
                close=23.0,
                sma_20=22.0,
                sma_50=21.0,
                sma_200=18.0,
                atr=0.8,
                momentum_6m=0.15,
                momentum_12m=0.25,
                rel_strength=1.2,
                score=99.4,
                confidence=92.7,
                rank=1,
                same_symbol=SameSymbolCandidateContext(
                    mode="ADD_ON",
                    position_id="pos-rep",
                    current_position_entry=19.63,
                    current_position_stop=19.63,
                    fresh_setup_stop=21.62,
                    execution_stop=19.63,
                    reason="One portfolio-aware add-on is allowed using the current live stop.",
                ),
            ),
            ScreenerCandidate(
                ticker="AAPL",
                signal="MOMENTUM",
                suggested_order_type="BUY_LIMIT",
                suggested_order_price=149.5,
                execution_note="Pullback setup.",
                entry=150.0,
                stop=145.0,
                shares=10,
                rr=3.0,
                name="Apple Inc",
                sector="Technology",
                close=150.0,
                sma_20=148.0,
                sma_50=145.0,
                sma_200=140.0,
                atr=2.5,
                momentum_6m=0.15,
                momentum_12m=0.25,
                rel_strength=1.2,
                score=85.0,
                confidence=0.9,
                rank=2,
                same_symbol=SameSymbolCandidateContext(
                    mode="NEW_ENTRY",
                    fresh_setup_stop=145.0,
                    execution_stop=145.0,
                    reason="No open position exists for this ticker.",
                ),
            ),
        ],
        asof_date=str(date.today()),
        total_screened=100,
    )

    service = DailyReviewService(screener_service, mock_portfolio_service, data_dir=tmp_path)

    review = service.generate_daily_review(top_n=10)

    assert [candidate.ticker for candidate in review.new_candidates] == ["AAPL"]
    assert [candidate.ticker for candidate in review.positions_add_on_candidates] == ["REP.MC"]
    assert review.summary.new_candidates == 1
    assert review.summary.add_on_candidates == 1


def test_generate_daily_review_position_close(mock_screener_service, mock_portfolio_service, tmp_path):
    """Test position categorized as 'close'."""
    service = DailyReviewService(mock_screener_service, mock_portfolio_service, data_dir=tmp_path)
    
    review = service.generate_daily_review(top_n=10)
    
    close_pos = review.positions_close[0]
    assert close_pos.position_id == "pos3"
    assert close_pos.ticker == "TSLA"
    assert close_pos.entry_price == 200.0
    assert close_pos.stop_price == 190.0
    assert close_pos.current_price == 188.0
    assert close_pos.r_now == -0.2
    assert "stop hit" in close_pos.reason.lower()


def test_generate_daily_review_no_positions(mock_screener_service, tmp_path):
    """Test daily review with no open positions."""
    empty_portfolio = Mock()
    empty_portfolio.list_positions.return_value = PositionsResponse(positions=[], asof="2026-02-11")
    
    service = DailyReviewService(mock_screener_service, empty_portfolio, data_dir=tmp_path)
    review = service.generate_daily_review(top_n=10)
    
    assert len(review.positions_hold) == 0
    assert len(review.positions_update_stop) == 0
    assert len(review.positions_close) == 0
    assert review.summary.total_positions == 0
    assert review.summary.no_action == 0


def test_generate_daily_review_no_candidates(mock_portfolio_service, tmp_path):
    """Test daily review with no screener candidates."""
    empty_screener = Mock()
    empty_screener.run_screener.return_value = ScreenerResponse(
        candidates=[],
        asof_date=str(date.today()),
        total_screened=0,
    )
    
    service = DailyReviewService(empty_screener, mock_portfolio_service, data_dir=tmp_path)
    review = service.generate_daily_review(top_n=10)
    
    assert len(review.new_candidates) == 0
    assert review.summary.new_candidates == 0
    # Positions should still be analyzed
    assert review.summary.total_positions == 3


def test_generate_daily_review_survives_stop_suggestion_error(
    mock_screener_service,
    mock_portfolio_service,
    tmp_path,
):
    """A single stop-suggestion failure should not fail the whole review."""
    original_side_effect = mock_portfolio_service.suggest_position_stop.side_effect

    def side_effect(position_id: str):
        if position_id == "pos2":
            raise HTTPException(status_code=502, detail="Failed to fetch market data for GOOGL")
        return original_side_effect(position_id)

    mock_portfolio_service.suggest_position_stop.side_effect = side_effect

    service = DailyReviewService(mock_screener_service, mock_portfolio_service, data_dir=tmp_path)
    review = service.generate_daily_review(top_n=10)

    assert isinstance(review, DailyReview)
    assert review.summary.total_positions == 3
    assert len(review.positions_close) == 1


def test_compute_daily_review_from_state_uses_client_payload(
    mock_screener_service,
    mock_portfolio_service,
    tmp_path,
):
    service = DailyReviewService(mock_screener_service, mock_portfolio_service, data_dir=tmp_path)
    strategy = _default_strategy_payload()  # noqa: SLF001
    position_payload = {
        "position_id": "local-pos-1",
        "ticker": "AAPL",
        "entry_price": 100.0,
        "stop_price": 95.0,
        "shares": 10,
        "status": "open",
        "entry_date": "2026-02-01",
        "current_price": 104.0,
    }

    mock_portfolio_service.compute_position_stop_suggestion.return_value = PositionUpdate(
        ticker="AAPL",
        status="open",
        last=104.0,
        entry=100.0,
        stop_old=95.0,
        stop_suggested=100.0,
        shares=10,
        r_now=0.8,
        action="MOVE_STOP_UP",
        reason="Breakeven: R=1.00 >= 1.0",
    )

    review = service.compute_daily_review_from_state(
        strategy=strategy,
        positions=[position_payload],
        orders=[],
        top_n=5,
        universe="usd_all",
    )

    assert isinstance(review, DailyReview)
    assert review.summary.total_positions == 1
    assert len(review.positions_update_stop) == 1
    assert review.positions_update_stop[0].ticker == "AAPL"

    assert mock_screener_service.run_screener.call_count >= 1
    args, kwargs = mock_screener_service.run_screener.call_args
    assert args[0].top == 5
    assert args[0].universe == "usd_all"
    assert kwargs["strategy_override"] == strategy
