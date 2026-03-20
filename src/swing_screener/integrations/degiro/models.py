"""Frozen dataclass models for the DeGiro integration layer."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass(frozen=True)
class DegiroProductRef:
    product_id: str
    isin: Optional[str]
    vwd_id: Optional[str]
    name: str
    exchange: Optional[str]
    currency: Optional[str]
    symbol: Optional[str]


@dataclass(frozen=True)
class DegiroAuditRecord:
    # Product identification
    product_id: str
    isin: Optional[str]
    vwd_id: Optional[str]
    name: str
    exchange: Optional[str]
    currency: Optional[str]
    symbol: Optional[str]
    # Coverage probes
    has_quote: bool = False
    has_chart: bool = False
    has_profile: bool = False
    has_ratios: bool = False
    has_statements: bool = False
    has_estimates: bool = False
    has_agenda: bool = False
    has_news: bool = False
    # Resolution metadata
    resolution_confidence: str = "not_found"  # "exact"/"alias"/"exchange"/"ambiguous"/"not_found"
    resolution_notes: str = ""


@dataclass(frozen=True)
class DegiroAuditRun:
    audit_id: str
    created_at: str
    symbols: tuple[str, ...]
    results: tuple[DegiroAuditRecord, ...]
    summary_counts: dict[str, int] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Phase 2 sync models
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class DegiroSyncRaw:
    positions: list[dict]
    pending_orders: list[dict]
    order_history: list[dict]
    transactions: list[dict]
    cash: list[dict]


@dataclass(frozen=True)
class SyncDiff:
    kind: str        # "position" | "order"
    action: str      # "create" | "update"
    local_id: Optional[str]
    broker_id: Optional[str]
    confidence: str  # "exact" | "fuzzy" | "ambiguous"
    fields: dict


@dataclass(frozen=True)
class DegiroSyncPreview:
    positions_to_create: tuple[SyncDiff, ...]
    positions_to_update: tuple[SyncDiff, ...]
    orders_to_create: tuple[SyncDiff, ...]
    orders_to_update: tuple[SyncDiff, ...]
    ambiguous: tuple[SyncDiff, ...]
    unmatched: tuple[SyncDiff, ...]
    fees_applied: int


@dataclass(frozen=True)
class DegiroApplyResult:
    positions_created: int
    positions_updated: int
    orders_created: int
    orders_updated: int
    fees_applied: int
    ambiguous_skipped: int
    artifact_paths: dict[str, str]
