"""API endpoints for on-demand and batch symbol intelligence analysis."""
from __future__ import annotations

import logging
import math
import os
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, model_validator

from api.models.intelligence_chat import IntelligenceChatRequest, IntelligenceChatResponse
from api.models.position_review import PositionReviewRequest, PositionReviewResponse
from api.models.strategic_review import StrategicReviewRequest
from api.dependencies import get_fundamentals_service, get_portfolio_service, get_positions_repo
from api.repositories.positions_repo import PositionsRepository
from api.services.intelligence_chat_service import IntelligenceChatService, MissingIntelligenceError
from api.services.position_review_service import MissingPositionReviewContextError, PositionReviewService
from api.services.strategic_review_service import StrategicReviewService
from api.services.fundamentals_service import FundamentalsService
from api.security.settings import get_auth_settings
from api.services.intelligence_enrichment import (
    enrich_intelligence_request,
    enrich_with_polygon_prices,
    enrich_with_technicals,
    record_enrichment_failure,
)
from swing_screener.intelligence.evidence.collect import collect_evidence
from api.services.portfolio_service import PortfolioService
from swing_screener.intelligence.cache import read_from_cache
from swing_screener.intelligence.history import HistoryEntry, read_history
from swing_screener.intelligence.models import SymbolIntelligence, SymbolIntelligenceRequest
from swing_screener.intelligence.strategic import StrategicIntelligenceReport
from swing_screener.intelligence.config_access import effective_intelligence_config
from swing_screener.intelligence.symbol_analyzer import SymbolAnalyzer, analyzer_config_signature
from swing_screener.intelligence.tracing import (
    RunIndexEntry,
    RunTrace,
    list_runs_for_ticker,
    read_run_trace,
    recording_run,
    step,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/intelligence", tags=["intelligence"])


def _set_step_output(draft, **fields) -> None:
    """Record a compact outputs summary on a trace step draft.

    ``draft`` is None when tracing is disabled (``step`` yields a nullcontext),
    so the enrichment steps stay meaningful in the trace without hard-coupling to
    the recorder. None-valued fields are dropped so empty facts don't clutter the UI.
    """
    if draft is not None:
        draft.outputs_summary = {k: v for k, v in fields.items() if v is not None}


def _brief_error(exc: BaseException) -> str:
    return f"{type(exc).__name__}: {exc}"


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
_analyzer_signature: str | None = None
_analyzer_lock = Lock()
_chat_service: IntelligenceChatService | None = None
_strategic_review_service: StrategicReviewService | None = None


def _get_analyzer() -> SymbolAnalyzer:
    global _analyzer, _analyzer_signature
    cfg = effective_intelligence_config()
    signature = analyzer_config_signature(cfg)
    if _analyzer is None or _analyzer_signature != signature:
        with _analyzer_lock:
            if _analyzer is None or _analyzer_signature != signature:
                _analyzer = SymbolAnalyzer(cfg)
                _analyzer_signature = signature
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
    runtime = effective_intelligence_config()
    cfg = runtime.get("llm", {})
    if not bool(runtime.get("enabled", False)) or not bool(cfg.get("enabled", True)):
        raise HTTPException(status_code=503, detail="Symbol intelligence is disabled for the active strategy")
    if not bool(cfg.get("analyzer_enabled", True)):
        raise HTTPException(status_code=503, detail="Symbol intelligence analyzer is disabled")


def _finite_position_number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    numeric = float(value)
    if not math.isfinite(numeric):
        return None
    return round(numeric, 6)


def _position_cache_context(pos: object) -> dict[str, object]:
    context: dict[str, object] = {
        "position_id": str(getattr(pos, "position_id", "")),
        "ticker": str(getattr(pos, "ticker", "")).upper(),
    }
    for attr, key in (
        ("shares", "shares"),
        ("entry_price", "entry_price"),
        ("stop_price", "stop"),
    ):
        numeric = _finite_position_number(getattr(pos, attr, None))
        if numeric is not None:
            context[key] = numeric
    entry_date = getattr(pos, "entry_date", None)
    if isinstance(entry_date, str) and entry_date:
        context["entry_date"] = entry_date
    return context


def _cached_position_context_matches(
    cached: SymbolIntelligence,
    expected: dict[str, object],
) -> bool:
    inputs = cached.inputs_used if isinstance(cached.inputs_used, dict) else {}
    context = inputs.get("position_context")
    if not isinstance(context, dict):
        return False

    def _matches(expected_value: object, cached_value: object) -> bool:
        # Numeric context (shares, entry_price, stop) is rounded when building the
        # expected context but stored raw in inputs_used, so compare on the same
        # rounded scale instead of requiring exact float equality.
        if isinstance(expected_value, (int, float)) and not isinstance(
            expected_value, bool
        ):
            cached_numeric = _finite_position_number(cached_value)
            return cached_numeric is not None and cached_numeric == expected_value
        return cached_value == expected_value

    return all(_matches(value, context.get(key)) for key, value in expected.items())


class SweepSymbol(BaseModel):
    ticker: str
    request: SymbolIntelligenceRequest
    force: bool = False


class SweepRequest(BaseModel):
    symbols: list[SweepSymbol]

    @model_validator(mode="after")
    def validate_symbol_count(self) -> "SweepRequest":
        maximum = get_auth_settings().intelligence_sweep_max_symbols
        if len(self.symbols) > maximum:
            raise ValueError(f"symbols must contain at most {maximum} items")
        return self


class SweepFailure(BaseModel):
    ticker: str
    error: str


class SweepResponse(BaseModel):
    analyzed: list[str]
    failed: list[SweepFailure]


class AnalysisHistoryResponse(BaseModel):
    entries: list[HistoryEntry]


class RunIndexResponse(BaseModel):
    entries: list[RunIndexEntry]


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
    past_positions, _ = positions_repo.list_positions(status="closed")
    analyzed: list[str] = []
    failed: list[SweepFailure] = []
    for item in request.symbols:
        try:
            upper = item.ticker.upper()
            with recording_run(upper) as recorder:
                with step(recorder, "enrich_request") as draft:
                    item_req = enrich_intelligence_request(
                        upper,
                        item.request,
                        fundamentals=fundamentals_service,
                        earnings=lambda t: (lambda ep: (ep.days_until, ep.next_earnings_date))(
                            portfolio_service.get_earnings_proximity(t)
                        ),
                        dividend=_dividend_for,
                        evidence=lambda t: collect_evidence(t),
                    )
                    _set_step_output(
                        draft,
                        close=item_req.close,
                        catalyst_evidence=len(item_req.catalyst_evidence),
                    )
                with step(recorder, "enrich_technicals") as draft:
                    ohlcv_rows = 0
                    skipped_reason = None
                    try:
                        ohlcv = portfolio_service.fetch_recent_ohlcv(upper)
                        item_req = enrich_with_technicals(upper, item_req, ohlcv)
                        ohlcv_rows = int(len(ohlcv)) if ohlcv is not None else 0
                    except Exception as exc:
                        item_req = record_enrichment_failure(item_req, "technicals")
                        skipped_reason = _brief_error(exc)
                        logger.warning(
                            "Sweep technical enrichment skipped for %r", item.ticker, exc_info=True
                        )
                    _set_step_output(
                        draft, ohlcv_rows=ohlcv_rows, skipped_reason=skipped_reason
                    )
                with step(recorder, "enrich_polygon") as draft:
                    item_req = enrich_with_polygon_prices(upper, item_req)
                    _set_step_output(draft, close=item_req.close)
                analyzer = _get_analyzer()
                if not item.force:
                    cached = read_from_cache(
                        upper,
                        expected_fingerprint=analyzer.context_fingerprint(upper, item_req),
                    )
                    if cached is not None:
                        analyzed.append(upper)
                        continue
                analyzer.analyze(upper, item_req, past_positions=past_positions, recorder=recorder)
            analyzed.append(upper)
        except Exception as exc:
            logger.warning("Sweep failed for %s: %s", item.ticker, exc)
            failed.append(SweepFailure(ticker=item.ticker.upper(), error=str(exc)))
    return SweepResponse(analyzed=analyzed, failed=failed)


@router.get("/runs/{run_id}", response_model=RunTrace)
def get_run_trace(run_id: str) -> RunTrace:
    """Return a single persisted agent-run trace, or 404."""
    trace = read_run_trace(run_id)
    if trace is None:
        raise HTTPException(status_code=404, detail=f"No trace for run {run_id!r}")
    return trace


@router.get("/{ticker}/runs", response_model=RunIndexResponse)
def get_ticker_runs(ticker: str) -> RunIndexResponse:
    """Return the per-symbol run-trace index (newest-first, capped). Empty if none."""
    return RunIndexResponse(entries=list_runs_for_ticker(ticker.upper()))


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
    def _earnings(t: str) -> tuple[int | None, str | None]:
        ep = portfolio_service.get_earnings_proximity(t)
        return ep.days_until, ep.next_earnings_date

    try:
        with recording_run(upper) as recorder:
            with step(recorder, "enrich_request") as draft:
                request = enrich_intelligence_request(
                    upper,
                    request,
                    fundamentals=fundamentals_service,
                    earnings=_earnings,
                    dividend=_dividend_for,
                    evidence=lambda t: collect_evidence(t),
                )
                _set_step_output(
                    draft,
                    close=request.close,
                    catalyst_evidence=len(request.catalyst_evidence),
                )
            with step(recorder, "enrich_polygon") as draft:
                request = enrich_with_polygon_prices(upper, request)
                _set_step_output(draft, close=request.close)
            past_positions, _ = positions_repo.list_positions(status="closed")
            analyzer = _get_analyzer()
            if not force:
                cached = read_from_cache(
                    upper,
                    expected_fingerprint=analyzer.context_fingerprint(upper, request),
                )
                if cached is not None:
                    return cached
            return analyzer.analyze(
                upper, request, past_positions=past_positions, recorder=recorder
            )
    except HTTPException:
        raise
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
    position_context = _position_cache_context(pos)
    stop = portfolio_service.suggest_position_stop(position_id)
    request = SymbolIntelligenceRequest(
        close=float(pos.current_price if pos.current_price is not None else pos.entry_price),
        signal=stop.action,
        position_id=position_id,
        shares=int(pos.shares),
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

    try:
        with recording_run(pos.ticker.upper()) as recorder:
            with step(recorder, "enrich_request") as draft:
                request = enrich_intelligence_request(
                    pos.ticker,
                    request,
                    fundamentals=fundamentals_service,
                    earnings=_earnings,
                    dividend=_dividend_for,
                    evidence=lambda t: collect_evidence(t),
                )
                _set_step_output(
                    draft,
                    close=request.close,
                    catalyst_evidence=len(request.catalyst_evidence),
                )
            with step(recorder, "enrich_technicals") as draft:
                ohlcv_rows = 0
                skipped_reason = None
                try:
                    ohlcv = portfolio_service.fetch_recent_ohlcv(pos.ticker)
                    request = enrich_with_technicals(pos.ticker, request, ohlcv)
                    ohlcv_rows = int(len(ohlcv)) if ohlcv is not None else 0
                except Exception as exc:
                    request = record_enrichment_failure(request, "technicals")
                    skipped_reason = _brief_error(exc)
                    logger.warning("Technical enrichment skipped for %r", pos.ticker, exc_info=True)
                _set_step_output(
                    draft, ohlcv_rows=ohlcv_rows, skipped_reason=skipped_reason
                )
            with step(recorder, "enrich_polygon") as draft:
                request = enrich_with_polygon_prices(pos.ticker, request)
                _set_step_output(draft, close=request.close)
            # Re-pin close to the live position price after Polygon enrichment.
            # Polygon OHLCV only carries completed-session closes, so during an open
            # session it returns yesterday's close — contradicting r_now computed from
            # today's intraday price and causing the LLM to misread position direction.
            if pos.current_price is not None:
                request = request.model_copy(update={"close": float(pos.current_price)})
            analyzer = _get_analyzer()
            if not force:
                cached = read_from_cache(
                    pos.ticker.upper(),
                    expected_fingerprint=analyzer.context_fingerprint(pos.ticker, request),
                )
                if cached is not None and _cached_position_context_matches(cached, position_context):
                    return cached
            return analyzer.analyze(pos.ticker.upper(), request, recorder=recorder)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
