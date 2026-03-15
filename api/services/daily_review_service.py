"""Service for generating daily review with action items."""
import json
import logging
from datetime import date
from pathlib import Path

from fastapi import HTTPException

from api.models.daily_review import (
    DailyReview,
    DailyReviewCandidate,
    DailyReviewPositionHold,
    DailyReviewPositionUpdate,
    DailyReviewPositionClose,
    DailyReviewSummary,
)
from api.models.screener import ScreenerRequest
from api.services.screener_service import ScreenerService
from api.services.portfolio_service import PortfolioService
from swing_screener.portfolio.state import ManageConfig as ManageStateConfig

logger = logging.getLogger(__name__)


class DailyReviewService:
    """Service for generating daily review with trade candidates and position actions."""

    def __init__(
        self,
        screener_service: ScreenerService,
        portfolio_service: PortfolioService,
        data_dir: Path = Path("data"),
    ):
        self.screener = screener_service
        self.portfolio = portfolio_service
        self.data_dir = data_dir
        self.daily_reviews_dir = data_dir / "daily_reviews"
        self.daily_reviews_dir.mkdir(parents=True, exist_ok=True)

    def generate_daily_review(
        self,
        top_n: int = 200,
        universe: str | None = None,
    ) -> DailyReview:
        """
        Generate comprehensive daily review.
        
        Args:
            top_n: Number of top screener candidates to include (default: 200)
            universe: Optional named universe to screen (e.g., "amsterdam_all")
        
        Returns:
            DailyReview with new candidates and position actions categorized
        """
        # 1. Run screener to get new candidates
        selected_universe = universe.strip() if isinstance(universe, str) else None
        screener_request = ScreenerRequest(
            top=top_n,
            universe=selected_universe or None,
        )
        screener_result = self.screener.run_screener(screener_request)
        candidates = screener_result.candidates[:top_n]

        def _to_daily_candidate(c) -> DailyReviewCandidate:
            return DailyReviewCandidate(
                ticker=c.ticker,
                confidence=c.confidence,
                signal=c.signal or "UNKNOWN",
                close=c.close,
                entry=c.entry or 0.0,
                stop=c.stop or 0.0,
                shares=c.shares or 0,
                r_reward=c.rr or 0.0,
                name=c.name,
                sector=c.sector,
                suggested_order_type=c.suggested_order_type,
                suggested_order_price=c.suggested_order_price,
                execution_note=c.execution_note,
                recommendation=c.recommendation,
                same_symbol=c.same_symbol,
            )
        new_candidates = [_to_daily_candidate(c) for c in candidates if c.same_symbol is None or c.same_symbol.mode == "NEW_ENTRY"]
        add_on_candidates = [_to_daily_candidate(c) for c in candidates if c.same_symbol is not None and c.same_symbol.mode == "ADD_ON"]
        
        # 2. Analyze all open positions
        positions_response = self.portfolio.list_positions(status="open")
        positions = positions_response.positions
        
        positions_hold: list[DailyReviewPositionHold] = []
        positions_update: list[DailyReviewPositionUpdate] = []
        positions_close: list[DailyReviewPositionClose] = []
        
        for pos in positions:
            # Get stop suggestion for this position
            try:
                suggestion = self.portfolio.suggest_position_stop(pos.position_id)
            except HTTPException as exc:
                reason = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
                logger.warning(
                    "Daily review stop suggestion unavailable for %s: %s",
                    pos.ticker,
                    reason,
                )
                positions_hold.append(
                    DailyReviewPositionHold(
                        position_id=pos.position_id,
                        ticker=pos.ticker,
                        entry_price=pos.entry_price,
                        stop_price=pos.stop_price,
                        current_price=pos.current_price or pos.entry_price,
                        r_now=0.0,
                        reason=f"Stop suggestion unavailable: {reason}",
                    )
                )
                continue
            except Exception as exc:
                logger.exception(
                    "Unexpected error generating stop suggestion for %s",
                    pos.ticker,
                )
                positions_hold.append(
                    DailyReviewPositionHold(
                        position_id=pos.position_id,
                        ticker=pos.ticker,
                        entry_price=pos.entry_price,
                        stop_price=pos.stop_price,
                        current_price=pos.current_price or pos.entry_price,
                        r_now=0.0,
                        reason=f"Stop suggestion unavailable: {exc}",
                    )
                )
                continue
            
            # Categorize based on action
            if suggestion.action == "NO_ACTION":
                positions_hold.append(
                    DailyReviewPositionHold(
                        position_id=pos.position_id,
                        ticker=pos.ticker,
                        entry_price=pos.entry_price,
                        stop_price=pos.stop_price,
                        current_price=suggestion.last,
                        r_now=suggestion.r_now,
                        reason=suggestion.reason,
                    )
                )
            
            elif suggestion.action == "MOVE_STOP_UP":
                positions_update.append(
                    DailyReviewPositionUpdate(
                        position_id=pos.position_id,
                        ticker=pos.ticker,
                        entry_price=pos.entry_price,
                        stop_current=pos.stop_price,
                        stop_suggested=suggestion.stop_suggested,
                        current_price=suggestion.last,
                        r_now=suggestion.r_now,
                        reason=suggestion.reason,
                    )
                )
            
            elif suggestion.action in ["CLOSE_STOP_HIT", "CLOSE_TIME_EXIT"]:
                positions_close.append(
                    DailyReviewPositionClose(
                        position_id=pos.position_id,
                        ticker=pos.ticker,
                        entry_price=pos.entry_price,
                        stop_price=pos.stop_price,
                        current_price=suggestion.last,
                        r_now=suggestion.r_now,
                        reason=suggestion.reason,
                    )
                )
        
        # 3. Build summary
        summary = DailyReviewSummary(
            total_positions=len(positions),
            no_action=len(positions_hold),
            update_stop=len(positions_update),
            close_positions=len(positions_close),
            new_candidates=len(new_candidates),
            add_on_candidates=len(add_on_candidates),
            review_date=date.today(),
        )
        
        review = DailyReview(
            new_candidates=new_candidates,
            positions_add_on_candidates=add_on_candidates,
            positions_hold=positions_hold,
            positions_update_stop=positions_update,
            positions_close=positions_close,
            summary=summary,
        )
        
        # Save to historical file (use "default" as strategy name for now)
        self._save_review(review, "default")
        
        return review

    @staticmethod
    def _manage_cfg_payload_from_strategy(strategy: dict) -> dict:
        manage = strategy.get("manage", {}) if isinstance(strategy, dict) else {}
        cfg = ManageStateConfig(
            breakeven_at_R=float(manage.get("breakeven_at_r", 1.0)),
            trail_sma=int(manage.get("trail_sma", 20)),
            trail_after_R=float(manage.get("trail_after_r", 2.0)),
            sma_buffer_pct=float(manage.get("sma_buffer_pct", 0.005)),
            max_holding_days=int(manage.get("max_holding_days", 20)),
        )
        return {
            "breakeven_at_r": cfg.breakeven_at_R,
            "trail_after_r": cfg.trail_after_R,
            "trail_sma": cfg.trail_sma,
            "sma_buffer_pct": cfg.sma_buffer_pct,
            "max_holding_days": cfg.max_holding_days,
        }

    def compute_daily_review_from_state(
        self,
        strategy: dict,
        positions: list[dict],
        orders: list[dict],
        top_n: int = 200,
        universe: str | None = None,
    ) -> DailyReview:
        """Compute daily review from client-provided strategy/portfolio state."""
        _ = orders  # Reserved for future order-aware categorization logic.

        selected_universe = universe.strip() if isinstance(universe, str) else None
        signals = strategy.get("signals", {}) if isinstance(strategy, dict) else {}
        universe_cfg = strategy.get("universe", {}) if isinstance(strategy, dict) else {}
        filt_cfg = universe_cfg.get("filt", {}) if isinstance(universe_cfg, dict) else {}

        screener_request = ScreenerRequest(
            top=top_n,
            universe=selected_universe or None,
            breakout_lookback=signals.get("breakout_lookback"),
            pullback_ma=signals.get("pullback_ma"),
            min_history=signals.get("min_history"),
            currencies=filt_cfg.get("currencies"),
        )
        screener_result = self.screener.run_screener(screener_request, strategy_override=strategy)
        candidates = screener_result.candidates[:top_n]

        def _to_daily_candidate(c) -> DailyReviewCandidate:
            return DailyReviewCandidate(
                ticker=c.ticker,
                confidence=c.confidence,
                signal=c.signal or "UNKNOWN",
                close=c.close,
                entry=c.entry or 0.0,
                stop=c.stop or 0.0,
                shares=c.shares or 0,
                r_reward=c.rr or 0.0,
                name=c.name,
                sector=c.sector,
                suggested_order_type=c.suggested_order_type,
                suggested_order_price=c.suggested_order_price,
                execution_note=c.execution_note,
                recommendation=c.recommendation,
                same_symbol=c.same_symbol,
            )
        new_candidates = [_to_daily_candidate(c) for c in candidates if c.same_symbol is None or c.same_symbol.mode == "NEW_ENTRY"]
        add_on_candidates = [_to_daily_candidate(c) for c in candidates if c.same_symbol is not None and c.same_symbol.mode == "ADD_ON"]

        positions_hold: list[DailyReviewPositionHold] = []
        positions_update: list[DailyReviewPositionUpdate] = []
        positions_close: list[DailyReviewPositionClose] = []
        manage_payload = self._manage_cfg_payload_from_strategy(strategy)

        for pos in positions:
            if pos.get("status") != "open":
                continue

            position_id = str(pos.get("position_id") or f"LOCAL-{pos.get('ticker', 'UNKNOWN')}")
            try:
                suggestion = self.portfolio.compute_position_stop_suggestion(pos, manage_payload)
            except HTTPException as exc:
                reason = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
                logger.warning(
                    "Stateless daily review stop suggestion unavailable for %s: %s",
                    pos.get("ticker"),
                    reason,
                )
                positions_hold.append(
                    DailyReviewPositionHold(
                        position_id=position_id,
                        ticker=str(pos.get("ticker", "")),
                        entry_price=float(pos.get("entry_price", 0.0)),
                        stop_price=float(pos.get("stop_price", 0.0)),
                        current_price=float(pos.get("current_price") or pos.get("entry_price") or 0.0),
                        r_now=0.0,
                        reason=f"Stop suggestion unavailable: {reason}",
                    )
                )
                continue
            except Exception as exc:
                logger.exception(
                    "Unexpected stateless stop suggestion error for %s",
                    pos.get("ticker"),
                )
                positions_hold.append(
                    DailyReviewPositionHold(
                        position_id=position_id,
                        ticker=str(pos.get("ticker", "")),
                        entry_price=float(pos.get("entry_price", 0.0)),
                        stop_price=float(pos.get("stop_price", 0.0)),
                        current_price=float(pos.get("current_price") or pos.get("entry_price") or 0.0),
                        r_now=0.0,
                        reason=f"Stop suggestion unavailable: {exc}",
                    )
                )
                continue

            if suggestion.action == "NO_ACTION":
                positions_hold.append(
                    DailyReviewPositionHold(
                        position_id=position_id,
                        ticker=suggestion.ticker,
                        entry_price=suggestion.entry,
                        stop_price=suggestion.stop_old,
                        current_price=suggestion.last,
                        r_now=suggestion.r_now,
                        reason=suggestion.reason,
                    )
                )
            elif suggestion.action == "MOVE_STOP_UP":
                positions_update.append(
                    DailyReviewPositionUpdate(
                        position_id=position_id,
                        ticker=suggestion.ticker,
                        entry_price=suggestion.entry,
                        stop_current=suggestion.stop_old,
                        stop_suggested=suggestion.stop_suggested,
                        current_price=suggestion.last,
                        r_now=suggestion.r_now,
                        reason=suggestion.reason,
                    )
                )
            elif suggestion.action in ["CLOSE_STOP_HIT", "CLOSE_TIME_EXIT"]:
                positions_close.append(
                    DailyReviewPositionClose(
                        position_id=position_id,
                        ticker=suggestion.ticker,
                        entry_price=suggestion.entry,
                        stop_price=suggestion.stop_old,
                        current_price=suggestion.last,
                        r_now=suggestion.r_now,
                        reason=suggestion.reason,
                    )
                )

        return DailyReview(
            new_candidates=new_candidates,
            positions_add_on_candidates=add_on_candidates,
            positions_hold=positions_hold,
            positions_update_stop=positions_update,
            positions_close=positions_close,
            summary=DailyReviewSummary(
                total_positions=len([position for position in positions if position.get("status") == "open"]),
                no_action=len(positions_hold),
                update_stop=len(positions_update),
                close_positions=len(positions_close),
                new_candidates=len(new_candidates),
                add_on_candidates=len(add_on_candidates),
                review_date=date.today(),
            ),
        )
    
    def _save_review(self, review: DailyReview, strategy_name: str) -> None:
        """
        Save daily review to historical file.
        
        Args:
            review: DailyReview to save
            strategy_name: Name of the strategy used
        """
        review_date = review.summary.review_date
        filename = f"daily_review_{review_date.isoformat()}_{strategy_name}.json"
        filepath = self.daily_reviews_dir / filename
        
        # Convert to dict for JSON serialization
        review_dict = review.model_dump(mode="json")
        
        with open(filepath, 'w') as f:
            json.dump(review_dict, f, indent=2)
        
        logger.info(f"Daily review saved to {filepath}")
