import json
from datetime import datetime
from pathlib import Path

from swing_screener.intelligence.ingestion.earnings_calendar import (
    EarningsCalendarEventProvider,
)
from swing_screener.intelligence.ingestion.service import collect_events
from swing_screener.intelligence.ingestion.yahoo_finance import YahooFinanceEventProvider
from swing_screener.intelligence.models import Event


def _fixture_path(name: str) -> Path:
    return Path("tests/fixtures/intelligence") / name


def test_yahoo_finance_provider_maps_and_filters_fixture():
    payload = json.loads(_fixture_path("yahoo_news_aapl.json").read_text(encoding="utf-8"))

    provider = YahooFinanceEventProvider(
        fetcher=lambda symbol: payload if symbol == "AAPL" else []
    )
    events = provider.fetch_events(
        symbols=["AAPL"],
        start_dt=datetime.fromisoformat("2026-02-15T00:00:00"),
        end_dt=datetime.fromisoformat("2026-02-18T00:00:00"),
    )

    assert len(events) == 1
    event = events[0]
    assert event.symbol == "AAPL"
    assert event.source == "yahoo_finance"
    assert event.event_type == "news"
    assert event.headline == "Apple launches new enterprise AI stack"
    assert event.url == "https://example.com/apple-ai-stack"
    assert event.metadata["publisher"] == "Reuters"


def test_yahoo_finance_provider_handles_fetch_errors():
    def broken_fetcher(_symbol: str):
        raise RuntimeError("network error")

    provider = YahooFinanceEventProvider(fetcher=broken_fetcher)
    events = provider.fetch_events(
        symbols=["AAPL", "MSFT"],
        start_dt=datetime.fromisoformat("2026-02-15T00:00:00"),
        end_dt=datetime.fromisoformat("2026-02-18T00:00:00"),
    )

    assert events == []


def test_earnings_calendar_provider_maps_fixture():
    payload = json.loads(_fixture_path("earnings_calendar.json").read_text(encoding="utf-8"))

    provider = EarningsCalendarEventProvider(fetcher=lambda symbol: payload.get(symbol))
    events = provider.fetch_events(
        symbols=["AAPL", "MSFT", "NVDA"],
        start_dt=datetime.fromisoformat("2026-02-15T00:00:00"),
        end_dt=datetime.fromisoformat("2026-02-20T00:00:00"),
    )

    assert len(events) == 1
    event = events[0]
    assert event.symbol == "AAPL"
    assert event.source == "earnings_calendar"
    assert event.event_type == "earnings_calendar"
    assert event.metadata["session"] == "post"
    assert event.metadata["eps_estimate"] == 2.15


def test_collect_events_merges_and_deduplicates():
    shared = Event(
        event_id="same-id",
        symbol="AAPL",
        source="yahoo_finance",
        occurred_at="2026-02-17T00:00:00",
        headline="Shared event",
        event_type="news",
        credibility=0.7,
    )
    newer = Event(
        event_id="later-id",
        symbol="AAPL",
        source="earnings_calendar",
        occurred_at="2026-02-18T00:00:00",
        headline="Later event",
        event_type="earnings_calendar",
        credibility=0.8,
    )

    class P1:
        name = "yahoo_finance"

        def fetch_events(self, **_kwargs):
            return [shared, newer]

    class P2:
        name = "earnings_calendar"

        def fetch_events(self, **_kwargs):
            # Same event_id should dedupe.
            return [shared]

    events = collect_events(
        symbols=["AAPL"],
        start_dt=datetime.fromisoformat("2026-02-15T00:00:00"),
        end_dt=datetime.fromisoformat("2026-02-19T00:00:00"),
        provider_names=["yahoo_finance", "earnings_calendar"],
        providers={"yahoo_finance": P1(), "earnings_calendar": P2()},
    )

    assert [event.event_id for event in events] == ["later-id", "same-id"]

