from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class IntelligenceChatEvidence(BaseModel):
    label: str
    source: str | None = None
    url: str | None = None
    date: str | None = None
    summary: str | None = None


class IntelligenceChatMessage(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: str
    refresh_sources: bool = False
    evidence_used: list[IntelligenceChatEvidence] = Field(default_factory=list)


class IntelligenceChatRequest(BaseModel):
    message: str
    refresh_sources: bool = False
    analysis_generated_at: str | None = None
    candidate: dict[str, Any] | None = None
    position: dict[str, Any] | None = None


class IntelligenceChatResponse(BaseModel):
    ticker: str
    chat_date: str
    messages: list[IntelligenceChatMessage]
    refreshed_at: str | None = None
