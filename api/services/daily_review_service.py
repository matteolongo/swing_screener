"""Service for generating daily review with action items."""
import logging
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Callable, Literal, Optional

from swing_screener.errors import DomainError

from api.models.daily_review import (
    DailyReview,
    DailyReviewCandidate,
    DailyReviewPositionHold,
    DailyReviewPositionUpdate,
    DailyReviewPositionClose,
    DailyReviewPositionExitSignal,
    DailyReviewSummary,
    PendingOrderReview,
    TrimSuggestion,
)
from api.models.portfolio import PositionUpdate
from api.models.screener import ScreenerRequest
from api.repositories.orders_repo import OrdersRepository
from api.services.screener_service import ScreenerService
from api.services.portfolio_service import PortfolioService
from api.services.watchlist_service import WatchlistService
from api.services.daily_review import DailyReviewWriter
from swing_screener.portfolio.state import ManageConfig as ManageStateConfig

logger = logging.getLogger(__name__)


def to_daily_review_candidate(c) -> DailyReviewCandidate:
    """Map a screener candidate to a DailyReviewCandidate."""
    return DailyReviewCandidate(
        ticker=c.ticker,
        currency=c.currency,
        rank=c.rank,
        priority_rank=c.priority_rank,
        confidence=c.confidence,
        signal=c.signal or "UNKNOWN",
        close=c.close,
        score=c.score,
        atr=c.atr,
        sma_20=c.sma_20,
        sma_50=c.sma_50,
        sma_200=c.sma_200,
        momentum_6m=c.momentum_6m,
        momentum_12m=c.momentum_12m,
        rel_strength=c.rel_strength,
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
        decision_summary=c.decision_summary,
    )


@dataclass
class _ActionBuckets:
    """Collects categorized position actions while iterating positions."""
    hold: list[DailyReviewPositionHold] = field(default_factory=list)
    update: list[DailyReviewPositionUpdate] = field(default_factory=list)
    close: list[DailyReviewPositionClose] = field(default_factory=list)
    exit_signal: list[DailyReviewPositionExitSignal] = field(default_factory=list)


@dataclass
class _PositionActionContext:
    """Per-position values that differ between the live and stateless review paths.

    The two paths read success-branch fields from different sources (the position
    model vs the stop suggestion) and resolve error-branch fields, the time-stop
    payload and position_id differently. Capturing those as resolved scalars plus
    two small callables lets one classifier handle both.
    """
    position_id: str
    err_ticker: str
    err_entry_price: float
    err_stop_price: float
    err_current_price: float
    trim_r_threshold: float
    #: suggestion -> (ticker, entry_price, stop_price) for the success branches.
    success_fields: Callable[[PositionUpdate], tuple[str, float, float]]
    #: r_now -> {"days_open": ..., "time_stop_warning": ...}
    time_stop: Callable[[float], dict]


