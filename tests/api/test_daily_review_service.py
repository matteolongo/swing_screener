"""Tests for daily review service."""
import json
from datetime import date
from pathlib import Path
from unittest.mock import Mock, patch
import pytest

from api.models.daily_review import DailyReview
from api.models.screener import ScreenerResponse, ScreenerCandidate
from api.models.portfolio import Position, PositionUpdate
from api.services.daily_review_service import DailyReviewService


@pytest.fixture
def mock_screener_service():
    """Mock screener service."""
    service = Mock()
    service.run_screener.return_value = ScreenerResponse(
        candidates=[
            ScreenerCandidate(
                ticker="AAPL",
                signal="MOMENTUM",
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
                rank=1,
            ),
            ScreenerCandidate(
                ticker="MSFT",
                signal="BREAKOUT",
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
                rank=2,
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
    
    # Mock positions
    service.list_positions.return_value = [
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
    ]
    
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


def test_generate_daily_review_basic(mock_screener_service, mock_portfolio_service):
    """Test basic daily review generation."""
    service = DailyReviewService(mock_screener_service, mock_portfolio_service)
    
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


def test_generate_daily_review_top_n_limit(mock_screener_service, mock_portfolio_service):
    """Test that top_n correctly limits candidates."""
    service = DailyReviewService(mock_screener_service, mock_portfolio_service)
    
    review = service.generate_daily_review(top_n=1)
    
    # Should only include 1 candidate (not 2)
    assert len(review.new_candidates) == 1
    assert review.new_candidates[0].ticker == "AAPL"  # First one
    assert review.summary.new_candidates == 1


def test_generate_daily_review_candidates_fields(mock_screener_service, mock_portfolio_service):
    """Test that candidate fields are correctly mapped."""
    service = DailyReviewService(mock_screener_service, mock_portfolio_service)
    
    review = service.generate_daily_review(top_n=10)
    
    candidate = review.new_candidates[0]
    assert candidate.ticker == "AAPL"
    assert candidate.signal == "MOMENTUM"
    assert candidate.entry == 150.0
    assert candidate.stop == 145.0
    assert candidate.shares == 10
    assert candidate.r_reward == 3.0
    assert candidate.name == "Apple Inc"
    assert candidate.sector == "Technology"


def test_generate_daily_review_position_hold(mock_screener_service, mock_portfolio_service):
    """Test position categorized as 'hold' (no action)."""
    service = DailyReviewService(mock_screener_service, mock_portfolio_service)
    
    review = service.generate_daily_review(top_n=10)
    
    hold_pos = review.positions_hold[0]
    assert hold_pos.position_id == "pos1"
    assert hold_pos.ticker == "NVDA"
    assert hold_pos.entry_price == 500.0
    assert hold_pos.stop_price == 490.0
    assert hold_pos.current_price == 520.0
    assert hold_pos.r_now == 2.0
    assert "no trailing signal" in hold_pos.reason.lower()


def test_generate_daily_review_position_update(mock_screener_service, mock_portfolio_service):
    """Test position categorized as 'update stop'."""
    service = DailyReviewService(mock_screener_service, mock_portfolio_service)
    
    review = service.generate_daily_review(top_n=10)
    
    update_pos = review.positions_update_stop[0]
    assert update_pos.position_id == "pos2"
    assert update_pos.ticker == "GOOGL"
    assert update_pos.stop_current == 135.0
    assert update_pos.stop_suggested == 142.0
    assert update_pos.current_price == 155.0
    assert "breakeven" in update_pos.reason.lower()


def test_generate_daily_review_position_close(mock_screener_service, mock_portfolio_service):
    """Test position categorized as 'close'."""
    service = DailyReviewService(mock_screener_service, mock_portfolio_service)
    
    review = service.generate_daily_review(top_n=10)
    
    close_pos = review.positions_close[0]
    assert close_pos.position_id == "pos3"
    assert close_pos.ticker == "TSLA"
    assert close_pos.entry_price == 200.0
    assert close_pos.stop_price == 190.0
    assert close_pos.current_price == 188.0
    assert close_pos.r_now == -0.2
    assert "stop hit" in close_pos.reason.lower()


def test_generate_daily_review_no_positions(mock_screener_service):
    """Test daily review with no open positions."""
    empty_portfolio = Mock()
    empty_portfolio.list_positions.return_value = []
    
    service = DailyReviewService(mock_screener_service, empty_portfolio)
    review = service.generate_daily_review(top_n=10)
    
    assert len(review.positions_hold) == 0
    assert len(review.positions_update_stop) == 0
    assert len(review.positions_close) == 0
    assert review.summary.total_positions == 0
    assert review.summary.no_action == 0


def test_generate_daily_review_no_candidates(mock_portfolio_service):
    """Test daily review with no screener candidates."""
    empty_screener = Mock()
    empty_screener.run_screener.return_value = ScreenerResponse(
        candidates=[],
        asof_date=str(date.today()),
        total_screened=0,
    )
    
    service = DailyReviewService(empty_screener, mock_portfolio_service)
    review = service.generate_daily_review(top_n=10)
    
    assert len(review.new_candidates) == 0
    assert review.summary.new_candidates == 0
    # Positions should still be analyzed
    assert review.summary.total_positions == 3
