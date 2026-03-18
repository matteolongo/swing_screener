"""Build brief intelligence run summaries using LLM when available."""
from __future__ import annotations

from collections import Counter
import json
import logging
from typing import Any

from swing_screener.intelligence.config import IntelligenceConfig
from swing_screener.intelligence.llm.factory import build_langchain_chat_model

logger = logging.getLogger(__name__)


def _sanitize_text(value: str, *, max_len: int = 320) -> str:
    cleaned = " ".join(str(value or "").split()).strip()
    if len(cleaned) <= max_len:
        return cleaned
    return f"{cleaned[: max_len - 1]}…"


def _build_context_payload(snapshot: Any, llm_warnings_count: int) -> dict[str, Any]:
    opportunities = list(getattr(snapshot, "opportunities", []) or [])
    top = sorted(
        opportunities,
        key=lambda item: float(getattr(item, "opportunity_score", 0.0)),
        reverse=True,
    )[:3]
    top_items = [
        {
            "symbol": str(getattr(item, "symbol", "")).upper(),
            "state": str(getattr(item, "state", "")),
            "score": round(float(getattr(item, "opportunity_score", 0.0)), 3),
            "technical": round(float(getattr(item, "technical_readiness", 0.0)), 3),
            "catalyst": round(float(getattr(item, "catalyst_strength", 0.0)), 3),
        }
        for item in top
    ]

    events = list(getattr(snapshot, "events", []) or [])
    event_counts = Counter(str(getattr(event, "event_type", "other")).lower() for event in events)
    top_event_types = [
        {"type": event_type, "count": int(count)}
        for event_type, count in event_counts.most_common(3)
    ]

    themes = list(getattr(snapshot, "themes", []) or [])
    top_themes = []
    for theme in themes[:2]:
        symbols = list(getattr(theme, "symbols", []) or [])
        top_themes.append(
            {
                "name": str(getattr(theme, "name", "")).strip() or str(getattr(theme, "theme_id", "")).strip(),
                "symbols": [str(value).upper() for value in symbols[:5]],
                "strength": round(float(getattr(theme, "cluster_strength", 0.0)), 3),
            }
        )

    return {
        "asof_date": str(getattr(snapshot, "asof_date", "")),
        "symbols_scanned": len(list(getattr(snapshot, "symbols", []) or [])),
        "events_count": len(events),
        "opportunities_count": len(opportunities),
        "llm_warnings_count": int(llm_warnings_count),
        "top_opportunities": top_items,
        "top_event_types": top_event_types,
        "themes": top_themes,
    }


def _deterministic_summary(context: dict[str, Any]) -> str:
    symbols_scanned = int(context.get("symbols_scanned", 0))
    opportunities_count = int(context.get("opportunities_count", 0))
    warnings = int(context.get("llm_warnings_count", 0))
    top_opportunities = list(context.get("top_opportunities", []) or [])
    top_event_types = list(context.get("top_event_types", []) or [])

    primary = f"Scanned {symbols_scanned} symbols and found {opportunities_count} opportunities."

    if top_opportunities:
        names = ", ".join(
            f"{item.get('symbol')} ({round(float(item.get('score', 0.0)) * 100, 1)}%)"
            for item in top_opportunities
            if str(item.get("symbol", "")).strip()
        )
        secondary = f"Top setups: {names}."
    else:
        secondary = "No high-confidence setups were identified in this run."

    if top_event_types:
        event_text = ", ".join(
            f"{item.get('type')} x{item.get('count')}"
            for item in top_event_types
        )
        tertiary = f"Dominant catalyst types: {event_text}."
    else:
        tertiary = "No dominant catalyst pattern was detected."

    if warnings > 0:
        tertiary = f"{tertiary} LLM warnings: {warnings} (fallback logic applied where needed)."

    return _sanitize_text(f"{primary} {secondary} {tertiary}", max_len=320)


def _invoke_llm_summary(cfg: IntelligenceConfig, context: dict[str, Any]) -> str:
    provider = str(cfg.llm.provider).strip().lower()
    model = str(cfg.llm.model).strip()
    base_url = str(cfg.llm.base_url).strip() or None
    if provider == "mock":
        return _deterministic_summary(context)

    try:
        from langchain_core.messages import HumanMessage, SystemMessage
    except Exception as exc:
        raise RuntimeError(f"langchain-core unavailable: {exc}") from exc

    llm = build_langchain_chat_model(
        provider_name=provider,
        model=model or ("gpt-4.1-mini" if provider == "openai" else "mistral:7b-instruct"),
        base_url=base_url,
        api_key=None,
        temperature=0,
        max_retries=0,
    )

    system_prompt = (
        "You are a trading assistant. Create a brief market-intelligence run summary. "
        "Use only the provided structured context. Keep it factual, concise, and actionable. "
        "Return plain text with at most 2 sentences and no markdown."
    )
    user_prompt = json.dumps(context, separators=(",", ":"), ensure_ascii=True)
    response = llm.invoke(
        [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
    )
    return _sanitize_text(str(getattr(response, "content", "")).strip(), max_len=320)


def build_intelligence_run_summary(
    *,
    cfg: IntelligenceConfig,
    snapshot: Any,
    llm_warnings_count: int,
) -> str:
    context = _build_context_payload(snapshot, llm_warnings_count)
    fallback = _deterministic_summary(context)
    if not bool(getattr(cfg.llm, "enabled", False)):
        return fallback

    try:
        summary = _invoke_llm_summary(cfg, context)
        return summary or fallback
    except Exception as exc:
        logger.warning("Failed to generate LLM intelligence summary: %s", exc)
        return fallback
