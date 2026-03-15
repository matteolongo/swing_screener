from __future__ import annotations

from api.models.chat import (
    WorkspaceContext,
    WorkspaceContextMeta,
    WorkspaceContextSourceMeta,
    WorkspaceIntelligenceContext,
    WorkspaceScreenerCandidateSnapshot,
    WorkspaceSnapshot,
)
from api.models.intelligence import (
    IntelligenceEducationGenerateResponse,
    IntelligenceEducationViewOutput,
    IntelligenceEventResponse,
    IntelligenceOpportunityResponse,
)
from api.models.screener import SameSymbolCandidateContext
from api.models.intelligence_config import IntelligenceConfigModel
from api.models.portfolio import Order, PortfolioSummary, PositionWithMetrics


def make_order(
    *,
    ticker: str = "AAPL",
    status: str = "pending",
    order_id: str = "ORD-AAPL-1",
    order_type: str = "BUY_LIMIT",
    quantity: int = 5,
    limit_price: float | None = 101.0,
    stop_price: float | None = 96.0,
) -> Order:
    return Order(
        order_id=order_id,
        ticker=ticker,
        status=status,
        order_type=order_type,
        quantity=quantity,
        limit_price=limit_price,
        stop_price=stop_price,
        order_date="2026-03-13",
        filled_date="",
        entry_price=None,
        notes="",
        order_kind="entry",
        parent_order_id=None,
        position_id=None,
        tif="GTC",
    )


def make_position(
    *,
    ticker: str = "AAPL",
    status: str = "open",
    position_id: str = "POS-AAPL-1",
    entry_price: float = 100.0,
    current_price: float = 105.0,
    stop_price: float = 96.0,
    shares: int = 5,
    pnl: float = 25.0,
    r_now: float = 1.25,
) -> PositionWithMetrics:
    return PositionWithMetrics(
        ticker=ticker,
        status=status,
        entry_date="2026-03-01",
        entry_price=entry_price,
        stop_price=stop_price,
        shares=shares,
        position_id=position_id,
        source_order_id=f"ORD-{ticker}-ENTRY",
        initial_risk=(entry_price - stop_price) * shares,
        max_favorable_price=current_price,
        exit_date=None,
        exit_price=None,
        exit_fee_eur=None,
        current_price=current_price,
        notes="",
        exit_order_ids=None,
        pnl=pnl,
        fees_eur=0.0,
        pnl_percent=5.0,
        r_now=r_now,
        entry_value=entry_price * shares,
        current_value=current_price * shares,
        per_share_risk=entry_price - stop_price,
        total_risk=(entry_price - stop_price) * shares,
    )


def make_portfolio_summary() -> PortfolioSummary:
    return PortfolioSummary(
        total_positions=1,
        total_value=525.0,
        total_cost_basis=500.0,
        total_pnl=25.0,
        total_fees_eur=0.0,
        total_pnl_percent=5.0,
        open_risk=20.0,
        open_risk_percent=0.04,
        account_size=50000.0,
        available_capital=49475.0,
        largest_position_value=525.0,
        largest_position_ticker="AAPL",
        best_performer_ticker="AAPL",
        best_performer_pnl_pct=5.0,
        worst_performer_ticker="AAPL",
        worst_performer_pnl_pct=5.0,
        avg_r_now=1.25,
        positions_profitable=1,
        positions_losing=0,
        win_rate=100.0,
    )


def make_workspace_snapshot(
    *tickers: str,
    same_symbol_by_ticker: dict[str, SameSymbolCandidateContext] | None = None,
) -> WorkspaceSnapshot:
    same_symbol_by_ticker = same_symbol_by_ticker or {}
    candidates = [
        WorkspaceScreenerCandidateSnapshot(
            ticker=ticker,
            currency="USD",
            rank=index + 1,
            score=0.92 - (index * 0.05),
            confidence=0.8 - (index * 0.05),
            signal="breakout",
            close=101.0 + index,
            entry=102.0 + index,
            stop=97.0 + index,
            target=112.0 + index,
            rr=2.0,
            shares=5,
            position_size_usd=510.0 + index,
            risk_usd=25.0,
            risk_pct=0.01,
            recommendation_verdict="RECOMMENDED",
            reasons_short=["Trend aligned", "Risk acceptable"],
            beginner_explanation=f"{ticker} remains valid while it stays above the stop.",
            same_symbol=same_symbol_by_ticker.get(ticker),
        )
        for index, ticker in enumerate(tickers or ("AAPL",))
    ]
    return WorkspaceSnapshot(
        asof_date="2026-03-13",
        data_freshness="final_close",
        total_screened=len(candidates),
        candidates=candidates,
    )


