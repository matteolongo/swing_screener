from swing_screener.data.source_health import (
    FallbackEventRing,
    FallbackEvent,
    record_fallback,
    recent_events,
    reset_fallback_events,
)


def test_ring_is_bounded_and_newest_first():
    ring = FallbackEventRing(capacity=3)
    for i in range(5):
        ring.record(
            FallbackEvent(
                ts=f"2026-06-24T10:00:0{i}+00:00",
                domain="market_data",
                from_provider="yfinance",
                reason=f"r{i}",
                fell_back_to="stooq",
            )
        )
    items = ring.recent()
    assert len(items) == 3                       # bounded to capacity
    assert [e.reason for e in items] == ["r4", "r3", "r2"]  # newest first


def test_recent_events_respects_limit():
    ring = FallbackEventRing(capacity=10)
    for i in range(4):
        ring.record(
            FallbackEvent(
                ts=f"2026-06-24T10:00:0{i}+00:00",
                domain="market_data",
                from_provider="yfinance",
                reason=f"r{i}",
            )
        )
    assert len(ring.recent(limit=2)) == 2


def test_module_record_and_reset():
    reset_fallback_events()
    record_fallback(
        domain="fundamentals",
        from_provider="sec_edgar",
        reason="provider raised",
        fell_back_to="yfinance",
        tickers=["AAPL"],
    )
    events = recent_events()
    assert len(events) == 1
    assert events[0].from_provider == "sec_edgar"
    assert events[0].tickers == ["AAPL"]
    assert events[0].ts  # auto-stamped, non-empty
    reset_fallback_events()
    assert recent_events() == []
