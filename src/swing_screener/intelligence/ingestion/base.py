from __future__ import annotations

from datetime import datetime
from typing import Protocol

from swing_screener.intelligence.models import Event


class IntelligenceEventProvider(Protocol):
    name: str

    def fetch_events(
        self,
        *,
        symbols: list[str],
        start_dt: datetime,
        end_dt: datetime,
    ) -> list[Event]:
        """Fetch normalized events for symbols in the requested window."""
        ...

