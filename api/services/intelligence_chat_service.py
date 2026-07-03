from __future__ import annotations

import json
import os
import uuid
from collections.abc import Callable
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from openai import OpenAI

from api.models.intelligence_chat import (
    IntelligenceChatEvidence,
    IntelligenceChatMessage,
    IntelligenceChatRequest,
    IntelligenceChatResponse,
)
from swing_screener.intelligence.cache import read_from_cache
from swing_screener.intelligence.evidence.collect import collect_evidence
from swing_screener.intelligence.evidence.models import SourceEvidence
from swing_screener.intelligence.history import read_history
from swing_screener.intelligence.models import SymbolIntelligence
from swing_screener.settings import get_settings_manager
from swing_screener.settings.paths import data_dir


class MissingIntelligenceError(RuntimeError):
    pass


AnswerFn = Callable[..., str]
CollectEvidenceFn = Callable[[str], list[SourceEvidence]]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _chat_root() -> Path:
    return data_dir() / "intelligence" / "chat"


def _chat_file(ticker: str, chat_date: date) -> Path:
    return _chat_root() / ticker.upper() / f"{chat_date.isoformat()}.json"


def _normalize_evidence(items: list[SourceEvidence]) -> list[IntelligenceChatEvidence]:
    return [
        IntelligenceChatEvidence(
            label=item.title,
            source=item.publisher,
            url=item.url,
            date=item.published_at,
            summary=item.quote_or_summary,
        )
        for item in items
    ]


def _format_context(
    *,
    ticker: str,
    intelligence: SymbolIntelligence,
    history: list[Any],
    messages: list[IntelligenceChatMessage],
    fresh_evidence: list[SourceEvidence],
    candidate: dict[str, Any] | None,
    position: dict[str, Any] | None,
) -> str:
    payload = {
        "ticker": ticker,
        "latest_analysis": intelligence.model_dump(mode="json"),
        "recent_history": [entry.model_dump(mode="json") for entry in history[:5]],
        "conversation": [message.model_dump(mode="json") for message in messages[-8:]],
        "fresh_evidence": [item.model_dump(mode="json") for item in fresh_evidence],
        "candidate": candidate,
        "position": position,
    }
    return json.dumps(payload, indent=2, sort_keys=True)


def _default_answer_fn(
    *,
    ticker: str,
    message: str,
    intelligence: SymbolIntelligence,
    history: list[Any],
    prior_messages: list[IntelligenceChatMessage],
    fresh_evidence: list[SourceEvidence],
    refresh_sources: bool,
    candidate: dict[str, Any] | None,
    position: dict[str, Any] | None,
) -> str:
    if not os.environ.get("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is not configured")
    cfg = get_settings_manager().load_intelligence_document().get("config", {}).get("llm", {})
    configured_model = cfg.get("model") or cfg.get("web_search_model")
    if not configured_model:
        raise RuntimeError("Intelligence chat model is not configured")
    model = str(configured_model)
    client = OpenAI()
    context = _format_context(
        ticker=ticker,
        intelligence=intelligence,
        history=history,
        messages=prior_messages,
        fresh_evidence=fresh_evidence,
        candidate=candidate,
        position=position,
    )
    response = client.responses.create(
        model=model,
        input=[
            {
                "role": "system",
                "content": (
                    "You answer follow-up questions about a cached swing-trading intelligence analysis. "
                    "Stay advisory-only: do not create orders, do not execute trades, and do not claim "
                    "actions were taken. Use only the supplied app context. If fresh evidence is present, "
                    "explain whether it strengthens or weakens the thesis and what to monitor. If evidence "
                    "is missing or stale, say so. Keep the answer concise and actionable."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Question for {ticker}: {message}\n\n"
                    f"Refresh requested: {refresh_sources}\n\n"
                    f"App context JSON:\n{context}"
                ),
            },
        ],
    )
    text = getattr(response, "output_text", None)
    if isinstance(text, str) and text.strip():
        return text.strip()
    return "I could not generate a useful answer from the available context."


