from __future__ import annotations

from datetime import datetime

from swing_screener.intelligence.ingestion.base import IntelligenceEventProvider
from swing_screener.intelligence.ingestion.factory import build_intelligence_provider
from swing_screener.intelligence.models import Event


def collect_events(
    *,
    symbols: list[str],
    start_dt: datetime,
    end_dt: datetime,
    provider_names: list[str] | tuple[str, ...],
    providers: dict[str, IntelligenceEventProvider] | None = None,
) -> list[Event]:
    provider_map = providers or {
        name: build_intelligence_provider(name) for name in provider_names
    }
    all_events: dict[str, Event] = {}

    for provider_name in provider_names:
        provider = provider_map.get(provider_name)
        if provider is None:
            continue
        events = provider.fetch_events(symbols=symbols, start_dt=start_dt, end_dt=end_dt)
        for event in events:
            all_events[event.event_id] = event

    merged = list(all_events.values())
    merged.sort(key=lambda event: (event.occurred_at, event.event_id), reverse=True)
    return merged

