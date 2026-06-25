"""Evidence item model for deterministic catalyst collectors.

Re-exports the existing SourceEvidence so the deterministic-collector path and
the AI catalyst-report path share one evidence shape.
"""
from __future__ import annotations

from swing_screener.intelligence.catalysts.models import SourceEvidence

__all__ = ["SourceEvidence"]
