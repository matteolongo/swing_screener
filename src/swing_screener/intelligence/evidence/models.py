"""Evidence item model for deterministic catalyst collectors.

Defines ``SourceEvidence`` — the shared evidence shape produced by the SEC EDGAR
collector and consumed by the analyzer prompt.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class SourceEvidence(BaseModel):
    source_id: str | None = Field(default=None, exclude=True)
    title: str
    url: str
    publisher: str | None = None
    published_at: str | None = None
    quote_or_summary: str
    relevance: str


__all__ = ["SourceEvidence"]
