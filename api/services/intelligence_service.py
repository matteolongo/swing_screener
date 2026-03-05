"""Market intelligence service."""
from __future__ import annotations

from collections import Counter
from dataclasses import replace
from datetime import datetime
import json
import logging
import os
from typing import Any

from fastapi import HTTPException

from api.models.intelligence import (
    IntelligenceExplainSymbolRequest,
    IntelligenceExplainSymbolResponse,
    IntelligenceOpportunityResponse,
    IntelligenceOpportunitiesResponse,
    IntelligenceRunLaunchResponse,
    IntelligenceRunRequest,
    IntelligenceRunStatusResponse,
)
from api.services.intelligence_config_service import IntelligenceConfigService
from api.repositories.strategy_repo import StrategyRepository
from api.services.intelligence_warmup import get_intelligence_run_manager
from swing_screener.intelligence.config import build_intelligence_config
from swing_screener.intelligence.storage import IntelligenceStorage

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat()


def _sanitize_text(value: str, *, max_len: int = 480) -> str:
    cleaned = " ".join(str(value or "").split()).strip()
    if len(cleaned) <= max_len:
        return cleaned
    return f"{cleaned[: max_len - 1]}…"


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _build_deterministic_explanation(symbol: str, context: dict[str, Any]) -> str:
    symbol_text = str(symbol).strip().upper() or "This symbol"
    candidate = context.get("candidate") or {}
    latest_signal = context.get("latest_signal") or {}
    top_events = list(context.get("top_event_types", []) or [])

    parts: list[str] = [
        (
            f"{symbol_text} is evaluated using three blocks: technical setup quality, catalyst evidence, "
            "and risk structure."
        )
    ]

    opp_score = _safe_float(context.get("opportunity_score"))
    technical = _safe_float(context.get("technical_readiness"))
    catalyst = _safe_float(context.get("catalyst_strength"))
    state = str(context.get("state") or "").strip().upper()
    if opp_score is not None and technical is not None and catalyst is not None:
        parts.append(
            f"Current opportunity score is {opp_score:.2f}, built from technical {technical:.2f} "
            f"and catalyst {catalyst:.2f}."
        )
    elif technical is not None or catalyst is not None:
        parts.append(
            f"The model currently sees technical strength {technical or 0.0:.2f} and catalyst strength "
            f"{catalyst or 0.0:.2f}."
        )

    if state:
        parts.append(f"Lifecycle state is {state}, which describes how active the setup is right now.")

    signal_z = _safe_float(latest_signal.get("return_z"))
    signal_atr = _safe_float(latest_signal.get("atr_shock"))
    signal_false = bool(latest_signal.get("is_false_catalyst", False))
    if signal_z is not None and signal_atr is not None:
        if signal_false:
            parts.append(
                f"The latest catalyst reaction was weak for confirmation (return z-score {signal_z:.2f}, "
                f"ATR shock {signal_atr:.2f}), so it is treated as low-conviction."
            )
        else:
            parts.append(
                f"The latest catalyst reaction shows return z-score {signal_z:.2f} and ATR shock {signal_atr:.2f}, "
                "which supports a stronger catalyst read."
            )

    if top_events:
        summary = ", ".join(
            f"{str(item.get('type', 'other')).upper()} x{int(item.get('count', 0))}"
            for item in top_events[:3]
        )
        parts.append(f"Recent catalyst mix for this symbol is: {summary}.")

    rr = _safe_float(candidate.get("rr"))
    entry = _safe_float(candidate.get("entry"))
    stop = _safe_float(candidate.get("stop"))
    confidence = _safe_float(candidate.get("confidence"))
    if entry is not None and stop is not None and rr is not None:
        parts.append(
            f"Risk plan uses entry {entry:.2f}, stop {stop:.2f}, and reward/risk {rr:.2f}:1."
        )
    if confidence is not None:
        parts.append(
            f"Signal confidence is {confidence:.1f}; this helps rank conviction, not guarantee outcome."
        )

    return _sanitize_text(" ".join(parts), max_len=520)


