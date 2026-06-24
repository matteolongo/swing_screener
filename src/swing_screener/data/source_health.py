"""Shared data source health and provenance models."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal, Protocol, runtime_checkable

SourceDomain = Literal[
    "market_data",
    "metadata",
    "fundamentals",
    "calendar",
    "intelligence",
    "aggregate",
]
SourceStatus = Literal["ok", "degraded", "failed", "unknown"]

ProbeStatus = Literal["ok", "down", "not_configured"]
SourceRole = Literal["primary", "fallback", "enrichment"]
CanaryMarket = Literal["us", "eu"]


@dataclass(frozen=True)
class SourceDescriptor:
    """Static, credential-free description of one data source."""

    id: str
    display_name: str
    domain: SourceDomain
    role: SourceRole
    requires: str | None = None          # env var or pkg name; None if unconditional
    configured: bool = True              # key/pkg present
    probeable: bool = True               # has a live canary path
    canary_market: CanaryMarket | None = "us"
    note: str | None = None              # e.g. "declared — no runtime adapter"

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class ProbeResult:
    """Outcome of a single live canary request against one source."""

    id: str
    status: ProbeStatus
    latency_ms: float | None = None
    detail: str | None = None
    sample: dict | None = None
    error: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class FallbackEvent:
    """One runtime fallback / stale-cache / silent-swallow event."""

    ts: str                              # ISO-8601 UTC
    domain: SourceDomain
    from_provider: str
    reason: str
    fell_back_to: str | None = None
    tickers: list[str] = field(default_factory=list)
    stale_asof: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


@runtime_checkable
class DiagnosableSource(Protocol):
    """Contract a data source implements to appear in the Data Sources page.

    Implement BOTH as classmethods so inventory works without instantiating
    a provider that may need credentials or an optional package.
    """

    @classmethod
    def describe(cls) -> SourceDescriptor: ...

    @classmethod
    def probe(cls, canary: str) -> ProbeResult: ...


@dataclass(frozen=True)
class DataSourceHealth:
    provider: str
    domain: SourceDomain
    status: SourceStatus = "unknown"
    quality_score: float = 0.5
    delay_policy: str = "unknown"
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        payload = asdict(self)
        payload["quality_score"] = max(0.0, min(1.0, float(self.quality_score)))
        return payload


@dataclass(frozen=True)
class DataSourceProvenance:
    provider: str
    domain: SourceDomain
    asof_date: str | None = None
    fetched_at: str | None = None
    fields: list[str] = field(default_factory=list)
    source_url: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def merge_source_health(items: list[DataSourceHealth]) -> DataSourceHealth:
    if not items:
        return DataSourceHealth(provider="combined", domain="aggregate")

    statuses = {item.status for item in items}
    if "failed" in statuses:
        status: SourceStatus = "failed"
    elif "degraded" in statuses:
        status = "degraded"
    elif statuses == {"ok"}:
        status = "ok"
    else:
        status = "unknown"

    warnings: list[str] = []
    for item in items:
        for warning in item.warnings:
            if warning not in warnings:
                warnings.append(warning)

    base_score = sum(
        max(0.0, min(1.0, float(item.quality_score)))
        for item in items
    ) / len(items)
    warning_penalty = min(0.25, 0.05 * len(warnings))
    failure_penalty = 0.35 if status == "failed" else 0.10 if status == "degraded" else 0.0

    return DataSourceHealth(
        provider="combined",
        domain="aggregate",
        status=status,
        quality_score=max(0.0, round(base_score - warning_penalty - failure_penalty, 4)),
        warnings=warnings,
    )
