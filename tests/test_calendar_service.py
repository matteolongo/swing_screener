# tests/test_calendar_service.py
from __future__ import annotations
import datetime as dt
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest

from api.models.calendar import CalendarEvent
from api.services.calendar_service import CalendarService


def _make_positions_repo(tickers: list[str]):
    repo = MagicMock()
    repo.list_positions.return_value = (
        [{"ticker": t, "status": "open"} for t in tickers],
        "2026-05-27",
    )
    return repo


def test_get_events_returns_earnings_for_open_positions(tmp_path):
    repo = _make_positions_repo(["AAPL"])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path)

    fake_date = dt.date.today() + dt.timedelta(days=10)
    with patch.object(svc, "_fetch_earnings_for", return_value=fake_date):
        events = svc.get_events(days_ahead=30)

    earnings = [e for e in events if e.event_type == "earnings"]
    assert len(earnings) == 1
    assert earnings[0].ticker == "AAPL"
    assert earnings[0].source_tag == "position"
    assert earnings[0].date == fake_date.isoformat()


def test_get_events_source_tag_screener_for_review_symbol(tmp_path):
    import json

    repo = _make_positions_repo([])
    reviews_dir = tmp_path / "daily_reviews"
    reviews_dir.mkdir()
    review_date = dt.date.today().isoformat()
    review_file = reviews_dir / f"daily_review_{review_date}_default.json"
    review_file.write_text(
        json.dumps({
            "new_candidates": [{"ticker": "MSFT"}],
            "positions_add_on_candidates": [],
        })
    )
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path)

    fake_date = dt.date.today() + dt.timedelta(days=5)
    with patch.object(svc, "_fetch_earnings_for", return_value=fake_date):
        events = svc.get_events(days_ahead=30)

    earnings = [e for e in events if e.event_type == "earnings"]
    assert len(earnings) == 1
    assert earnings[0].ticker == "MSFT"
    assert earnings[0].source_tag == "screener"


def test_get_events_excludes_past_earnings(tmp_path):
    repo = _make_positions_repo(["AAPL"])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path)

    past_date = dt.date.today() - dt.timedelta(days=1)
    with patch.object(svc, "_fetch_earnings_for", return_value=past_date):
        events = svc.get_events(days_ahead=30)

    assert not any(e.event_type == "earnings" for e in events)


def test_get_events_excludes_earnings_beyond_window(tmp_path):
    repo = _make_positions_repo(["AAPL"])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path)

    far_date = dt.date.today() + dt.timedelta(days=60)
    with patch.object(svc, "_fetch_earnings_for", return_value=far_date):
        events = svc.get_events(days_ahead=30)

    assert not any(e.event_type == "earnings" for e in events)


def test_get_events_no_crash_on_earnings_fetch_failure(tmp_path):
    repo = _make_positions_repo(["AAPL"])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path)

    with patch.object(svc, "_fetch_earnings_for", side_effect=Exception("network error")):
        events = svc.get_events(days_ahead=30)

    assert isinstance(events, list)


def test_get_events_position_beats_screener_tag(tmp_path):
    import json

    repo = _make_positions_repo(["AAPL"])
    reviews_dir = tmp_path / "daily_reviews"
    reviews_dir.mkdir()
    review_date = dt.date.today().isoformat()
    review_file = reviews_dir / f"daily_review_{review_date}_default.json"
    review_file.write_text(
        json.dumps({
            "new_candidates": [{"ticker": "AAPL"}],
            "positions_add_on_candidates": [],
        })
    )
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path)

    fake_date = dt.date.today() + dt.timedelta(days=5)
    with patch.object(svc, "_fetch_earnings_for", return_value=fake_date):
        events = svc.get_events(days_ahead=30)

    earnings = [e for e in events if e.ticker == "AAPL"]
    assert len(earnings) == 1
    assert earnings[0].source_tag == "position"


def test_calendar_event_accepts_ipo_event_type(tmp_path):
    from api.models.calendar import CalendarEvent
    event = CalendarEvent(
        date="2026-06-05",
        ticker="ACME",
        event_type="ipo",
        title="ACME IPO",
        source_tag="ipo",
    )
    assert event.event_type == "ipo"
    assert event.source_tag == "ipo"


def test_calendar_event_accepts_dividend_event_type(tmp_path):
    from api.models.calendar import CalendarEvent
    event = CalendarEvent(
        date="2026-06-01",
        ticker="AAPL",
        event_type="dividend",
        title="AAPL Dividend",
        source_tag="position",
    )
    assert event.event_type == "dividend"


def test_calendar_event_accepts_eps_estimate():
    from api.models.calendar import CalendarEvent
    event = CalendarEvent(
        date="2026-07-31",
        ticker="AAPL",
        event_type="earnings",
        title="AAPL Earnings",
        source_tag="position",
        eps_estimate=1.72,
        eps_actual=None,
    )
    assert event.eps_estimate == 1.72
    assert event.eps_actual is None


def test_calendar_event_eps_fields_default_to_none():
    from api.models.calendar import CalendarEvent
    event = CalendarEvent(
        date="2026-07-31",
        ticker="AAPL",
        event_type="earnings",
        title="AAPL Earnings",
        source_tag="position",
    )
    assert event.eps_estimate is None
    assert event.eps_actual is None
