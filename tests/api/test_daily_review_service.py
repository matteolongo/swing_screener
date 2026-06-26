"""Tests for daily review service."""
from datetime import date, timedelta
from unittest.mock import Mock
import pytest
from swing_screener.errors import UpstreamError

from api.models.daily_review import DailyReview, PendingOrderReview
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
    assert candidate.currency == "USD"
    assert candidate.confidence == 0.9
    assert candidate.signal == "MOMENTUM"
    assert candidate.close == 150.0
    assert candidate.score == 85.0
    assert candidate.atr == 2.5
    assert candidate.sma_20 == 148.0
    assert candidate.sma_50 == 145.0
    assert candidate.sma_200 == 140.0
    assert candidate.momentum_6m == 0.15
    assert candidate.momentum_12m == 0.25
    assert candidate.rel_strength == 1.2
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


def test_reentries_rank_with_new_candidates(mock_portfolio_service, tmp_path):
    """RE_ENTRY is a fresh buy decision: it belongs with new candidates (in
    screener-priority order), not in the add-on/scale-back portfolio group."""

    def _candidate(ticker: str, rank: int, mode: str) -> ScreenerCandidate:
        return ScreenerCandidate(
            ticker=ticker,
            signal="MOMENTUM",
            suggested_order_type="BUY_LIMIT",
            suggested_order_price=100.0,
            execution_note="setup",
            entry=100.0,
            stop=95.0,
            shares=5,
            rr=2.0,
            name=ticker,
            sector="Tech",
            close=100.0,
            sma_20=99.0,
            sma_50=98.0,
            sma_200=90.0,
            atr=1.0,
            momentum_6m=0.1,
            momentum_12m=0.2,
            rel_strength=1.1,
            score=90.0,
            confidence=0.9,
            rank=rank,
            same_symbol=SameSymbolCandidateContext(
                mode=mode,
                fresh_setup_stop=95.0,
                execution_stop=95.0,
                reason=mode,
            ),
        )

    screener_service = Mock()
    # Pre-sorted by priority: new, re-entry, new, add-on.
    screener_service.run_screener.return_value = ScreenerResponse(
        candidates=[
            _candidate("AALB", 1, "NEW_ENTRY"),
            _candidate("BESI", 2, "RE_ENTRY"),
            _candidate("NN", 3, "NEW_ENTRY"),
            _candidate("REP", 4, "ADD_ON"),
        ],
        asof_date=str(date.today()),
        total_screened=100,
    )

    service = DailyReviewService(screener_service, mock_portfolio_service, data_dir=tmp_path)
    review = service.generate_daily_review(top_n=10)

    # Re-entry interleaved with new entries, preserving screener priority order.
    assert [c.ticker for c in review.new_candidates] == ["AALB", "BESI", "NN"]
    # Only the genuine add-on stays in the portfolio sub-group.
    assert [c.ticker for c in review.positions_add_on_candidates] == ["REP"]


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


def test_generate_daily_review_includes_watchlist_near_trigger(
    mock_screener_service,
    mock_portfolio_service,
    tmp_path,
):
    watchlist_service = Mock()
    watchlist_service.list_items.return_value = [
        {
            "ticker": "ASML",
            "watched_at": "2026-05-01T10:00:00Z",
            "watch_price": 660.0,
            "currency": "EUR",
            "source": "screener",
            "current_price": 671.0,
            "signal_trigger_price": 680.0,
            "distance_to_trigger_pct": -1.32,
            "price_history": [],
        },
        {
            "ticker": "SAP",
            "watched_at": "2026-05-01T10:00:00Z",
            "watch_price": 250.0,
            "currency": "EUR",
            "source": "screener",
            "current_price": 260.0,
            "signal_trigger_price": 270.0,
            "distance_to_trigger_pct": -3.7,
            "price_history": [],
        },
    ]

    service = DailyReviewService(
        mock_screener_service,
        mock_portfolio_service,
        watchlist_service=watchlist_service,
        data_dir=tmp_path,
    )

    review = service.generate_daily_review(top_n=10)

    assert [item.ticker for item in review.watchlist_near_trigger] == ["ASML"]
    assert review.summary.watchlist_near_trigger == 1


def test_generate_daily_review_survives_stop_suggestion_error(
    mock_screener_service,
    mock_portfolio_service,
    tmp_path,
):
    """A DomainError from suggest_position_stop degrades gracefully (warning branch)."""
    original_side_effect = mock_portfolio_service.suggest_position_stop.side_effect

    def side_effect(position_id: str):
        if position_id == "pos2":
            raise UpstreamError("Failed to fetch market data for GOOGL")
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


# ── Pending orders review tests ──────────────────────────────────────────────

def _make_mock_orders_repo(orders: list[dict]) -> Mock:
    """Build a mock OrdersRepository returning the given orders."""
    repo = Mock()
    repo.list_orders.return_value = (orders, "2026-05-16")
    return repo


def test_pending_orders_review_empty_when_no_pending_entry_orders(
    mock_screener_service, mock_portfolio_service, tmp_path
):
    """pending_orders_review is empty when no pending entry orders exist."""
    orders_repo = _make_mock_orders_repo([])
    service = DailyReviewService(
        mock_screener_service,
        mock_portfolio_service,
        orders_repo=orders_repo,
        data_dir=tmp_path,
    )

    review = service.generate_daily_review(top_n=10)

    assert review.pending_orders_review == []


def test_pending_orders_review_still_valid_for_recent_order(
    mock_screener_service, mock_portfolio_service, tmp_path
):
    """A pending entry order created 2 days ago is categorised as still_valid."""
    two_days_ago = (date.today() - timedelta(days=2)).isoformat()
    orders_repo = _make_mock_orders_repo([
        {
            "order_id": "ORD-AAPL-001",
            "ticker": "AAPL",
            "status": "pending",
            "order_kind": "entry",
            "order_date": two_days_ago,
        }
    ])
    service = DailyReviewService(
        mock_screener_service,
        mock_portfolio_service,
        orders_repo=orders_repo,
        data_dir=tmp_path,
    )

    review = service.generate_daily_review(top_n=10)

    assert len(review.pending_orders_review) == 1
    item = review.pending_orders_review[0]
    assert isinstance(item, PendingOrderReview)
    assert item.order_id == "ORD-AAPL-001"
    assert item.ticker == "AAPL"
    assert item.category == "still_valid"
    assert item.days_pending == 2


def test_pending_orders_review_stale_for_old_order(
    mock_screener_service, mock_portfolio_service, tmp_path
):
    """A pending entry order created 7 days ago is categorised as stale."""
    seven_days_ago = (date.today() - timedelta(days=7)).isoformat()
    orders_repo = _make_mock_orders_repo([
        {
            "order_id": "ORD-MSFT-001",
            "ticker": "MSFT",
            "status": "pending",
            "order_kind": "entry",
            "order_date": seven_days_ago,
        }
    ])
    service = DailyReviewService(
        mock_screener_service,
        mock_portfolio_service,
        orders_repo=orders_repo,
        data_dir=tmp_path,
    )

    review = service.generate_daily_review(top_n=10)

    assert len(review.pending_orders_review) == 1
    item = review.pending_orders_review[0]
    assert item.category == "stale"
    assert item.days_pending == 7