def _invoke_llm_explanation(
    *,
    cfg,
    context: dict[str, Any],
    fallback_text: str,
) -> tuple[str, str, str | None, str | None]:
    llm_cfg = getattr(cfg, "llm", None)
    if llm_cfg is None or not bool(getattr(llm_cfg, "enabled", False)):
        return fallback_text, "deterministic_fallback", None, "LLM disabled in intelligence configuration."

    provider = str(getattr(llm_cfg, "provider", "")).strip().lower()
    model = str(getattr(llm_cfg, "model", "")).strip() or None
    if provider in {"", "mock"}:
        return fallback_text, "deterministic_fallback", model, "LLM provider is mock; deterministic fallback used."

    base_url = str(getattr(llm_cfg, "base_url", "")).strip() or None
    api_key = str(getattr(llm_cfg, "api_key", "")).strip() or str(os.environ.get("OPENAI_API_KEY", "")).strip()

    try:
        from langchain_core.messages import HumanMessage, SystemMessage
    except Exception as exc:  # pragma: no cover - import depends on runtime
        logger.warning("langchain-core unavailable for beginner explanation: %s", exc)
        return fallback_text, "deterministic_fallback", model, f"langchain-core unavailable: {exc}"

    try:
        if provider == "openai":
            from langchain_openai import ChatOpenAI

            if not api_key:
                raise RuntimeError("OPENAI_API_KEY missing for beginner explanation.")
            llm = ChatOpenAI(
                model=model or "gpt-4o-mini",
                temperature=0,
                base_url=base_url or "https://api.openai.com/v1",
                api_key=api_key,
                max_retries=0,
            )
        elif provider == "ollama":
            from langchain_ollama import ChatOllama

            llm = ChatOllama(
                model=model or "mistral:7b-instruct",
                temperature=0,
                base_url=base_url or "http://localhost:11434",
            )
        else:
            raise RuntimeError(f"Unsupported LLM provider for explanation: {provider}")

        system_prompt = (
            "You explain trading diagnostics to beginners. "
            "Use only provided facts. No predictions, no speculation, no advice certainty. "
            "Write 3-5 short sentences, plain English, and stay factual."
        )
        user_prompt = json.dumps(context, separators=(",", ":"), ensure_ascii=True)
        response = llm.invoke(
            [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ]
        )
        text = _sanitize_text(str(getattr(response, "content", "")).strip(), max_len=520)
        if not text:
            raise RuntimeError("LLM returned empty explanation.")
        speculative_markers = (" could ", " might ", " likely ", " expected ", " should ")
        text_norm = f" {text.lower()} "
        if any(marker in text_norm for marker in speculative_markers):
            raise RuntimeError("LLM explanation used speculative language.")
        return text, "llm", model, None
    except Exception as exc:  # pragma: no cover - defensive fallback
        logger.warning("Beginner explanation LLM call failed, using fallback: %s", exc)
        return fallback_text, "deterministic_fallback", model, _sanitize_text(str(exc), max_len=240)


