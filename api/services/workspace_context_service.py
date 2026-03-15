"""Workspace context assembly for read-only chat and tools."""
from __future__ import annotations

import logging
from typing import Optional

from api.models.chat import (
    WorkspaceContext,
    WorkspaceContextMeta,
    WorkspaceContextSourceMeta,
    WorkspaceIntelligenceContext,
    WorkspaceSnapshot,
)
from api.models.intelligence import IntelligenceEducationGenerateResponse
from api.models.strategy import Strategy
from api.services.intelligence_service import IntelligenceService
from api.services.portfolio_service import PortfolioService
from api.services.strategy_service import StrategyService
from swing_screener.intelligence.storage import IntelligenceStorage

logger = logging.getLogger(__name__)


def _normalize_ticker(value: Optional[str]) -> Optional[str]:
    text = " ".join(str(value or "").split()).strip().upper()
    return text or None


def _clean_text(value: object, *, max_len: int = 220) -> str:
    text = " ".join(str(value or "").split()).strip()
    if len(text) <= max_len:
        return text
    return f"{text[: max_len - 1]}…"


class WorkspaceContextService:
    """Build a normalized workspace context from stored state plus UI snapshot."""

    def __init__(
        self,
        *,
        portfolio_service: PortfolioService,
        strategy_service: StrategyService,
        intelligence_service: IntelligenceService,
        storage: IntelligenceStorage | None = None,
    ) -> None:
        self._portfolio_service = portfolio_service
        self._strategy_service = strategy_service
        self._intelligence_service = intelligence_service
        self._storage = storage or IntelligenceStorage()

    def _active_account_size(self) -> float:
        try:
            strategy: Strategy | dict = self._strategy_service.get_active_strategy()
            risk = strategy["risk"] if isinstance(strategy, dict) else strategy.risk
            account_size = risk["account_size"] if isinstance(risk, dict) else risk.account_size
            return float(account_size)
        except Exception as exc:
            logger.warning("Failed to resolve active strategy account size: %s", exc)
            return 0.0

    def _selected_candidate(
        self,
        selected_ticker: str | None,
        workspace_snapshot: WorkspaceSnapshot | None,
    ):
        if workspace_snapshot is None:
            return None
        if selected_ticker:
            for candidate in workspace_snapshot.candidates:
                if candidate.ticker == selected_ticker:
                    return candidate
        return workspace_snapshot.candidates[0] if workspace_snapshot.candidates else None

    def _build_fact_map(self, context: WorkspaceContext) -> dict[str, str]:
        facts: dict[str, str] = {}
        if context.selected_ticker:
            facts["selected_ticker"] = context.selected_ticker

        pending_orders = [order for order in context.orders if order.status == "pending"]
        open_positions = [position for position in context.positions if position.status == "open"]
        facts["portfolio.orders.count"] = str(len(context.orders))
        facts["portfolio.orders.pending_count"] = str(len(pending_orders))
        facts["portfolio.positions.count"] = str(len(context.positions))
        facts["portfolio.positions.open_count"] = str(len(open_positions))

        if context.portfolio_summary is not None:
            summary = context.portfolio_summary
            facts["portfolio.summary.total_pnl"] = f"{summary.total_pnl:.2f}"
            facts["portfolio.summary.available_capital"] = f"{summary.available_capital:.2f}"
            facts["portfolio.summary.win_rate"] = f"{summary.win_rate:.2f}"

        if context.selected_ticker:
            selected_position = next(
                (position for position in context.positions if position.ticker.upper() == context.selected_ticker),
                None,
            )
            if selected_position is not None:
                facts["portfolio.selected_position.ticker"] = selected_position.ticker
                facts["portfolio.selected_position.pnl"] = f"{selected_position.pnl:.2f}"
                facts["portfolio.selected_position.r_now"] = f"{selected_position.r_now:.2f}"
                if selected_position.current_price is not None:
                    facts["portfolio.selected_position.current_price"] = f"{selected_position.current_price:.2f}"
                facts["portfolio.selected_position.stop_price"] = f"{selected_position.stop_price:.2f}"

            matching_orders = [
                order for order in context.orders if order.ticker.upper() == context.selected_ticker
            ]
            if matching_orders:
                facts["portfolio.selected_orders.count"] = str(len(matching_orders))
                facts["portfolio.selected_orders.statuses"] = ", ".join(
                    sorted({order.status for order in matching_orders})
                )

        if context.screener_snapshot is not None:
            if context.screener_snapshot.asof_date:
                facts["screener.snapshot.asof"] = context.screener_snapshot.asof_date
            if context.screener_snapshot.candidates:
                facts["screener.snapshot.top_candidates"] = ", ".join(
                    candidate.ticker for candidate in context.screener_snapshot.candidates[:5]
                )

        if context.selected_candidate is not None:
            candidate = context.selected_candidate
            facts["screener.selected_candidate.ticker"] = candidate.ticker
            if candidate.signal:
                facts["screener.selected_candidate.signal"] = candidate.signal
            if candidate.score is not None:
                facts["screener.selected_candidate.score"] = f"{candidate.score:.2f}"
            if candidate.confidence is not None:
                facts["screener.selected_candidate.confidence"] = f"{candidate.confidence:.2f}"
            if candidate.entry is not None:
                facts["screener.selected_candidate.entry"] = f"{candidate.entry:.2f}"
            if candidate.stop is not None:
                facts["screener.selected_candidate.stop"] = f"{candidate.stop:.2f}"
            if candidate.target is not None:
                facts["screener.selected_candidate.target"] = f"{candidate.target:.2f}"
            if candidate.rr is not None:
                facts["screener.selected_candidate.rr"] = f"{candidate.rr:.2f}"
            if candidate.recommendation_verdict:
                facts["screener.selected_candidate.verdict"] = candidate.recommendation_verdict
            if candidate.reasons_short:
                facts["screener.selected_candidate.reasons"] = "; ".join(candidate.reasons_short[:4])
            if candidate.beginner_explanation:
                facts["screener.selected_candidate.beginner_explanation"] = _clean_text(
                    candidate.beginner_explanation,
                    max_len=320,
                )
            if candidate.same_symbol is not None:
                facts["screener.selected_candidate.same_symbol.mode"] = candidate.same_symbol.mode
                facts["screener.selected_candidate.same_symbol.reason"] = _clean_text(candidate.same_symbol.reason)
                if candidate.same_symbol.current_position_stop is not None:
                    facts["screener.selected_candidate.same_symbol.current_position_stop"] = (
                        f"{candidate.same_symbol.current_position_stop:.2f}"
                    )
                if candidate.same_symbol.fresh_setup_stop is not None:
                    facts["screener.selected_candidate.same_symbol.fresh_setup_stop"] = (
                        f"{candidate.same_symbol.fresh_setup_stop:.2f}"
                    )
                if candidate.same_symbol.execution_stop is not None:
                    facts["screener.selected_candidate.same_symbol.execution_stop"] = (
                        f"{candidate.same_symbol.execution_stop:.2f}"
                    )

        if context.intelligence is not None:
            if context.intelligence.asof_date:
                facts["intelligence.asof"] = context.intelligence.asof_date
            selected_opportunity = context.intelligence.opportunities[0] if context.intelligence.opportunities else None
            if selected_opportunity is not None:
                facts["intelligence.selected_opportunity.state"] = selected_opportunity.state
                facts["intelligence.selected_opportunity.opportunity_score"] = (
                    f"{selected_opportunity.opportunity_score:.2f}"
                )
                facts["intelligence.selected_opportunity.technical_readiness"] = (
                    f"{selected_opportunity.technical_readiness:.2f}"
                )
                facts["intelligence.selected_opportunity.catalyst_strength"] = (
                    f"{selected_opportunity.catalyst_strength:.2f}"
                )
                if selected_opportunity.explanations:
                    facts["intelligence.selected_opportunity.explanations"] = "; ".join(
                        selected_opportunity.explanations[:3]
                    )
            if context.intelligence.events:
                latest_event = context.intelligence.events[0]
                facts["intelligence.selected_events.latest"] = (
                    f"{latest_event.event_type} from {latest_event.source_name} "
                    f"(materiality {latest_event.materiality:.2f}, confidence {latest_event.confidence:.2f})"
                )
            if context.intelligence.education is not None:
                thesis = context.intelligence.education.outputs.get("thesis")
                if thesis is not None:
                    facts["intelligence.selected_education.thesis_summary"] = _clean_text(
                        thesis.summary,
                        max_len=320,
                    )

        return facts

    def build_context(
        self,
        *,
        selected_ticker: str | None = None,
        workspace_snapshot: WorkspaceSnapshot | None = None,
    ) -> WorkspaceContext:
        normalized_ticker = _normalize_ticker(selected_ticker)
        warnings: list[str] = []

        orders_response = self._portfolio_service.list_orders()
        positions_response = self._portfolio_service.list_positions()

        account_size = self._active_account_size()
        portfolio_summary = (
            self._portfolio_service.get_portfolio_summary(account_size) if account_size > 0 else None
        )

        selected_candidate = self._selected_candidate(normalized_ticker, workspace_snapshot)
        if normalized_ticker is None and selected_candidate is not None:
            normalized_ticker = selected_candidate.ticker

        intelligence_asof = self._storage.latest_opportunities_date()
        intelligence_opportunities = []
        intelligence_events = []
        if intelligence_asof:
            try:
                opportunities = self._intelligence_service.get_opportunities(
                    asof_date=intelligence_asof,
                    symbols=[normalized_ticker] if normalized_ticker else None,
                )
                intelligence_opportunities = opportunities.opportunities
            except Exception as exc:
                logger.warning("Failed to load intelligence opportunities for workspace context: %s", exc)
                warnings.append("Latest cached intelligence opportunities could not be loaded.")

            try:
                events = self._intelligence_service.get_events(
                    asof_date=intelligence_asof,
                    symbols=[normalized_ticker] if normalized_ticker else None,
                )
                intelligence_events = events.events[:8]
            except Exception as exc:
                logger.warning("Failed to load intelligence events for workspace context: %s", exc)
                warnings.append("Latest cached intelligence events could not be loaded.")
        else:
            warnings.append("No cached intelligence snapshot is available yet.")

        education = None
        education_asof = self._storage.latest_education_date() or intelligence_asof
        if normalized_ticker and education_asof:
            raw_education = self._storage.load_symbol_education(education_asof, normalized_ticker)
            if raw_education:
                try:
                    education = IntelligenceEducationGenerateResponse.model_validate(raw_education).model_copy(
                        update={"source": "cache"}
                    )
                except Exception as exc:
                    logger.warning("Failed to parse cached education for %s: %s", normalized_ticker, exc)
                    warnings.append(f"Cached education for {normalized_ticker} is invalid.")
            else:
                warnings.append(f"No cached education is available for {normalized_ticker}.")

        intelligence_context = None
        if intelligence_asof or education is not None:
            intelligence_context = WorkspaceIntelligenceContext(
                asof_date=intelligence_asof,
                opportunities=intelligence_opportunities,
                events=intelligence_events,
                education=education,
            )

        context = WorkspaceContext(
            selected_ticker=normalized_ticker,
            orders=orders_response.orders,
            positions=positions_response.positions,
            portfolio_summary=portfolio_summary,
            screener_snapshot=workspace_snapshot,
            selected_candidate=selected_candidate,
            intelligence=intelligence_context,
            warnings=warnings,
            meta=WorkspaceContextMeta(
                selected_ticker=normalized_ticker,
                sources=[
                    WorkspaceContextSourceMeta(
                        source="portfolio",
                        label="Portfolio",
                        loaded=True,
                        origin="stored_state",
                        asof=max(
                            orders_response.asof,
                            positions_response.asof,
                        ),
                        count=len(orders_response.orders) + len(positions_response.positions),
                    ),
                    WorkspaceContextSourceMeta(
                        source="screener",
                        label="Screener",
                        loaded=workspace_snapshot is not None,
                        origin="workspace_snapshot",
                        asof=workspace_snapshot.asof_date if workspace_snapshot else None,
                        count=len(workspace_snapshot.candidates) if workspace_snapshot else 0,
                    ),
                    WorkspaceContextSourceMeta(
                        source="intelligence",
                        label="Intelligence",
                        loaded=bool(intelligence_asof),
                        origin="cached_snapshot",
                        asof=intelligence_asof,
                        count=len(intelligence_opportunities) + len(intelligence_events),
                    ),
                    WorkspaceContextSourceMeta(
                        source="education",
                        label="Education",
                        loaded=education is not None,
                        origin="cached_snapshot",
                        asof=education.asof_date if education else education_asof,
                        count=1 if education is not None else 0,
                    ),
                ],
            ),
        )
        context.fact_map = self._build_fact_map(context)
        return context
