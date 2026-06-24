"""Pydantic response models for the Data Sources diagnostics API (snake_case)."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel


class ProbeResultOut(BaseModel):
    id: str
    status: Literal["ok", "down", "not_configured"]
    latency_ms: Optional[float] = None
    detail: Optional[str] = None
    sample: Optional[dict] = None
    error: Optional[str] = None


class SourceDescriptorOut(BaseModel):
    id: str
    display_name: str
    domain: str
    role: Literal["primary", "fallback", "enrichment"]
    requires: Optional[str] = None
    configured: bool
    probeable: bool
    canary_market: Optional[str] = None
    note: Optional[str] = None
    last_probe: Optional[ProbeResultOut] = None


class DataSourcesInventoryOut(BaseModel):
    sources: list[SourceDescriptorOut]


class FallbackEventOut(BaseModel):
    ts: str
    domain: str
    from_provider: str
    reason: str
    fell_back_to: Optional[str] = None
    tickers: list[str] = []
    stale_asof: Optional[str] = None


class FallbackEventsOut(BaseModel):
    events: list[FallbackEventOut]
