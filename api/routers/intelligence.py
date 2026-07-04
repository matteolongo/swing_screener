"""API endpoints for on-demand and batch symbol intelligence analysis."""
from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.models.intelligence_chat import IntelligenceChatRequest, IntelligenceChatResponse
from api.models.position_review import PositionReviewRequest, PositionReviewResponse
from api.models.strategic_review import StrategicReviewRequest
from api.dependencies import get_fundamentals_service, get_portfolio_service, get_positions_repo
from api.repositories.positions_repo import PositionsRepository
from api.services.intelligence_chat_service import IntelligenceChatService, MissingIntelligenceError
from api.services.position_review_service import MissingPositionReviewContextError, PositionReviewService
from api.services.strategic_review_service import StrategicReviewService
from api.services.fundamentals_service import FundamentalsService
from api.services.intelligence_enrichment import (
    enrich_intelligence_request,
    enrich_with_polygon_prices,
    enrich_with_technicals,
)
from swing_screener.intelligence.evidence.collect import collect_evidence
from api.services.portfolio_service import PortfolioService
from swing_screener.intelligence.cache import read_from_cache
from swing_screener.intelligence.history import HistoryEntry, read_history
from swing_screener.intelligence.models import SymbolIntelligence, SymbolIntelligenceRequest
from swing_screener.intelligence.strategic import StrategicIntelligenceReport
from swing_screener.intelligence.config_access import intelligence_config_section
from swing_screener.intelligence.symbol_analyzer import SymbolAnalyzer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/intelligence", tags=["intelligence"])


def _dividend_for(ticker: str) -> tuple[int | None, str | None, float | None]:
    try:
        from swing_screener.fundamentals.providers.degiro import _load_isin_map
        isin_map = _load_isin_map()
        isin = isin_map.get(ticker.upper()) or isin_map.get(ticker.split(".")[0].upper())
        if not isin:
            return None, None, None
        from api.services.portfolio.degiro_dividend import get_dividend_proximity
        prox = get_dividend_proximity(isin)
        if prox is None:
            return None, None, None
        return prox.days_until, prox.ex_date, prox.amount
    except Exception as exc:
        logger.debug("Dividend lookup failed for %s: %s", ticker, exc)
        return None, None, None

_analyzer: SymbolAnalyzer | None = None
_chat_service: IntelligenceChatService | None = None
_strategic_review_service: StrategicReviewService | None = None


def _get_analyzer() -> SymbolAnalyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = SymbolAnalyzer()
    return _analyzer


def _get_chat_service() -> IntelligenceChatService:
    global _chat_service
    if _chat_service is None:
        _chat_service = IntelligenceChatService()
    return _chat_service


def _get_strategic_review_service() -> StrategicReviewService:
    global _strategic_review_service
    if _strategic_review_service is None:
        _strategic_review_service = StrategicReviewService()
    return _strategic_review_service


def _require_api_key() -> None:
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured")


def _require_analyzer_enabled() -> None:
    cfg = intelligence_config_section("llm")
    if not bool(cfg.get("analyzer_enabled", True)):
        raise HTTPException(status_code=503, detail="Symbol intelligence analyzer is disabled")


class SweepSymbol(BaseModel):
    ticker: str
    request: SymbolIntelligenceRequest
    force: bool = False


class SweepRequest(BaseModel):
    symbols: list[SweepSymbol]


class SweepFailure(BaseModel):
    ticker: str
    error: str


class SweepResponse(BaseModel):
    analyzed: list[str]
    failed: list[SweepFailure]


class AnalysisHistoryResponse(BaseModel):
    entries: list[HistoryEntry]


