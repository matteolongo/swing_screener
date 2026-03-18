"""Market intelligence service."""
from __future__ import annotations

from collections import Counter
from dataclasses import replace
from datetime import datetime, timedelta
import json
import logging
from typing import Any

from fastapi import HTTPException

from api.models.intelligence import (
    EducationViewName,
    IntelligenceEducationError,
    IntelligenceEducationGenerateRequest,
    IntelligenceEducationGenerateResponse,
    IntelligenceEducationViewOutput,
    IntelligenceEventResponse,
    IntelligenceEventsResponse,
    IntelligenceOpportunityResponse,
    IntelligenceOpportunitiesResponse,
    IntelligenceMetricsResponse,
    IntelligenceRunLaunchResponse,
    IntelligenceRunRequest,
    IntelligenceRunStatusResponse,
    IntelligenceSourceHealthResponse,
    IntelligenceSourcesHealthResponse,
    IntelligenceUpcomingCatalystResponse,
    IntelligenceUpcomingCatalystsResponse,
)
from api.services.intelligence_config_service import IntelligenceConfigService
from api.repositories.strategy_repo import StrategyRepository
from api.services.intelligence_warmup import get_intelligence_run_manager
from swing_screener.intelligence.config import build_intelligence_config
from swing_screener.intelligence.llm.factory import build_langchain_chat_model
from swing_screener.intelligence.storage import IntelligenceStorage

logger = logging.getLogger(__name__)

_EDUCATION_VIEWS: tuple[EducationViewName, ...] = ("recommendation", "thesis", "learn")
_SPECULATIVE_MARKERS = (" could ", " might ", " likely ", " expected ", " probably ", " should ")


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


def _coerce_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None


def _clean_list(values: list[Any] | tuple[Any, ...] | None, *, max_items: int = 5, max_len: int = 180) -> list[str]:
    out: list[str] = []
    for value in values or []:
        text = _sanitize_text(str(value), max_len=max_len)
        if not text:
            continue
        if text in out:
            continue
        out.append(text)
        if len(out) >= max_items:
            break
    return out


def _contains_speculative_language(text: str) -> bool:
    normalized = f" {str(text).lower()} "
    return any(marker in normalized for marker in _SPECULATIVE_MARKERS)


