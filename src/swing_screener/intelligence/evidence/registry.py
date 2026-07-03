from __future__ import annotations

from datetime import date
from typing import ClassVar, Protocol, runtime_checkable

from swing_screener.intelligence.evidence.models import SourceEvidence


@runtime_checkable
class CatalystCollector(Protocol):
    SOURCE_ID: ClassVar[str]

    @classmethod
    def collect(cls, ticker: str, *, asof_date: date, cfg) -> list[SourceEvidence]:
        ...


_REGISTRY: dict[str, type[CatalystCollector]] = {}


def register(collector: type[CatalystCollector]) -> type[CatalystCollector]:
    key = getattr(collector, "SOURCE_ID", None)
    if not key:
        raise ValueError(f"{collector!r} has no SOURCE_ID")
    _REGISTRY[key] = collector
    return collector


def get_registered() -> dict[str, type[CatalystCollector]]:
    return dict(_REGISTRY)
