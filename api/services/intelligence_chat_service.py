from __future__ import annotations

import json
import os
import uuid
from hashlib import sha256
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
from swing_screener.intelligence.config_access import intelligence_config_section
from swing_screener.intelligence.models import SymbolIntelligence
from swing_screener.settings.paths import data_dir
from swing_screener.utils.file_lock import write_json_with_lock


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


def _archive_chat_file(ticker: str, chat_date: date, analysis_generated_at: str | None) -> Path:
    """Give a replaced conversation a stable, filesystem-safe revision name."""
    revision = analysis_generated_at or "unknown"
    digest = sha256(revision.encode("utf-8")).hexdigest()[:12]
    return _chat_root() / ticker.upper() / f"{chat_date.isoformat()}.{digest}.json"


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
    cfg = intelligence_config_section("llm")
    configured_model = cfg.get("model") or cfg.get("web_search_model")
    if not configured_model:
        raise RuntimeError("Intelligence chat model is not configured")
    model = str(configured_model)
    client = OpenAI(
        api_key=os.environ.get("OPENAI_API_KEY"),
        base_url=(str(cfg.get("base_url")).strip() if cfg.get("base_url") else None),
        timeout=float(cfg.get("request_timeout_seconds", 60.0)),
        max_retries=int(cfg.get("max_retries", 2)),
    )
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
        stored = self._read_chat(ticker, chat_date)
        # A GET is read-only. If a refresh replaced the analysis before a later
        # POST can archive the previous conversation, do not leak those messages
        # into the new revision.
        messages = (
            self._messages_from(stored)
            if self._stored_revision(stored) == intelligence.generated_at
            else []
        )
        return IntelligenceChatResponse(
            ticker=ticker,
            chat_date=chat_date.isoformat(),
            analysis_generated_at=intelligence.generated_at,
            messages=messages,
        )

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

        stored = self._read_chat(ticker, chat_date)
        requested_revision = (request.analysis_generated_at or "").strip() or None
        current_revision = intelligence.generated_at
        if self._stored_revision(stored) != current_revision:
            self._archive_stale_chat(ticker, chat_date, stored)
            existing: list[IntelligenceChatMessage] = []
        elif requested_revision is not None and requested_revision != current_revision:
            # The browser submitted a message from a stale analysis card. Never
            # append it to any existing revision; the answer is grounded only in
            # the current cached analysis.
            existing = []
        else:
            existing = self._messages_from(stored)
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
        self._write_chat(ticker, chat_date, messages, current_revision, refreshed_at)
        return IntelligenceChatResponse(
            ticker=ticker,
            chat_date=chat_date.isoformat(),
            analysis_generated_at=current_revision,
            messages=messages,
            refreshed_at=refreshed_at,
        )

    def _read_chat(self, ticker: str, chat_date: date) -> dict[str, Any] | None:
        path = _chat_file(ticker, chat_date)
        if not path.exists():
            return None
        try:
            raw = json.loads(path.read_text())
            return raw if isinstance(raw, dict) else None
        except (OSError, ValueError, TypeError):
            return None

    @staticmethod
    def _stored_revision(stored: dict[str, Any] | None) -> str | None:
        if stored is None:
            return None
        value = stored.get("analysis_generated_at")
        return value if isinstance(value, str) and value else None

    @staticmethod
    def _messages_from(stored: dict[str, Any] | None) -> list[IntelligenceChatMessage]:
        if stored is None:
            return []
        try:
            messages = stored.get("messages", [])
            return [IntelligenceChatMessage.model_validate(item) for item in messages]
        except (ValueError, TypeError):
            return []

    def _archive_stale_chat(
        self,
        ticker: str,
        chat_date: date,
        stored: dict[str, Any] | None,
    ) -> None:
        if stored is None or not self._messages_from(stored):
            return
        archive = _archive_chat_file(ticker, chat_date, self._stored_revision(stored))
        # Preserve the old payload rather than mutating it. The current-path
        # write below atomically establishes the new analysis revision.
        write_json_with_lock(archive, stored)

    def _write_chat(
        self,
        ticker: str,
        chat_date: date,
        messages: list[IntelligenceChatMessage],
        analysis_generated_at: str,
        refreshed_at: str | None,
    ) -> None:
        path = _chat_file(ticker, chat_date)
        payload = {
            "ticker": ticker.upper(),
            "chat_date": chat_date.isoformat(),
            "analysis_generated_at": analysis_generated_at,
            "updated_at": _now_iso(),
            "refreshed_at": refreshed_at,
            "messages": [message.model_dump(mode="json") for message in messages],
        }
        write_json_with_lock(path, payload)