def _extract_json_payload(raw: str) -> dict[str, Any]:
    text = str(raw or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        text = text[start : end + 1]

    payload = json.loads(text)
    if not isinstance(payload, dict):
        raise ValueError("LLM output must be a JSON object")
    return payload


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
    try:
        from langchain_core.messages import HumanMessage, SystemMessage
    except Exception as exc:  # pragma: no cover - import depends on runtime
        logger.warning("langchain-core unavailable for beginner explanation: %s", exc)
        return fallback_text, "deterministic_fallback", model, f"langchain-core unavailable: {exc}"

    try:
        llm = build_langchain_chat_model(
            provider_name=provider,
            model=model or ("gpt-4.1-mini" if provider == "openai" else "mistral:7b-instruct"),
            base_url=base_url,
            api_key=None,
            temperature=0,
            max_retries=0,
        )

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
        if _contains_speculative_language(text):
            raise RuntimeError("LLM explanation used speculative language.")
        return text, "llm", model, None
    except Exception as exc:  # pragma: no cover - defensive fallback
        logger.warning("Beginner explanation LLM call failed, using fallback: %s", exc)
        return fallback_text, "deterministic_fallback", model, _sanitize_text(str(exc), max_len=240)


def _llm_enabled(cfg) -> bool:
    llm_cfg = getattr(cfg, "llm", None)
    if llm_cfg is None:
        return False
    if not bool(getattr(llm_cfg, "enabled", False)):
        return False
    provider = str(getattr(llm_cfg, "provider", "")).strip().lower()
    return provider not in {"", "mock"}


def _build_fact_map(context: dict[str, Any]) -> dict[str, str]:
    candidate = context.get("candidate") or {}
    latest_signal = context.get("latest_signal") or {}
    top_event_types = context.get("top_event_types") or []

    facts: dict[str, str] = {
        "state": str(context.get("state") or "QUIET").upper(),
    }

    opportunity_score = _safe_float(context.get("opportunity_score"))
    technical = _safe_float(context.get("technical_readiness"))
    catalyst = _safe_float(context.get("catalyst_strength"))
    if opportunity_score is not None:
        facts["opportunity_score"] = f"{opportunity_score:.2f}"
    if technical is not None:
        facts["technical_readiness"] = f"{technical:.2f}"
    if catalyst is not None:
        facts["catalyst_strength"] = f"{catalyst:.2f}"

    entry = _safe_float(candidate.get("entry"))
    stop = _safe_float(candidate.get("stop"))
    target = _safe_float(candidate.get("target"))
    rr = _safe_float(candidate.get("rr"))
    confidence = _safe_float(candidate.get("confidence"))
    signal = str(candidate.get("signal") or "").strip().lower()
    if signal:
        facts["signal"] = signal
    if entry is not None:
        facts["entry"] = f"{entry:.2f}"
    if stop is not None:
        facts["stop"] = f"{stop:.2f}"
    if target is not None:
        facts["target"] = f"{target:.2f}"
    if rr is not None:
        facts["rr"] = f"{rr:.2f}"
    if confidence is not None:
        facts["confidence"] = f"{confidence:.1f}"

    return_z = _safe_float(latest_signal.get("return_z"))
    atr_shock = _safe_float(latest_signal.get("atr_shock"))
    peer_count = latest_signal.get("peer_confirmation_count")
    if return_z is not None:
        facts["return_z"] = f"{return_z:.2f}"
    if atr_shock is not None:
        facts["atr_shock"] = f"{atr_shock:.2f}"
    if isinstance(peer_count, (int, float)):
        facts["peer_confirmation_count"] = str(int(peer_count))

    if top_event_types:
        facts["top_event_types"] = ", ".join(
            f"{str(item.get('type', 'other')).upper()} x{int(item.get('count', 0))}"
            for item in top_event_types[:3]
        )

    return facts


def _fallback_recommendation_view(
    *,
    symbol: str,
    facts: dict[str, str],
    generated_at: str,
    template_version: str,
) -> IntelligenceEducationViewOutput:
    rr = facts.get("rr")
    entry = facts.get("entry")
    stop = facts.get("stop")
    state = facts.get("state", "QUIET")

    bullets = [
        f"{symbol} is currently in state {state}, which means setup activity is explicitly tracked.",
    ]
    if rr:
        bullets.append(f"Risk/Reward is {rr}:1, so potential reward is defined before entry.")
    if entry and stop:
        bullets.append(f"Risk is bounded by entry {entry} and stop {stop}.")

    watchouts = [
        "Only execute if the setup remains valid at entry time.",
        "If price breaks your stop level, the trade thesis is invalidated.",
    ]

    next_steps = [
        "Confirm entry, stop, and position size before placing any order.",
        "Skip the trade if at least one checklist gate turns red.",
    ]

    facts_used = [key for key in ["state", "rr", "entry", "stop"] if key in facts]
    return IntelligenceEducationViewOutput(
        title=f"Beginner view for {symbol}",
        summary=(
            "This setup passed deterministic checks for structure and risk planning. "
            "Focus on rule execution, not prediction."
        ),
        bullets=_clean_list(bullets, max_items=5),
        watchouts=_clean_list(watchouts, max_items=5),
        next_steps=_clean_list(next_steps, max_items=5),
        glossary_links=["rr", "stop", "position_size"],
        facts_used=facts_used,
        source="deterministic_fallback",
        template_version=template_version,
        generated_at=generated_at,
    )


def _fallback_thesis_view(
    *,
    symbol: str,
    context: dict[str, Any],
    facts: dict[str, str],
    generated_at: str,
    template_version: str,
) -> IntelligenceEducationViewOutput:
    plain_english = _build_deterministic_explanation(symbol, context)
    checklist = [
        "Trend and signal are still active.",
        "Stop remains valid and affordable for account risk.",
        "There is no veto signal in your risk process.",
    ]
    watchouts = [
        "Do not widen the stop to force the trade to survive.",
        "Avoid entries with weak catalyst confirmation.",
    ]

    return IntelligenceEducationViewOutput(
        title=f"Why this trade idea exists ({symbol})",
        summary=plain_english,
        bullets=_clean_list(checklist, max_items=5),
        watchouts=_clean_list(watchouts, max_items=5),
        next_steps=_clean_list(["Place the trade only if all rules remain true at execution."]),
        glossary_links=["trade_thesis", "invalidation", "risk_reward"],
        facts_used=_clean_list(list(facts.keys()), max_items=6, max_len=32),
        source="deterministic_fallback",
        template_version=template_version,
        generated_at=generated_at,
    )


def _fallback_learn_view(
    *,
    symbol: str,
    facts: dict[str, str],
    generated_at: str,
    template_version: str,
) -> IntelligenceEducationViewOutput:
    concepts: list[str] = []
    glossary: list[str] = []

    if "rr" in facts:
        concepts.append("Risk/Reward sets payoff expectations before you enter.")
        glossary.append("rr")
    if "stop" in facts:
        concepts.append("A stop loss defines the price where the trade thesis is wrong.")
        glossary.append("stop")
    if "confidence" in facts:
        concepts.append("Confidence ranks setup quality, but does not predict certainty.")
        glossary.append("confidence")
    if "top_event_types" in facts:
        concepts.append("Catalyst events can improve timing, but still require technical confirmation.")
        glossary.append("catalyst")

    if not concepts:
        concepts.append("Always define entry, stop, and position size before taking a trade.")
        glossary.extend(["entry", "stop", "position_size"])

    return IntelligenceEducationViewOutput(
        title=f"Learn from {symbol}",
        summary="These concepts are selected from this symbol's deterministic setup context.",
        bullets=_clean_list(concepts, max_items=4),
        watchouts=_clean_list(["If you cannot explain your exit plan, do not enter."]),
        next_steps=_clean_list(["Review one concept, then verify it in the current setup."]),
        glossary_links=_clean_list(glossary, max_items=4, max_len=32),
        facts_used=_clean_list(list(facts.keys()), max_items=5, max_len=32),
        source="deterministic_fallback",
        template_version=template_version,
        generated_at=generated_at,
    )


def _render_education_user_prompt(
    *,
    symbol: str,
    view: EducationViewName,
    payload: dict[str, Any],
    template: str,
) -> str:
    default_template = (
        "Return strict JSON only.\n"
        "Symbol: {{symbol}}\n"
        "View: {{view}}\n"
        "Payload:\n{{payload_json}}"
    )
    resolved_template = template.replace("\r\n", "\n").strip() or default_template
    replacements = {
        "{{symbol}}": symbol,
        "{{view}}": view,
        "{{payload_json}}": json.dumps(payload, ensure_ascii=True, separators=(",", ":")),
        "{{constraints_json}}": json.dumps(payload.get("constraints", {}), ensure_ascii=True, separators=(",", ":")),
        "{{schema_json}}": json.dumps(payload.get("schema", {}), ensure_ascii=True, separators=(",", ":")),
        "{{facts_json}}": json.dumps(payload.get("facts", {}), ensure_ascii=True, separators=(",", ":")),
        "{{context_json}}": json.dumps(payload.get("context", {}), ensure_ascii=True, separators=(",", ":")),
    }
    rendered = resolved_template
    for placeholder, value in replacements.items():
        rendered = rendered.replace(placeholder, value)
    return rendered


def _invoke_llm_education_view(
    *,
    cfg,
    view: EducationViewName,
    symbol: str,
    context: dict[str, Any],
    facts: dict[str, str],
    fallback: IntelligenceEducationViewOutput,
) -> tuple[IntelligenceEducationViewOutput, str | None, str | None]:
    llm_cfg = getattr(cfg, "llm", None)
    if llm_cfg is None or not _llm_enabled(cfg):
        return fallback, "LLM disabled or unavailable; deterministic fallback used.", None

    provider = str(getattr(llm_cfg, "provider", "")).strip().lower()
    model = str(getattr(llm_cfg, "model", "")).strip() or ""
    base_url = str(getattr(llm_cfg, "base_url", "")).strip() or None
    system_prompt_default = (
        "You are a beginner-first trading educator. "
        "Use only provided deterministic facts. "
        "No speculation, no predictions, no certainty claims. "
        "Return strict JSON only."
    )
    system_prompt = (
        str(getattr(llm_cfg, f"education_{view}_system_prompt", "")).strip() or system_prompt_default
    )

    user_payload = {
        "symbol": symbol,
        "view": view,
        "constraints": {
            "beginner_friendly": True,
            "max_bullets": 5,
            "max_watchouts": 5,
            "max_next_steps": 5,
            "max_glossary": 4,
            "must_be_fact_grounded": True,
            "forbid_predictions": True,
        },
        "schema": {
            "title": "string",
            "summary": "string",
            "bullets": ["string"],
            "watchouts": ["string"],
            "next_steps": ["string"],
            "glossary_links": ["string"],
            "facts_used": ["string"],
        },
        "facts": facts,
        "context": context,
    }
    user_prompt_template = str(getattr(llm_cfg, f"education_{view}_user_prompt_template", "")).strip()
    user_prompt = _render_education_user_prompt(
        symbol=symbol,
        view=view,
        payload=user_payload,
        template=user_prompt_template,
    )

    try:
        from langchain_core.messages import HumanMessage, SystemMessage
    except Exception as exc:  # pragma: no cover
        return fallback, f"langchain-core unavailable: {exc}", None

    try:
        llm = build_langchain_chat_model(
            provider_name=provider,
            model=model or ("gpt-4.1-mini" if provider == "openai" else "mistral:7b-instruct"),
            base_url=base_url,
            api_key=None,
            temperature=0,
            max_retries=0,
        )

        response = llm.invoke(
            [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ]
        )

        parsed = _extract_json_payload(str(getattr(response, "content", "")))
        title = _sanitize_text(str(parsed.get("title", "")), max_len=120)
        summary = _sanitize_text(str(parsed.get("summary", "")), max_len=420)
        bullets = _clean_list(parsed.get("bullets") if isinstance(parsed.get("bullets"), list) else [], max_items=5)
        watchouts = _clean_list(parsed.get("watchouts") if isinstance(parsed.get("watchouts"), list) else [], max_items=5)
        next_steps = _clean_list(parsed.get("next_steps") if isinstance(parsed.get("next_steps"), list) else [], max_items=5)
        glossary_links = _clean_list(parsed.get("glossary_links") if isinstance(parsed.get("glossary_links"), list) else [], max_items=4, max_len=32)
        facts_used = _clean_list(parsed.get("facts_used") if isinstance(parsed.get("facts_used"), list) else [], max_items=16, max_len=32)
        warning_messages: list[str] = []

        if not title or not summary:
            raise RuntimeError("LLM output missing title/summary.")
        if not facts_used:
            raise RuntimeError("LLM output missing facts_used references.")
        unknown_facts = [key for key in facts_used if key not in facts]
        if unknown_facts:
            valid_facts = [key for key in facts_used if key in facts]
            facts_used = valid_facts or fallback.facts_used
            warning_messages.append(
                f"LLM referenced unknown facts: {', '.join(unknown_facts[:3])}. "
                "Output kept and flagged for review."
            )

        all_text = " ".join([title, summary, *bullets, *watchouts, *next_steps])
        if _contains_speculative_language(all_text):
            warning_messages.append("LLM output contained speculative wording. Output kept and flagged for review.")

        return (
            IntelligenceEducationViewOutput(
                title=title,
                summary=summary,
                bullets=bullets,
                watchouts=watchouts,
                next_steps=next_steps,
                glossary_links=glossary_links,
                facts_used=facts_used,
                source="llm",
                template_version=fallback.template_version,
                generated_at=fallback.generated_at,
                debug_ref=f"{symbol}:{view}:{fallback.generated_at}",
            ),
            None,
            " ".join(warning_messages) if warning_messages else None,
        )
    except Exception as exc:  # pragma: no cover
        logger.warning("Educational generation failed for %s/%s: %s", symbol, view, exc)
        return fallback, _sanitize_text(str(exc), max_len=280), None


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

    def _resolve_asof_date(self, requested: str | None) -> str:
        if requested:
            return requested
        latest_education = self._storage.latest_education_date()
        if latest_education:
            return latest_education
        latest_opportunity = self._storage.latest_opportunities_date()
        if latest_opportunity:
            return latest_opportunity
        return datetime.utcnow().date().isoformat()

    def _build_symbol_context(
        self,
        *,
        symbol: str,
        asof_date: str,
        candidate_context,
    ) -> dict[str, Any]:
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
        candidate = candidate_context.model_dump() if candidate_context else {}

        if opportunity is None and latest_signal is None and not events and not candidate:
            raise HTTPException(
                status_code=404,
                detail=f"No context available to explain symbol: {symbol}",
            )

        return {
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

    def _education_template_version(self) -> str:
        config_payload = self._config_service.get_config().model_dump()
        cfg = build_intelligence_config({"market_intelligence": config_payload})
        llm_cfg = getattr(cfg, "llm", None)
        if llm_cfg is None:
            return "v1"
        return str(getattr(llm_cfg, "education_template_version", "v1") or "v1").strip() or "v1"

    def _build_education(
        self,
        *,
        symbol: str,
        asof_date: str,
        views: list[EducationViewName],
        candidate_context,
    ) -> IntelligenceEducationGenerateResponse:
        generated_at = _now_iso()
        context_payload = self._build_symbol_context(
            symbol=symbol,
            asof_date=asof_date,
            candidate_context=candidate_context,
        )
        facts = _build_fact_map(context_payload)
        template_version = self._education_template_version()

        config_payload = self._config_service.get_config().model_dump()
        cfg = build_intelligence_config({"market_intelligence": config_payload})

        fallbacks: dict[EducationViewName, IntelligenceEducationViewOutput] = {
            "recommendation": _fallback_recommendation_view(
                symbol=symbol,
                facts=facts,
                generated_at=generated_at,
                template_version=template_version,
            ),
            "thesis": _fallback_thesis_view(
                symbol=symbol,
                context=context_payload,
                facts=facts,
                generated_at=generated_at,
                template_version=template_version,
            ),
            "learn": _fallback_learn_view(
                symbol=symbol,
                facts=facts,
                generated_at=generated_at,
                template_version=template_version,
            ),
        }

        outputs: dict[EducationViewName, IntelligenceEducationViewOutput] = {}
        errors: list[IntelligenceEducationError] = []

        for view in views:
            fallback = fallbacks[view]
            generated = fallback
            error_message: str | None = None
            warning_message: str | None = None
            if _llm_enabled(cfg):
                generated, error_message, warning_message = _invoke_llm_education_view(
                    cfg=cfg,
                    view=view,
                    symbol=symbol,
                    context=context_payload,
                    facts=facts,
                    fallback=fallback,
                )
            else:
                error_message = "LLM disabled or unavailable; deterministic fallback used."

            outputs[view] = generated
            if warning_message:
                errors.append(
                    IntelligenceEducationError(
                        view=view,
                        code="llm_validation_warning",
                        message=warning_message,
                        retryable=False,
                    )
                )
            if error_message and generated.source != "llm":
                errors.append(
                    IntelligenceEducationError(
                        view=view,
                        code="llm_generation_failed",
                        message=error_message,
                        retryable=True,
                    )
                )

        llm_count = sum(1 for output in outputs.values() if output.source == "llm")
        fallback_count = len(outputs) - llm_count

        if llm_count == len(outputs):
            status = "ok"
            source = "llm"
        elif fallback_count == len(outputs):
            status = "ok"
            source = "deterministic_fallback"
        else:
            status = "partial"
            source = "llm"

        return IntelligenceEducationGenerateResponse(
            symbol=symbol,
            asof_date=asof_date,
            generated_at=generated_at,
            outputs=outputs,
            status=status,
            source=source,  # type: ignore[arg-type]
            template_version=template_version,
            deterministic_facts=facts,
            errors=errors,
        )

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
                score_breakdown_v2=getattr(opportunity, "score_breakdown_v2", {}) or {},
                top_catalysts=getattr(opportunity, "top_catalysts", []) or [],
                evidence_quality_flag=(
                    getattr(opportunity, "evidence_quality_flag", "medium")
                    if getattr(opportunity, "evidence_quality_flag", "medium") in {"high", "medium", "low"}
                    else "medium"
                ),
            )
            for opportunity in opportunities
        ]
        return IntelligenceOpportunitiesResponse(asof_date=target_date, opportunities=payload)

    def get_events(
        self,
        *,
        asof_date: str | None = None,
        symbols: list[str] | None = None,
        event_types: list[str] | None = None,
        min_materiality: float | None = None,
    ) -> IntelligenceEventsResponse:
        target_date = asof_date or self._storage.latest_normalized_events_date() or self._storage.latest_opportunities_date()
        if target_date is None:
            raise HTTPException(status_code=404, detail="No intelligence events available.")
        normalized = self._storage.load_normalized_events(
            target_date,
            symbols=symbols,
            event_types=event_types,
            min_materiality=min_materiality,
        )
        payload = [
            IntelligenceEventResponse(
                event_id=event.event_id,
                symbol=event.symbol,
                event_type=event.event_type,
                event_subtype=event.event_subtype,
                timing_type=event.timing_type,
                materiality=event.materiality,
                confidence=event.confidence,
                primary_source_reliability=event.primary_source_reliability,
                confirmation_count=event.confirmation_count,
                published_at=event.published_at,
                event_at=event.event_at,
                source_name=event.source_name,
                raw_url=event.raw_url,
                llm_fields=event.llm_fields,
                dynamic_source_quality=getattr(event, "dynamic_source_quality", None),
                resolution_source=getattr(event, "resolution_source", None),
                dedupe_method=getattr(event, "dedupe_method", None),
            )
            for event in normalized
        ]
        return IntelligenceEventsResponse(asof_date=target_date, events=payload)

    def get_upcoming_catalysts(
        self,
        *,
        asof_date: str | None = None,
        symbols: list[str] | None = None,
        days_ahead: int = 14,
    ) -> IntelligenceUpcomingCatalystsResponse:
        target_date = asof_date or self._storage.latest_normalized_events_date() or self._storage.latest_opportunities_date()
        if target_date is None:
            raise HTTPException(status_code=404, detail="No upcoming catalysts available.")
        normalized = self._storage.load_normalized_events(target_date, symbols=symbols)
        now = _coerce_datetime(f"{target_date}T00:00:00") or datetime.utcnow()
        upper = now + timedelta(days=max(1, int(days_ahead)))
        items: list[IntelligenceUpcomingCatalystResponse] = []
        for event in normalized:
            if event.timing_type != "scheduled":
                continue
            event_dt = _coerce_datetime(event.event_at) or _coerce_datetime(event.published_at)
            if event_dt is None:
                continue
            if not (now <= event_dt <= upper):
                continue
            items.append(
                IntelligenceUpcomingCatalystResponse(
                    symbol=event.symbol,
                    event_type=event.event_type,
                    event_subtype=event.event_subtype,
                    event_at=event.event_at or event.published_at,
                    published_at=event.published_at,
                    materiality=event.materiality,
                    confidence=event.confidence,
                    source_name=event.source_name,
                    confirmation_count=event.confirmation_count,
                    raw_url=event.raw_url,
                )
            )
        items.sort(key=lambda item: (item.event_at, -item.materiality, -item.confidence))
        return IntelligenceUpcomingCatalystsResponse(
            asof_date=target_date,
            days_ahead=max(1, int(days_ahead)),
            items=items,
        )

    def get_sources_health(self) -> IntelligenceSourcesHealthResponse:
        payload = self._storage.load_source_health()
        items = [
            IntelligenceSourceHealthResponse(
                source_name=str(source),
                enabled=bool(item.get("enabled", False)),
                status=str(item.get("status", "unknown")),
                latency_ms=float(item.get("latency_ms", 0.0)),
                error_count=int(item.get("error_count", 0)),
                event_count=int(item.get("event_count", 0)),
                error_rate=float(item.get("error_rate", 0.0)),
                blocked_count=int(item.get("blocked_count", 0)),
                blocked_reasons=[str(value) for value in item.get("blocked_reasons", []) if str(value)],
                coverage_ratio=float(item.get("coverage_ratio", 0.0)),
                mean_confidence=float(item.get("mean_confidence", 0.0)),
                last_ingest=(str(item.get("last_ingest")) if item.get("last_ingest") else None),
            )
            for source, item in payload.items()
            if isinstance(item, dict)
        ]
        items.sort(key=lambda item: item.source_name)
        return IntelligenceSourcesHealthResponse(sources=items)

    def get_metrics(self, *, asof_date: str | None = None) -> IntelligenceMetricsResponse:
        payload = self._storage.load_intelligence_metrics()
        target_date = asof_date or str(payload.get("asof_date") or self._storage.latest_opportunities_date() or "")
        if not target_date:
            raise HTTPException(status_code=404, detail="No intelligence metrics available.")
        if asof_date and str(payload.get("asof_date") or "") != asof_date:
            raise HTTPException(status_code=404, detail=f"No intelligence metrics available for {asof_date}.")
        events_raw = payload.get("events_per_source", {})
        events_per_source: dict[str, int] = {}
        if isinstance(events_raw, dict):
            for source, value in events_raw.items():
                try:
                    events_per_source[str(source)] = int(value)
                except (TypeError, ValueError):
                    continue
        return IntelligenceMetricsResponse(
            asof_date=target_date,
            coverage_global=float(payload.get("coverage_global", 0.0)),
            mean_confidence_global=float(payload.get("mean_confidence_global", 0.0)),
            dedupe_ratio=float(payload.get("dedupe_ratio", 0.0)),
            events_per_source=events_per_source,
        )

    def get_cached_symbol_education(
        self,
        *,
        symbol: str,
        asof_date: str | None,
    ) -> IntelligenceEducationGenerateResponse:
        symbol_norm = str(symbol).strip().upper()
        if not symbol_norm:
            raise HTTPException(status_code=422, detail="symbol is required")
        target_date = self._resolve_asof_date(asof_date)
        cached_record = self._storage.load_symbol_education(target_date, symbol_norm)
        if not cached_record:
            raise HTTPException(
                status_code=404,
                detail=f"No cached educational intelligence for symbol: {symbol_norm}",
            )

        try:
            response = IntelligenceEducationGenerateResponse.model_validate(cached_record)
        except Exception as exc:
            raise HTTPException(
                status_code=404,
                detail=f"Cached educational intelligence is invalid for symbol: {symbol_norm}",
            ) from exc
        return response.model_copy(update={"source": "cache"})

    def generate_symbol_education(
        self,
        request: IntelligenceEducationGenerateRequest,
    ) -> IntelligenceEducationGenerateResponse:
        symbol = str(request.symbol).strip().upper()
        asof_date = self._resolve_asof_date(request.asof_date)
        views = request.views or list(_EDUCATION_VIEWS)
        template_version = self._education_template_version()

        cached_record = self._storage.load_symbol_education(asof_date, symbol)
        if cached_record and not request.force_refresh:
            try:
                cached_response = IntelligenceEducationGenerateResponse.model_validate(cached_record)
            except Exception:
                cached_response = None
            if cached_response is not None:
                has_same_template = cached_response.template_version == template_version
                has_all_views = all(view in cached_response.outputs for view in views)
                if has_same_template and has_all_views:
                    subset_outputs = {view: cached_response.outputs[view] for view in views}
                    return cached_response.model_copy(
                        update={
                            "outputs": subset_outputs,
                            "source": "cache",
                        }
                    )

        generated = self._build_education(
            symbol=symbol,
            asof_date=asof_date,
            views=views,
            candidate_context=request.candidate_context,
        )

        if cached_record:
            try:
                cached_response = IntelligenceEducationGenerateResponse.model_validate(cached_record)
                merged_outputs = {**cached_response.outputs, **generated.outputs}
            except Exception:
                merged_outputs = dict(generated.outputs)
        else:
            merged_outputs = dict(generated.outputs)

        record_to_store = generated.model_copy(update={"outputs": merged_outputs})
        self._storage.write_symbol_education(
            asof_date,
            symbol,
            record_to_store.model_dump(mode="json"),
        )

        return generated