class IntelligenceChatService:
    def __init__(
        self,
        *,
        today: Callable[[], date] | None = None,
        answer_fn: AnswerFn | None = None,
        collect_evidence_fn: CollectEvidenceFn | None = None,
    ) -> None:
        self._today = today or (lambda: datetime.now(timezone.utc).date())
        self._answer_fn = answer_fn or _default_answer_fn
        self._collect_evidence = collect_evidence_fn or (lambda ticker: collect_evidence(ticker, refresh_sources=True))

    def get_chat(self, ticker: str, chat_date: date | None = None) -> IntelligenceChatResponse:
        ticker = ticker.upper()
        chat_date = chat_date or self._today()
        intelligence = read_from_cache(ticker, for_date=chat_date)
        if intelligence is None:
            raise MissingIntelligenceError(f"No cached analysis for {ticker} on {chat_date.isoformat()}")
        messages = self._read_messages(ticker, chat_date)
        return IntelligenceChatResponse(ticker=ticker, chat_date=chat_date.isoformat(), messages=messages)

    def send_message(
        self,
        ticker: str,
        request: IntelligenceChatRequest,
        chat_date: date | None = None,
    ) -> IntelligenceChatResponse:
        ticker = ticker.upper()
        chat_date = chat_date or self._today()
        intelligence = read_from_cache(ticker, for_date=chat_date)
        if intelligence is None:
            raise MissingIntelligenceError(f"No cached analysis for {ticker} on {chat_date.isoformat()}")

        existing = self._read_messages(ticker, chat_date)
        user_message = IntelligenceChatMessage(
            id=str(uuid.uuid4()),
            role="user",
            content=request.message.strip(),
            created_at=_now_iso(),
            refresh_sources=request.refresh_sources,
        )
        fresh_evidence = self._collect_evidence(ticker) if request.refresh_sources else []
        answer = self._answer_fn(
            ticker=ticker,
            message=user_message.content,
            intelligence=intelligence,
            history=read_history(ticker),
            prior_messages=existing,
            fresh_evidence=fresh_evidence,
            refresh_sources=request.refresh_sources,
            candidate=request.candidate,
            position=request.position,
        )
        assistant_message = IntelligenceChatMessage(
            id=str(uuid.uuid4()),
            role="assistant",
            content=answer,
            created_at=_now_iso(),
            refresh_sources=request.refresh_sources,
            evidence_used=_normalize_evidence(fresh_evidence) if request.refresh_sources else [],
        )
        messages = [*existing, user_message, assistant_message]
        refreshed_at = _now_iso() if request.refresh_sources else None
        self._write_chat(ticker, chat_date, messages, intelligence.generated_at, refreshed_at)
        return IntelligenceChatResponse(
            ticker=ticker,
            chat_date=chat_date.isoformat(),
            messages=messages,
            refreshed_at=refreshed_at,
        )

    def _read_messages(self, ticker: str, chat_date: date) -> list[IntelligenceChatMessage]:
        path = _chat_file(ticker, chat_date)
        if not path.exists():
            return []
        try:
            raw = json.loads(path.read_text())
            return [IntelligenceChatMessage.model_validate(item) for item in raw.get("messages", [])]
        except (OSError, ValueError, TypeError):
            return []

    def _write_chat(
        self,
        ticker: str,
        chat_date: date,
        messages: list[IntelligenceChatMessage],
        analysis_generated_at: str,
        refreshed_at: str | None,
    ) -> None:
        path = _chat_file(ticker, chat_date)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "ticker": ticker.upper(),
            "chat_date": chat_date.isoformat(),
            "analysis_generated_at": analysis_generated_at,
            "updated_at": _now_iso(),
            "refreshed_at": refreshed_at,
            "messages": [message.model_dump(mode="json") for message in messages],
        }
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, indent=2))
        tmp.replace(path)
