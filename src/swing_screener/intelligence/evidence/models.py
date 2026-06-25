"""Evidence item model for deterministic catalyst collectors.

Re-exports the existing SourceEvidence so the deterministic-collector path and
the AI catalyst-report path share one evidence shape.
"""
from __future__ import annotations

from pydantic import BaseModel


class SourceEvidence(BaseModel):
    title: str
    url: str
    publisher: str | None = None
    published_at: str | None = None
    quote_or_summary: str
    relevance: str


__all__ = ["SourceEvidence"]