def make_opportunity(symbol: str = "AAPL") -> IntelligenceOpportunityResponse:
    return IntelligenceOpportunityResponse(
        symbol=symbol,
        technical_readiness=0.81,
        catalyst_strength=0.66,
        opportunity_score=0.75,
        state="CATALYST_ACTIVE",
        explanations=["technical=0.81", "catalyst=0.66", "blend=0.75"],
    )


def make_event(symbol: str = "AAPL") -> IntelligenceEventResponse:
    return IntelligenceEventResponse(
        event_id=f"EV-{symbol}-1",
        symbol=symbol,
        event_type="earnings",
        event_subtype="scheduled",
        timing_type="scheduled",
        materiality=0.72,
        confidence=0.84,
        primary_source_reliability=0.91,
        confirmation_count=2,
        published_at="2026-03-12T18:00:00",
        event_at="2026-03-18T20:00:00",
        source_name="calendar",
        raw_url="https://example.com/event",
    )


def make_education(symbol: str = "AAPL") -> IntelligenceEducationGenerateResponse:
    return IntelligenceEducationGenerateResponse(
        symbol=symbol,
        asof_date="2026-03-13",
        generated_at="2026-03-13T10:00:00",
        outputs={
            "thesis": IntelligenceEducationViewOutput(
                title=f"{symbol} Thesis",
                summary=f"{symbol} is showing a clean continuation setup with defined risk.",
                bullets=["Trend is intact"],
                watchouts=["Failed breakout"],
                next_steps=["Wait for confirmation"],
                glossary_links=[],
                facts_used=["selected_ticker"],
                source="deterministic_fallback",
                template_version="v1",
                generated_at="2026-03-13T10:00:00",
            )
        },
        status="ok",
        source="cache",
        template_version="v1",
        deterministic_facts={"selected_ticker": symbol},
        errors=[],
    )