class IntelligenceService:
    def __init__(
        self,
        *,
        strategy_repo: StrategyRepository,
        config_service: IntelligenceConfigService,
    ) -> None:
        self._strategy_repo = strategy_repo
        self._config_service = config_service
        self._storage = IntelligenceStorage()

    def start_run(self, request: IntelligenceRunRequest) -> IntelligenceRunLaunchResponse:
        config_payload = self._config_service.get_config().model_dump()
        cfg = build_intelligence_config({"market_intelligence": config_payload})

        if request.providers:
            cfg = replace(cfg, providers=tuple(str(provider).strip().lower() for provider in request.providers if str(provider).strip()))
        if request.lookback_hours is not None:
            cfg = replace(cfg, catalyst=replace(cfg.catalyst, lookback_hours=request.lookback_hours))
        if request.max_opportunities is not None:
            cfg = replace(
                cfg,
                opportunity=replace(cfg.opportunity, max_daily_opportunities=request.max_opportunities),
            )

        technical = None
        if request.technical_readiness:
            technical = {
                str(symbol).strip().upper(): float(value)
                for symbol, value in request.technical_readiness.items()
                if str(symbol).strip()
            }
        symbols = self._config_service.resolve_symbol_scope(
            symbols=request.symbols,
            symbol_set_id=request.symbol_set_id,
        )

        job_id = get_intelligence_run_manager().start_job(
            symbols=symbols,
            cfg=cfg,
            technical_readiness=technical,
        )
        if job_id is None:
            raise HTTPException(status_code=400, detail="No valid symbols provided for intelligence run.")

        job = get_intelligence_run_manager().get_job(job_id)
        if job is None:
            raise HTTPException(status_code=500, detail="Failed to start intelligence run.")
        return IntelligenceRunLaunchResponse(
            job_id=job.job_id,
            status=job.status,  # type: ignore[arg-type]
            total_symbols=job.total_symbols,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )

    def get_run_status(self, job_id: str) -> IntelligenceRunStatusResponse:
        job = get_intelligence_run_manager().get_job(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail=f"Intelligence run job not found: {job_id}")
        return IntelligenceRunStatusResponse(
            job_id=job.job_id,
            status=job.status,  # type: ignore[arg-type]
            total_symbols=job.total_symbols,
            completed_symbols=job.completed_symbols,
            asof_date=job.asof_date,
            opportunities_count=job.opportunities_count,
            llm_warnings_count=getattr(job, "llm_warnings_count", 0),
            llm_warning_sample=getattr(job, "llm_warning_sample", None),
            events_kept_count=getattr(job, "events_kept_count", 0),
            events_dropped_count=getattr(job, "events_dropped_count", 0),
            duplicate_suppressed_count=getattr(job, "duplicate_suppressed_count", 0),
            analysis_summary=getattr(job, "analysis_summary", None),
            error=job.error,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )

    def get_opportunities(
        self,
        asof_date: str | None = None,
        symbols: list[str] | None = None,
    ) -> IntelligenceOpportunitiesResponse:
        target_date = asof_date or self._storage.latest_opportunities_date()
        if target_date is None:
            raise HTTPException(status_code=404, detail="No intelligence opportunities available.")
        opportunities = self._storage.load_opportunities(target_date)
        if symbols:
            symbol_set = {str(symbol).strip().upper() for symbol in symbols if str(symbol).strip()}
            opportunities = [opportunity for opportunity in opportunities if opportunity.symbol in symbol_set]
        payload = [
            IntelligenceOpportunityResponse(
                symbol=opportunity.symbol,
                technical_readiness=opportunity.technical_readiness,
                catalyst_strength=opportunity.catalyst_strength,
                opportunity_score=opportunity.opportunity_score,
                state=opportunity.state,
                explanations=opportunity.explanations,
            )
            for opportunity in opportunities
        ]
        return IntelligenceOpportunitiesResponse(asof_date=target_date, opportunities=payload)

    def explain_symbol(
        self,
        request: IntelligenceExplainSymbolRequest,
    ) -> IntelligenceExplainSymbolResponse:
        symbol = str(request.symbol).strip().upper()
        asof_date = request.asof_date or self._storage.latest_opportunities_date()
        if not asof_date:
            asof_date = datetime.utcnow().date().isoformat()

        opportunities = self._storage.load_opportunities(asof_date)
        opportunity = next((item for item in opportunities if item.symbol == symbol), None)

        events = self._storage.load_events(asof_date=asof_date, symbols=[symbol], limit=20)
        signals = self._storage.load_signals(asof_date=asof_date, symbols=[symbol])
        states = self._storage.load_symbol_state()
        state = states.get(symbol)

        top_event_types = Counter(
            str(event.metadata.get("llm_event_type") or event.event_type or "other").strip().lower()
            for event in events
        )
        latest_signal = signals[0] if signals else None
        candidate = request.candidate_context.model_dump() if request.candidate_context else {}
        if (
            opportunity is None
            and latest_signal is None
            and not events
            and not candidate
        ):
            raise HTTPException(
                status_code=404,
                detail=f"No context available to explain symbol: {symbol}",
            )

        context_payload: dict[str, Any] = {
            "symbol": symbol,
            "asof_date": asof_date,
            "state": state.state if state is not None else "QUIET",
            "opportunity_score": getattr(opportunity, "opportunity_score", None),
            "technical_readiness": getattr(opportunity, "technical_readiness", None),
            "catalyst_strength": getattr(opportunity, "catalyst_strength", None),
            "top_event_types": [
                {"type": event_type, "count": int(count)}
                for event_type, count in top_event_types.most_common(3)
            ],
            "latest_signal": (
                {
                    "return_z": latest_signal.return_z,
                    "atr_shock": latest_signal.atr_shock,
                    "peer_confirmation_count": latest_signal.peer_confirmation_count,
                    "is_false_catalyst": latest_signal.is_false_catalyst,
                    "reasons": latest_signal.reasons,
                }
                if latest_signal is not None
                else {}
            ),
            "candidate": candidate,
        }

        deterministic = _build_deterministic_explanation(symbol, context_payload)
        config_payload = self._config_service.get_config().model_dump()
        cfg = build_intelligence_config({"market_intelligence": config_payload})
        explanation, source, model, warning = _invoke_llm_explanation(
            cfg=cfg,
            context=context_payload,
            fallback_text=deterministic,
        )
        return IntelligenceExplainSymbolResponse(
            symbol=symbol,
            asof_date=asof_date,
            explanation=explanation,
            source=source,  # type: ignore[arg-type]
            model=model,
            warning=warning,
            generated_at=_now_iso(),
        )
