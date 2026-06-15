"""API endpoints for on-demand and batch symbol intelligence analysis."""
from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.dependencies import get_fundamentals_service, get_portfolio_service, get_positions_repo
from api.repositories.positions_repo import PositionsRepository
from api.services.fundamentals_service import FundamentalsService
from api.services.intelligence_enrichment import enrich_intelligence_request
from api.services.portfolio_service import PortfolioService
from swing_screener.intelligence.cache import read_from_cache
from swing_screener.intelligence.models import SymbolIntelligence, SymbolIntelligenceRequest
from swing_screener.intelligence.symbol_analyzer import SymbolAnalyzer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/intelligence", tags=["intelligence"])


def _require_api_key() -> None:
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured")


class SweepSymbol(BaseModel):
    ticker: str
    request: SymbolIntelligenceRequest


class SweepRequest(BaseModel):
    symbols: list[SweepSymbol]


class SweepFailure(BaseModel):
    ticker: str
    error: str


class SweepResponse(BaseModel):
    analyzed: list[str]
    failed: list[SweepFailure]


@router.post("/sweep", response_model=SweepResponse)
def sweep(request: SweepRequest) -> SweepResponse:
    """Run intelligence analysis for a batch of symbols, caching each result."""
    _require_api_key()
    analyzer = SymbolAnalyzer()
    analyzed: list[str] = []
    failed: list[SweepFailure] = []
    for item in request.symbols:
        try:
            analyzer.analyze(item.ticker.upper(), item.request)
            analyzed.append(item.ticker.upper())
        except Exception as exc:
            logger.warning("Sweep failed for %s: %s", item.ticker, exc)
            failed.append(SweepFailure(ticker=item.ticker.upper(), error=str(exc)))
    return SweepResponse(analyzed=analyzed, failed=failed)


@router.get("/{ticker}/latest", response_model=SymbolIntelligence)
def get_latest(ticker: str) -> SymbolIntelligence:
    """Return today's cached intelligence result for a symbol, or 404."""
    result = read_from_cache(ticker.upper())
    if result is None:
        raise HTTPException(status_code=404, detail=f"No cached analysis for {ticker} today")
    return result


@router.post("/{ticker}", response_model=SymbolIntelligence)
def analyze_symbol(
    ticker: str,
    request: SymbolIntelligenceRequest,
    positions_repo: PositionsRepository = Depends(get_positions_repo),
    fundamentals_service: FundamentalsService = Depends(get_fundamentals_service),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> SymbolIntelligence:
    """Generate a web-search-grounded LLM analysis for a symbol, after enriching with full data."""
    _require_api_key()
    upper = ticker.upper()

    def _earnings(t: str) -> tuple[int | None, str | None]:
        ep = portfolio_service.get_earnings_proximity(t)
        return ep.days_until, ep.next_earnings_date

    request = enrich_intelligence_request(
        upper,
        request,
        fundamentals=fundamentals_service,
        earnings=_earnings,
    )
    try:
        past_positions, _ = positions_repo.list_positions(status="closed")
        analyzer = SymbolAnalyzer()
        return analyzer.analyze(upper, request, past_positions=past_positions)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/position/{position_id}", response_model=SymbolIntelligence)
def analyze_position(
    position_id: str,
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> SymbolIntelligence:
    """Trigger a position-aware LLM analysis for an open position."""
    _require_api_key()
    result = portfolio_service.list_positions(status="open", time_stop_days=None, time_stop_min_r=None)
    pos = next((p for p in result.positions if p.position_id == position_id), None)
    if pos is None:
        raise HTTPException(status_code=404, detail=f"No open position with id {position_id!r}")
    stop = portfolio_service.suggest_position_stop(position_id)
    earnings_days: int | None = None
    earnings_date: str | None = None
    try:
        ep = portfolio_service.get_earnings_proximity(pos.ticker)
        if ep.days_until is not None:
            earnings_days = ep.days_until
            earnings_date = ep.next_earnings_date
    except Exception:
        pass
    request = SymbolIntelligenceRequest(
        close=float(pos.current_price if pos.current_price is not None else pos.entry_price),
        signal=stop.action,
        entry_price=float(pos.entry_price),
        entry=float(pos.entry_price),
        stop=float(pos.stop_price),
        r_now=float(pos.r_now),
        days_open=int(pos.days_open),
        days_to_earnings=earnings_days,
        next_earnings_date=earnings_date,
    )
    try:
        analyzer = SymbolAnalyzer()
        return analyzer.analyze(pos.ticker.upper(), request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