def make_context(
    *,
    selected_ticker: str | None = None,
    orders: list[Order] | None = None,
    positions: list[PositionWithMetrics] | None = None,
    portfolio_summary: PortfolioSummary | None = None,
    screener_snapshot: WorkspaceSnapshot | None = None,
    intelligence: WorkspaceIntelligenceContext | None = None,
    warnings: list[str] | None = None,
) -> WorkspaceContext:
    orders = orders or []
    positions = positions or []
    selected_candidate = None
    if screener_snapshot is not None:
        if selected_ticker:
            selected_candidate = next(
                (candidate for candidate in screener_snapshot.candidates if candidate.ticker == selected_ticker),
                screener_snapshot.candidates[0] if screener_snapshot.candidates else None,
            )
        elif screener_snapshot.candidates:
            selected_candidate = screener_snapshot.candidates[0]

    sources = [
        WorkspaceContextSourceMeta(
            source="portfolio",
            label="Portfolio",
            loaded=True,
            origin="stored_state",
            asof="2026-03-13",
            count=len(orders) + len(positions),
        ),
        WorkspaceContextSourceMeta(
            source="screener",
            label="Screener",
            loaded=screener_snapshot is not None,
            origin="workspace_snapshot",
            asof=screener_snapshot.asof_date if screener_snapshot else None,
            count=len(screener_snapshot.candidates) if screener_snapshot else 0,
        ),
        WorkspaceContextSourceMeta(
            source="intelligence",
            label="Intelligence",
            loaded=bool(intelligence and (intelligence.opportunities or intelligence.events)),
            origin="cached_snapshot",
            asof=intelligence.asof_date if intelligence else None,
            count=len(intelligence.opportunities) + len(intelligence.events) if intelligence else 0,
        ),
        WorkspaceContextSourceMeta(
            source="education",
            label="Education",
            loaded=bool(intelligence and intelligence.education),
            origin="cached_snapshot",
            asof=intelligence.education.asof_date if intelligence and intelligence.education else None,
            count=1 if intelligence and intelligence.education else 0,
        ),
    ]

    fact_map: dict[str, str] = {
        "portfolio.orders.pending_count": str(sum(1 for order in orders if order.status == "pending")),
        "portfolio.positions.open_count": str(sum(1 for position in positions if position.status == "open")),
    }
    if portfolio_summary is not None:
        fact_map["portfolio.summary.total_pnl"] = f"{portfolio_summary.total_pnl:.2f}"
    if selected_ticker:
        fact_map["selected_ticker"] = selected_ticker
    if screener_snapshot is not None:
        fact_map["screener.snapshot.asof"] = screener_snapshot.asof_date or ""
        fact_map["screener.snapshot.top_candidates"] = ", ".join(
            candidate.ticker for candidate in screener_snapshot.candidates[:5]
        )
    if selected_candidate is not None and selected_candidate.signal:
        fact_map["screener.selected_candidate.signal"] = selected_candidate.signal
    if selected_candidate is not None and selected_candidate.entry is not None:
        fact_map["screener.selected_candidate.entry"] = f"{selected_candidate.entry:.2f}"
    if selected_candidate is not None and selected_candidate.stop is not None:
        fact_map["screener.selected_candidate.stop"] = f"{selected_candidate.stop:.2f}"
    if selected_candidate is not None and selected_candidate.target is not None:
        fact_map["screener.selected_candidate.target"] = f"{selected_candidate.target:.2f}"
    if selected_candidate is not None and selected_candidate.same_symbol is not None:
        fact_map["screener.selected_candidate.same_symbol.mode"] = selected_candidate.same_symbol.mode
        if selected_candidate.same_symbol.reason:
            fact_map["screener.selected_candidate.same_symbol.reason"] = selected_candidate.same_symbol.reason
        if selected_candidate.same_symbol.current_position_stop is not None:
            fact_map["screener.selected_candidate.same_symbol.current_position_stop"] = (
                f"{selected_candidate.same_symbol.current_position_stop:.2f}"
            )
        if selected_candidate.same_symbol.fresh_setup_stop is not None:
            fact_map["screener.selected_candidate.same_symbol.fresh_setup_stop"] = (
                f"{selected_candidate.same_symbol.fresh_setup_stop:.2f}"
            )
        if selected_candidate.same_symbol.execution_stop is not None:
            fact_map["screener.selected_candidate.same_symbol.execution_stop"] = (
                f"{selected_candidate.same_symbol.execution_stop:.2f}"
            )
    if intelligence is not None:
        if intelligence.asof_date:
            fact_map["intelligence.asof"] = intelligence.asof_date
        if intelligence.opportunities:
            fact_map["intelligence.selected_opportunity.state"] = intelligence.opportunities[0].state
        if intelligence.education is not None and "thesis" in intelligence.education.outputs:
            fact_map["intelligence.selected_education.thesis_summary"] = intelligence.education.outputs["thesis"].summary

    return WorkspaceContext(
        selected_ticker=selected_ticker,
        orders=orders,
        positions=positions,
        portfolio_summary=portfolio_summary,
        screener_snapshot=screener_snapshot,
        selected_candidate=selected_candidate,
        intelligence=intelligence,
        warnings=warnings or [],
        fact_map=fact_map,
        meta=WorkspaceContextMeta(
            selected_ticker=selected_ticker,
            sources=sources,
        ),
    )


class FakeWorkspaceContextService:
    def __init__(self, context: WorkspaceContext):
        self.context = context
        self.calls: list[tuple[str | None, WorkspaceSnapshot | None]] = []

    def build_context(self, *, selected_ticker: str | None = None, workspace_snapshot: WorkspaceSnapshot | None = None):
        self.calls.append((selected_ticker, workspace_snapshot))
        return self.context


class FakeConfigService:
    def __init__(self, *, llm_enabled: bool = False, provider: str = "mock"):
        self.llm_enabled = llm_enabled
        self.provider = provider

    def get_config(self):
        return IntelligenceConfigModel.model_validate(
            {
                "enabled": True,
                "providers": ["yahoo_finance"],
                "universe_scope": "screener_universe",
                "market_context_symbols": ["SPY"],
                "llm": {
                    "enabled": self.llm_enabled,
                    "provider": self.provider,
                    "model": "test-model",
                    "base_url": "http://localhost:11434",
                    "api_key": "",
                    "enable_cache": True,
                    "enable_audit": True,
                    "cache_path": "data/intelligence/llm_cache.json",
                    "audit_path": "data/intelligence/llm_audit",
                    "max_concurrency": 1,
                },
            }
        )