class DailyReviewService:
    """Service for generating daily review with trade candidates and position actions."""

    #: Orders older than this many days are flagged as stale.
    STALE_DAYS_THRESHOLD: int = 5

    def __init__(
        self,
        screener_service: ScreenerService,
        portfolio_service: PortfolioService,
        watchlist_service: WatchlistService | None = None,
        orders_repo: Optional[OrdersRepository] = None,
        data_dir: Path = Path("data"),
    ):
        self.screener = screener_service
        self.portfolio = portfolio_service
        self.watchlist = watchlist_service
        self.orders_repo = orders_repo
        self.data_dir = data_dir
        self.daily_reviews_dir = data_dir / "daily_reviews"
        self.daily_reviews_dir.mkdir(parents=True, exist_ok=True)
        self._writer = DailyReviewWriter(self.daily_reviews_dir)

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

        # Re-entries are fresh buy decisions (no open position), so rank them
        # among new opportunities by screener priority. Add-ons / scale-backs
        # depend on an existing position and stay in the portfolio sub-group.
        new_candidates = [to_daily_review_candidate(c) for c in candidates if c.same_symbol is None or c.same_symbol.mode in ("NEW_ENTRY", "RE_ENTRY")]
        add_on_candidates = [to_daily_review_candidate(c) for c in candidates if c.same_symbol is not None and c.same_symbol.mode in ("ADD_ON", "SCALE_BACK")]
        screener_tickers = {c.ticker.upper() for c in candidates}
        watchlist_near_trigger = [
            item for item in self._watchlist_near_trigger_items()
            if (item.ticker if hasattr(item, "ticker") else item.get("ticker", "")).upper()
            not in screener_tickers
        ]
        
        # 2. Analyze all open positions
        active_manage = self._active_manage_cfg_payload()
        trim_r_threshold = float(active_manage.get("trim_r_threshold", 2.0))
        positions_response = self.portfolio.list_positions(
            status="open",
            time_stop_days=int(active_manage.get("time_stop_days", 15)),
            time_stop_min_r=float(active_manage.get("time_stop_min_r", 0.5)),
        )
        positions = positions_response.positions

        buckets = _ActionBuckets()
        for pos in positions:
            ctx = _PositionActionContext(
                position_id=pos.position_id,
                err_ticker=pos.ticker,
                err_entry_price=pos.entry_price,
                err_stop_price=pos.stop_price,
                err_current_price=pos.current_price or pos.entry_price,
                trim_r_threshold=trim_r_threshold,
                success_fields=lambda _s, p=pos: (p.ticker, p.entry_price, p.stop_price),
                time_stop=lambda r, p=pos: self._time_stop_payload_from_position(p, r, active_manage),
            )
            try:
                suggestion = self.portfolio.suggest_position_stop(pos.position_id)
            except DomainError as exc:
                logger.warning(
                    "Daily review stop suggestion unavailable for %s: %s",
                    pos.ticker,
                    exc.detail,
                )
                buckets.hold.append(self._error_hold(ctx, f"Stop suggestion unavailable: {exc.detail}"))
                continue
            except Exception as exc:
                logger.exception(
                    "Unexpected error generating stop suggestion for %s",
                    pos.ticker,
                )
                buckets.hold.append(self._error_hold(ctx, f"Stop suggestion unavailable: {exc}"))
                continue

            self._classify_position_action(suggestion, ctx, buckets)

        positions_hold = buckets.hold
        positions_update = buckets.update
        positions_close = buckets.close
        positions_exit_signal = buckets.exit_signal

        # 3. Build summary
        summary = DailyReviewSummary(
            total_positions=len(positions),
            no_action=len(positions_hold),
            update_stop=len(positions_update),
            close_positions=len(positions_close),
            exit_signal=len(positions_exit_signal),
            new_candidates=len(new_candidates),
            add_on_candidates=len(add_on_candidates),
            watchlist_near_trigger=len(watchlist_near_trigger),
            review_date=date.today(),
        )

        pending_orders_review = self._build_pending_orders_review()

        review = DailyReview(
            watchlist_near_trigger=watchlist_near_trigger,
            new_candidates=new_candidates,
            positions_add_on_candidates=add_on_candidates,
            positions_hold=positions_hold,
            positions_update_stop=positions_update,
            positions_close=positions_close,
            positions_exit_signal=positions_exit_signal,
            summary=summary,
            pending_orders_review=pending_orders_review,
        )

        # Save to historical file (use "default" as strategy name for now)
        self._writer.save(review, "default")
        
        return review

    def _build_pending_orders_review(self) -> list[PendingOrderReview]:
        """Build PendingOrderReview items for all pending entry orders."""
        if self.orders_repo is None:
            return []
        try:
            orders, _ = self.orders_repo.list_orders(status="pending")
        except Exception:
            logger.exception("Unable to load pending orders for daily review")
            return []

        today = date.today()
        result: list[PendingOrderReview] = []
        for order in orders:
            if order.get("order_kind") != "entry":
                continue
            order_id = str(order.get("order_id", ""))
            ticker = str(order.get("ticker", ""))
            raw_date = order.get("order_date")
            try:
                order_date = date.fromisoformat(str(raw_date))
                days_pending = max((today - order_date).days, 0)
                category: Literal['stale', 'still_valid', 'no_data'] = "stale" if days_pending >= self.STALE_DAYS_THRESHOLD else "still_valid"
            except (ValueError, TypeError):
                days_pending = 0
                category = "no_data"
            result.append(
                PendingOrderReview(
                    order_id=order_id,
                    ticker=ticker,
                    category=category,
                    days_pending=days_pending,
                )
            )
        return result

    def _watchlist_near_trigger_items(self) -> list:
        if self.watchlist is None:
            return []
        try:
            items = self.watchlist.list_items()
        except Exception:
            logger.exception("Unable to build watchlist near-trigger section for daily review")
            return []
        near_trigger = []
        for item in items:
            distance = (
                item.distance_to_trigger_pct
                if hasattr(item, "distance_to_trigger_pct")
                else item.get("distance_to_trigger_pct")
            )
            if distance is not None and -3.0 <= float(distance) <= 0.0:
                near_trigger.append(item)
        return near_trigger

    def _active_manage_cfg_payload(self) -> dict:
        strategy_repo = getattr(self.screener, "_strategy_repo", None)
        if strategy_repo is None:
            return {}
        try:
            strategy = strategy_repo.get_active_strategy()
        except Exception:
            logger.exception("Unable to resolve active strategy manage config for daily review")
            return {}
        manage = strategy.get("manage", {}) if isinstance(strategy, dict) else {}
        return manage if isinstance(manage, dict) else {}

    @staticmethod
    def _time_stop_payload(position: dict, r_now: float, manage_payload: dict) -> dict:
        try:
            entry_dt = date.fromisoformat(str(position.get("entry_date") or ""))
            days_open = max((date.today() - entry_dt).days, 0)
        except ValueError:
            days_open = 0
        time_stop_days = int(manage_payload.get("time_stop_days", 15))
        time_stop_min_r = float(manage_payload.get("time_stop_min_r", 0.5))
        return {
            "days_open": days_open,
            "time_stop_warning": (
                position.get("status") == "open"
                and days_open >= time_stop_days
                and r_now < time_stop_min_r
            ),
        }

    def _time_stop_payload_from_position(self, position, r_now: float, manage_payload: dict) -> dict:
        days_open = getattr(position, "days_open", None)
        time_stop_warning = getattr(position, "time_stop_warning", None)
        if days_open is not None and time_stop_warning is not None:
            return {"days_open": int(days_open), "time_stop_warning": bool(time_stop_warning)}
        model_dump = getattr(position, "model_dump", None)
        payload = model_dump() if callable(model_dump) else dict(position)
        return self._time_stop_payload(payload, r_now, manage_payload)

    @staticmethod
    def _manage_cfg_payload_from_strategy(strategy: dict) -> dict:
        manage = strategy.get("manage", {}) if isinstance(strategy, dict) else {}
        cfg = ManageStateConfig(
            breakeven_at_R=float(manage.get("breakeven_at_r", 1.0)),
            trail_sma=int(manage.get("trail_sma", 20)),
            trail_after_R=float(manage.get("trail_after_r", 2.0)),
            sma_buffer_pct=float(manage.get("sma_buffer_pct", 0.005)),
            max_holding_days=int(manage.get("max_holding_days", 20)),
            time_stop_days=int(manage.get("time_stop_days", 15)),
            time_stop_min_r=float(manage.get("time_stop_min_r", 0.5)),
            exit_signal_days=int(manage.get("exit_signal_days", 2)),
        )
        return {
            "breakeven_at_r": cfg.breakeven_at_R,
            "trail_after_r": cfg.trail_after_R,
            "trail_sma": cfg.trail_sma,
            "sma_buffer_pct": cfg.sma_buffer_pct,
            "max_holding_days": cfg.max_holding_days,
            "time_stop_days": cfg.time_stop_days,
            "time_stop_min_r": cfg.time_stop_min_r,
            "exit_signal_days": cfg.exit_signal_days,
        }

    @staticmethod
    def _error_hold(ctx: _PositionActionContext, reason: str) -> DailyReviewPositionHold:
        """Build a hold entry for a position whose stop suggestion failed."""
        return DailyReviewPositionHold(
            position_id=ctx.position_id,
            ticker=ctx.err_ticker,
            entry_price=ctx.err_entry_price,
            stop_price=ctx.err_stop_price,
            current_price=ctx.err_current_price,
            r_now=0.0,
            **ctx.time_stop(0.0),
            reason=reason,
        )

    def _classify_position_action(
        self,
        suggestion: PositionUpdate,
        ctx: _PositionActionContext,
        buckets: _ActionBuckets,
    ) -> None:
        """Categorize a successful stop suggestion into the right action bucket."""
        if suggestion.action == "NO_ACTION":
            ticker, entry, stop = ctx.success_fields(suggestion)
            trim_suggestion = (
                TrimSuggestion(r_threshold=ctx.trim_r_threshold, r_now=suggestion.r_now)
                if suggestion.r_now >= ctx.trim_r_threshold
                else None
            )
            buckets.hold.append(
                DailyReviewPositionHold(
                    position_id=ctx.position_id,
                    ticker=ticker,
                    entry_price=entry,
                    stop_price=stop,
                    current_price=suggestion.last,
                    r_now=suggestion.r_now,
                    **ctx.time_stop(suggestion.r_now),
                    reason=suggestion.reason,
                    exhaustion_score=suggestion.exhaustion_score,
                    exhaustion_label=suggestion.exhaustion_label,
                    trim_suggestion=trim_suggestion,
                )
            )
        elif suggestion.action == "MOVE_STOP_UP":
            ticker, entry, stop = ctx.success_fields(suggestion)
            buckets.update.append(
                DailyReviewPositionUpdate(
                    position_id=ctx.position_id,
                    ticker=ticker,
                    entry_price=entry,
                    stop_current=stop,
                    stop_suggested=suggestion.stop_suggested,
                    current_price=suggestion.last,
                    r_now=suggestion.r_now,
                    **ctx.time_stop(suggestion.r_now),
                    reason=suggestion.reason,
                    exhaustion_score=suggestion.exhaustion_score,
                    exhaustion_label=suggestion.exhaustion_label,
                )
            )
        elif suggestion.action in ["CLOSE_STOP_HIT", "CLOSE_TIME_EXIT"]:
            ticker, entry, stop = ctx.success_fields(suggestion)
            buckets.close.append(
                DailyReviewPositionClose(
                    position_id=ctx.position_id,
                    ticker=ticker,
                    entry_price=entry,
                    stop_price=stop,
                    current_price=suggestion.last,
                    r_now=suggestion.r_now,
                    **ctx.time_stop(suggestion.r_now),
                    reason=suggestion.reason,
                )
            )
        elif suggestion.action == "CLOSE_EXIT_SIGNAL":
            ticker, entry, stop = ctx.success_fields(suggestion)
            days_open = ctx.time_stop(suggestion.r_now).get("days_open", 0)
            buckets.exit_signal.append(
                DailyReviewPositionExitSignal(
                    position_id=ctx.position_id,
                    ticker=ticker,
                    entry_price=entry,
                    stop_price=stop,
                    current_price=suggestion.last,
                    r_now=suggestion.r_now,
                    days_open=days_open,
                    reason=suggestion.reason,
                )
            )

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

        # Re-entries are fresh buy decisions (no open position), so rank them
        # among new opportunities by screener priority. Add-ons / scale-backs
        # depend on an existing position and stay in the portfolio sub-group.
        new_candidates = [to_daily_review_candidate(c) for c in candidates if c.same_symbol is None or c.same_symbol.mode in ("NEW_ENTRY", "RE_ENTRY")]
        add_on_candidates = [to_daily_review_candidate(c) for c in candidates if c.same_symbol is not None and c.same_symbol.mode in ("ADD_ON", "SCALE_BACK")]

        manage_payload = self._manage_cfg_payload_from_strategy(strategy)
        trim_r_threshold_state = float(
            (strategy.get("manage", {}) if isinstance(strategy, dict) else {}).get("trim_r_threshold", 2.0)
        )

        buckets = _ActionBuckets()
        for pos in positions:
            if pos.get("status") != "open":
                continue

            position_id = str(pos.get("position_id") or f"LOCAL-{pos.get('ticker', 'UNKNOWN')}")
            ctx = _PositionActionContext(
                position_id=position_id,
                err_ticker=str(pos.get("ticker", "")),
                err_entry_price=float(pos.get("entry_price", 0.0)),
                err_stop_price=float(pos.get("stop_price", 0.0)),
                err_current_price=float(pos.get("current_price") or pos.get("entry_price") or 0.0),
                trim_r_threshold=trim_r_threshold_state,
                success_fields=lambda s: (s.ticker, s.entry, s.stop_old),
                time_stop=lambda r, p=pos: self._time_stop_payload(p, r, manage_payload),
            )
            try:
                suggestion = self.portfolio.compute_position_stop_suggestion(pos, manage_payload)
            except DomainError as exc:
                logger.warning(
                    "Stateless daily review stop suggestion unavailable for %s: %s",
                    pos.get("ticker"),
                    exc.detail,
                )
                buckets.hold.append(self._error_hold(ctx, f"Stop suggestion unavailable: {exc.detail}"))
                continue
            except Exception as exc:
                logger.exception(
                    "Unexpected stateless stop suggestion error for %s",
                    pos.get("ticker"),
                )
                buckets.hold.append(self._error_hold(ctx, f"Stop suggestion unavailable: {exc}"))
                continue

            self._classify_position_action(suggestion, ctx, buckets)

        positions_hold = buckets.hold
        positions_update = buckets.update
        positions_close = buckets.close
        positions_exit_signal = buckets.exit_signal

        return DailyReview(
            watchlist_near_trigger=[],
            new_candidates=new_candidates,
            positions_add_on_candidates=add_on_candidates,
            positions_hold=positions_hold,
            positions_update_stop=positions_update,
            positions_close=positions_close,
            positions_exit_signal=positions_exit_signal,
            summary=DailyReviewSummary(
                total_positions=len([position for position in positions if position.get("status") == "open"]),
                no_action=len(positions_hold),
                update_stop=len(positions_update),
                close_positions=len(positions_close),
                exit_signal=len(positions_exit_signal),
                new_candidates=len(new_candidates),
                add_on_candidates=len(add_on_candidates),
                watchlist_near_trigger=0,
                review_date=date.today(),
            ),
        )
    
