from __future__ import annotations

import json
from datetime import date

import pytest

from api.models.intelligence_chat import IntelligenceChatRequest
from api.services.intelligence_chat_service import IntelligenceChatService, MissingIntelligenceError
from swing_screener.intelligence.cache import write_to_cache
from swing_screener.intelligence.evidence.models import SourceEvidence
from swing_screener.intelligence.models import NewsItem, SymbolIntelligence


def _make_intelligence(symbol: str = "AAPL") -> SymbolIntelligence:
    return SymbolIntelligence(
        symbol=symbol,
        generated_at="2026-07-03T08:00:00Z",
        action="BUY_NOW",
        conviction="high",
        catalyst_urgency="medium",
        summary_line="Breakout setup with earnings risk.",
        narrative="What to do: monitor the breakout. Watch for weak guidance.",
        upcoming_events=[],
        position_signal=None,
        sources=["https://example.com/analysis"],
        news=[
            NewsItem(
                headline="AAPL reports stronger demand",
                url="https://example.com/news",
                date="2026-07-02",
                sentiment="bullish",
            )
        ],
    )


def test_get_returns_empty_conversation_when_analysis_exists(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    chat_date = date(2026, 7, 3)
    write_to_cache("AAPL", _make_intelligence(), for_date=chat_date)
    service = IntelligenceChatService(today=lambda: chat_date, answer_fn=lambda **_: "unused")

    response = service.get_chat("aapl")

    assert response.ticker == "AAPL"
    assert response.chat_date == "2026-07-03"
    assert response.messages == []


def test_send_persists_user_and_assistant_messages(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    chat_date = date(2026, 7, 3)
    write_to_cache("AAPL", _make_intelligence(), for_date=chat_date)
    service = IntelligenceChatService(today=lambda: chat_date, answer_fn=lambda **_: "Guidance is the main risk.")

    response = service.send_message(
        "aapl",
        IntelligenceChatRequest(message="What invalidates this?", refresh_sources=False),
    )

    assert [message.role for message in response.messages] == ["user", "assistant"]
    assert response.messages[0].content == "What invalidates this?"
    assert response.messages[1].content == "Guidance is the main risk."
    stored = json.loads((tmp_path / "intelligence" / "chat" / "AAPL" / "2026-07-03.json").read_text())
    assert [message["role"] for message in stored["messages"]] == ["user", "assistant"]


def test_send_requires_cached_intelligence(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    service = IntelligenceChatService(today=lambda: date(2026, 7, 3), answer_fn=lambda **_: "unused")

    with pytest.raises(MissingIntelligenceError):
        service.send_message("AAPL", IntelligenceChatRequest(message="Can I ask?", refresh_sources=False))


def test_refresh_false_does_not_collect_evidence(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    chat_date = date(2026, 7, 3)
    write_to_cache("AAPL", _make_intelligence(), for_date=chat_date)
    calls: list[str] = []
    service = IntelligenceChatService(
        today=lambda: chat_date,
        answer_fn=lambda **_: "Use cached context.",
        collect_evidence_fn=lambda ticker: calls.append(ticker) or [],
    )

    response = service.send_message(
        "AAPL",
        IntelligenceChatRequest(message="Use current analysis", refresh_sources=False),
    )

    assert calls == []
    assert response.messages[-1].evidence_used == []


def test_refresh_true_collects_and_returns_evidence(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    chat_date = date(2026, 7, 3)
    write_to_cache("AAPL", _make_intelligence(), for_date=chat_date)
    evidence = [
        SourceEvidence(
            title="AAPL supplier update",
            url="https://example.com/source",
            publisher="Example News",
            published_at="2026-07-03",
            quote_or_summary="Supplier checks improved.",
            relevance="bullish demand evidence",
        )
    ]
    service = IntelligenceChatService(
        today=lambda: chat_date,
        answer_fn=lambda **kwargs: f"Refreshed {len(kwargs['fresh_evidence'])} items.",
        collect_evidence_fn=lambda _ticker: evidence,
    )

    response = service.send_message(
        "AAPL",
        IntelligenceChatRequest(message="Refresh sources first", refresh_sources=True),
    )

    assistant = response.messages[-1]
    assert assistant.content == "Refreshed 1 items."
    assert assistant.refresh_sources is True
    assert response.refreshed_at is not None
    assert assistant.evidence_used[0].label == "AAPL supplier update"
    assert assistant.evidence_used[0].source == "Example News"
    assert assistant.evidence_used[0].date == "2026-07-03"


def test_router_maps_missing_analysis_to_409(monkeypatch):
    from api.routers.intelligence import chat_with_symbol

    class MissingService:
        def send_message(self, _ticker: str, _request: IntelligenceChatRequest):
            raise MissingIntelligenceError("No cached analysis")

    monkeypatch.setattr("api.routers.intelligence._get_chat_service", lambda: MissingService())

    with pytest.raises(Exception) as exc:
        chat_with_symbol("AAPL", IntelligenceChatRequest(message="Question?"))

    assert getattr(exc.value, "status_code", None) == 409