@router.post("/sweep", response_model=SweepResponse)
def sweep(
    request: SweepRequest,
    positions_repo: PositionsRepository = Depends(get_positions_repo),
    fundamentals_service: FundamentalsService = Depends(get_fundamentals_service),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> SweepResponse:
    """Run intelligence analysis for a batch of symbols, caching each result."""
    _require_api_key()
    _require_analyzer_enabled()
    analyzer = _get_analyzer()
    past_positions, _ = positions_repo.list_positions(status="closed")
    analyzed: list[str] = []
    failed: list[SweepFailure] = []
    for item in request.symbols:
        try:
            upper = item.ticker.upper()
            if not item.force:
                cached = read_from_cache(upper)
                if cached is not None:
                    analyzed.append(upper)
                    continue
            item_req = enrich_intelligence_request(
                upper,
                item.request,
                fundamentals=fundamentals_service,
                earnings=lambda t: (lambda ep: (ep.days_until, ep.next_earnings_date))(portfolio_service.get_earnings_proximity(t)),
                dividend=_dividend_for,
                evidence=lambda t: collect_evidence(t),
            )
            try:
                ohlcv = portfolio_service.fetch_recent_ohlcv(upper)
                item_req = enrich_with_technicals(upper, item_req, ohlcv)
            except Exception:
                logger.warning("Sweep technical enrichment skipped for %r", item.ticker, exc_info=True)
            item_req = enrich_with_polygon_prices(upper, item_req)
            analyzer.analyze(upper, item_req, past_positions=past_positions)
            analyzed.append(upper)
        except Exception as exc:
            logger.warning("Sweep failed for %s: %s", item.ticker, exc)
            failed.append(SweepFailure(ticker=item.ticker.upper(), error=str(exc)))
    return SweepResponse(analyzed=analyzed, failed=failed)


@router.get("/{ticker}/history", response_model=AnalysisHistoryResponse)
def get_history(ticker: str) -> AnalysisHistoryResponse:
    """Return the per-symbol analysis history (newest-first, capped). Empty if none."""
    return AnalysisHistoryResponse(entries=read_history(ticker.upper()))


@router.get("/{ticker}/chat", response_model=IntelligenceChatResponse)
def get_symbol_chat(ticker: str) -> IntelligenceChatResponse:
    """Return today's persisted intelligence follow-up chat for a symbol."""
    try:
        return _get_chat_service().get_chat(ticker)
    except MissingIntelligenceError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/{ticker}/chat", response_model=IntelligenceChatResponse)
def chat_with_symbol(ticker: str, request: IntelligenceChatRequest) -> IntelligenceChatResponse:
    """Ask an advisory follow-up question about today's cached intelligence analysis."""
    _require_analyzer_enabled()
    try:
        return _get_chat_service().send_message(ticker, request)
    except MissingIntelligenceError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except RuntimeError as exc:
        if "OPENAI_API_KEY" in str(exc):
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/strategic-review", response_model=StrategicIntelligenceReport)
def strategic_review(request: StrategicReviewRequest) -> StrategicIntelligenceReport:
    """Build a manual app-context-only strategic overlay for a symbol."""
    _require_analyzer_enabled()
    try:
        return _get_strategic_review_service().review(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/position-review/{position_id}", response_model=PositionReviewResponse)
def review_position(
    position_id: str,
    request: PositionReviewRequest,
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> PositionReviewResponse:
    """Run an advisory manual review for an open position without mutating it."""
    try:
        return PositionReviewService(portfolio_service=portfolio_service).review_position(position_id, request)
    except MissingPositionReviewContextError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/{ticker}/position-review", response_model=PositionReviewResponse)
def review_symbol(
    ticker: str,
    request: PositionReviewRequest,
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> PositionReviewResponse:
    """Run an advisory manual review for a symbol using cached/refreshed app context."""
    try:
        return PositionReviewService(portfolio_service=portfolio_service).review_symbol(ticker, request)
    except MissingPositionReviewContextError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


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
    force: bool = False,
    positions_repo: PositionsRepository = Depends(get_positions_repo),
    fundamentals_service: FundamentalsService = Depends(get_fundamentals_service),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> SymbolIntelligence:
    """Generate a web-search-grounded LLM analysis for a symbol, after enriching with full data."""
    _require_api_key()
    _require_analyzer_enabled()
    upper = ticker.upper()
    if not force:
        cached = read_from_cache(upper)
        if cached is not None:
            return cached

    def _earnings(t: str) -> tuple[int | None, str | None]:
        ep = portfolio_service.get_earnings_proximity(t)
        return ep.days_until, ep.next_earnings_date

    request = enrich_intelligence_request(
        upper,
        request,
        fundamentals=fundamentals_service,
        earnings=_earnings,
        dividend=_dividend_for,
        evidence=lambda t: collect_evidence(t),
    )
    request = enrich_with_polygon_prices(upper, request)
    try:
        past_positions, _ = positions_repo.list_positions(status="closed")
        return _get_analyzer().analyze(upper, request, past_positions=past_positions)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/position/{position_id}", response_model=SymbolIntelligence)
def analyze_position(
    position_id: str,
    force: bool = False,
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
    fundamentals_service: FundamentalsService = Depends(get_fundamentals_service),
) -> SymbolIntelligence:
    """Trigger a position-aware LLM analysis for an open position.

    The request is enriched with the same fundamentals and technicals a screener candidate gets,
    so the model has real data to manage the position instead of just entry/stop.
    """
    _require_api_key()
    _require_analyzer_enabled()
    result = portfolio_service.list_positions(status="open", time_stop_days=None, time_stop_min_r=None)
    pos = next((p for p in result.positions if p.position_id == position_id), None)
    if pos is None:
        raise HTTPException(status_code=404, detail=f"No open position with id {position_id!r}")
    if not force:
        cached = read_from_cache(pos.ticker.upper())
        if cached is not None:
            return cached
    stop = portfolio_service.suggest_position_stop(position_id)
    request = SymbolIntelligenceRequest(
        close=float(pos.current_price if pos.current_price is not None else pos.entry_price),
        signal=stop.action,
        entry_price=float(pos.entry_price),
        entry=float(pos.entry_price),
        entry_date=str(pos.entry_date) if pos.entry_date is not None else None,
        stop=float(pos.stop_price),
        r_now=float(pos.r_now),
        days_open=int(pos.days_open),
    )

    def _earnings(t: str) -> tuple[int | None, str | None]:
        ep = portfolio_service.get_earnings_proximity(t)
        return ep.days_until, ep.next_earnings_date

    request = enrich_intelligence_request(
        pos.ticker,
        request,
        fundamentals=fundamentals_service,
        earnings=_earnings,
        dividend=_dividend_for,
        evidence=lambda t: collect_evidence(t),
    )
    try:
        ohlcv = portfolio_service.fetch_recent_ohlcv(pos.ticker)
        request = enrich_with_technicals(pos.ticker, request, ohlcv)
    except Exception:
        logger.warning("Technical enrichment skipped for %r", pos.ticker, exc_info=True)
    request = enrich_with_polygon_prices(pos.ticker, request)
    # Re-pin close to the live position price after Polygon enrichment.
    # Polygon OHLCV only carries completed-session closes, so during an open
    # session it returns yesterday's close — contradicting r_now computed from
    # today's intraday price and causing the LLM to misread position direction.
    if pos.current_price is not None:
        request = request.model_copy(update={"close": float(pos.current_price)})
    try:
        return _get_analyzer().analyze(pos.ticker.upper(), request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
