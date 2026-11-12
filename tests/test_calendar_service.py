# tests/test_calendar_service.py
from __future__ import annotations
import datetime as dt
from unittest.mock import MagicMock, patch
import pytest

from api.models.calendar import CalendarEvent
from api.services.calendar_service import CalendarService
from swing_screener.utils.date_helpers import market_today


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

    fake_date = market_today() + dt.timedelta(days=10)
    with patch.object(svc, "_fetch_earnings_for", return_value=fake_date):
        events = svc.get_events(days_ahead=30).events

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
    review_date = market_today().isoformat()
    review_file = reviews_dir / f"daily_review_{review_date}_default.json"
    review_file.write_text(
        json.dumps({
            "new_candidates": [{"ticker": "MSFT"}],
            "positions_add_on_candidates": [],
        })
    )
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path)

    fake_date = market_today() + dt.timedelta(days=5)
    with patch.object(svc, "_fetch_earnings_for", return_value=fake_date):
        events = svc.get_events(days_ahead=30).events

    earnings = [e for e in events if e.event_type == "earnings"]
    assert len(earnings) == 1
    assert earnings[0].ticker == "MSFT"
    assert earnings[0].source_tag == "screener"


def test_get_events_excludes_past_earnings(tmp_path):
    repo = _make_positions_repo(["AAPL"])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path)

    past_date = market_today() - dt.timedelta(days=1)
    with patch.object(svc, "_fetch_earnings_for", return_value=past_date):
        events = svc.get_events(days_ahead=30).events

    assert not any(e.event_type == "earnings" for e in events)


def test_get_events_excludes_earnings_beyond_window(tmp_path):
    repo = _make_positions_repo(["AAPL"])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path)

    far_date = market_today() + dt.timedelta(days=60)
    with patch.object(svc, "_fetch_earnings_for", return_value=far_date):
        events = svc.get_events(days_ahead=30).events

    assert not any(e.event_type == "earnings" for e in events)


def test_get_events_no_crash_on_earnings_fetch_failure(tmp_path):
    repo = _make_positions_repo(["AAPL"])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path)

    with patch.object(svc, "_fetch_earnings_for", side_effect=Exception("network error")):
        events = svc.get_events(days_ahead=30).events

    assert isinstance(events, list)


def test_get_events_position_beats_screener_tag(tmp_path):
    import json

    repo = _make_positions_repo(["AAPL"])
    reviews_dir = tmp_path / "daily_reviews"
    reviews_dir.mkdir()
    review_date = market_today().isoformat()
    review_file = reviews_dir / f"daily_review_{review_date}_default.json"
    review_file.write_text(
        json.dumps({
            "new_candidates": [{"ticker": "AAPL"}],
            "positions_add_on_candidates": [],
        })
    )
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path)

    fake_date = market_today() + dt.timedelta(days=5)
    with patch.object(svc, "_fetch_earnings_for", return_value=fake_date):
        events = svc.get_events(days_ahead=30).events

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


def test_earnings_from_finnhub_includes_eps_estimate(tmp_path):
    import datetime as dt
    from unittest.mock import MagicMock, patch
    from api.services.calendar_service import CalendarService

    repo = _make_positions_repo(["AAPL"])
    svc = CalendarService(
        positions_repo=repo,
        data_dir=tmp_path,
        finnhub_api_key="test_key",
    )

    fake_date = market_today() + dt.timedelta(days=10)

    resp = MagicMock()
    resp.json.return_value = {
        "earningsCalendar": [
            {
                "symbol": "AAPL",
                "date": fake_date.isoformat(),
                "epsEstimate": 1.72,
                "epsActual": None,
                "dateConfirmed": True,
            }
        ]
    }
    resp.raise_for_status = MagicMock()

    with patch("api.services.calendar_service.httpx.get", return_value=resp):
        with patch.object(svc, "_fetch_economic_events", return_value=[]):
            with patch.object(svc, "_fetch_ipo_events", return_value=[]):
                with patch.object(svc, "_fetch_dividend_events", return_value=[]):
                    events = svc.get_events(days_ahead=30).events

    earnings = [e for e in events if e.event_type == "earnings"]
    assert len(earnings) == 1
    assert earnings[0].eps_estimate == pytest.approx(1.72)
    assert earnings[0].ticker == "AAPL"
    assert earnings[0].provider == "finnhub"
    assert 0.0 <= earnings[0].confidence <= 1.0
    assert earnings[0].confidence == pytest.approx(0.85)
    assert earnings[0].source_url == "https://finnhub.io/api/v1/calendar/earnings"


def test_earnings_falls_back_to_yfinance_when_no_finnhub_key(tmp_path):
    import datetime as dt
    from api.services.calendar_service import CalendarService

    repo = _make_positions_repo(["AAPL"])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path, finnhub_api_key=None)

    fake_date = market_today() + dt.timedelta(days=10)
    with patch.object(svc, "_fetch_earnings_for", return_value=fake_date) as mock_yf:
        with patch.object(svc, "_fetch_economic_events", return_value=[]):
            events = svc.get_events(days_ahead=30).events

    mock_yf.assert_called()
    earnings = [e for e in events if e.event_type == "earnings"]
    assert len(earnings) == 1
    assert earnings[0].provider == "yfinance"
    assert 0.0 <= earnings[0].confidence <= 1.0
    assert earnings[0].confidence == pytest.approx(0.55)


def test_earnings_finnhub_per_ticker_failure_uses_yfinance(tmp_path):
    """A per-ticker Finnhub failure uses the existing yfinance fallback."""
    from api.services.calendar_service import CalendarService

    repo = _make_positions_repo(["AAPL"])
    svc = CalendarService(
        positions_repo=repo,
        data_dir=tmp_path,
        finnhub_api_key="test_key",
    )

    with patch("api.services.calendar_service.httpx.get", side_effect=Exception("network")):
        with patch.object(svc, "_fetch_earnings_for", return_value=market_today()) as mock_yf:
            with patch.object(svc, "_fetch_economic_events", return_value=[]):
                with patch.object(svc, "_fetch_ipo_events", return_value=[]):
                    with patch.object(svc, "_fetch_dividend_events", return_value=[]):
                        events = svc.get_events(days_ahead=30).events

    mock_yf.assert_called_once_with("AAPL")
    assert isinstance(events, list)
    assert any(e.event_type == "earnings" and e.provider == "yfinance" for e in events)


def test_current_candidates_override_legacy_review_without_running_scan(tmp_path):
    svc = CalendarService(_make_positions_repo(["AAPL"]), tmp_path)
    with patch.object(svc, "_get_screener_tickers", return_value={"OLD"}) as legacy:
        with patch.object(svc, "_fetch_earnings_for", return_value=market_today()) as fetch:
            response = svc.get_events(candidate_tickers={"MSFT"})
    legacy.assert_not_called()
    assert {call.args[0] for call in fetch.call_args_list} == {"AAPL", "MSFT"}
    assert {event.ticker for event in response.events} == {"AAPL", "MSFT"}


def test_explicit_empty_candidates_do_not_read_legacy_review(tmp_path):
    svc = CalendarService(_make_positions_repo([]), tmp_path)
    with patch.object(svc, "_get_screener_tickers") as legacy:
        response = svc.get_events(candidate_tickers=set())
    legacy.assert_not_called()
    assert response.events == []
    assert {warning.event_type for warning in response.warnings} == {"economic", "ipo"}


def test_source_failure_preserves_events_and_never_logs_credentials(tmp_path, caplog):
    svc = CalendarService(_make_positions_repo([]), tmp_path, "fake-secret-marker")
    event = CalendarEvent(date=market_today().isoformat(), event_type="ipo", title="IPO", source_tag="ipo")
    with patch.object(svc, "_fetch_ipo_events", return_value=[event]):
        with patch("api.services.calendar_service.httpx.get", side_effect=Exception(
            "https://provider.invalid/?token=fake-secret-marker"
        )):
            with caplog.at_level("DEBUG", logger="api.services.calendar_service"):
                response = svc.get_events()
    assert response.events == [event]
    assert [warning.event_type for warning in response.warnings] == ["economic"]
    assert "fake-secret-marker" not in caplog.text
    assert "fake-secret-marker" not in response.model_dump_json()


def test_failed_fallback_retains_other_ticker_earnings(tmp_path):
    svc = CalendarService(_make_positions_repo([]), tmp_path, "test-key")
    def finnhub(ticker, start, end):
        if ticker == "FAIL":
            raise RuntimeError("unavailable")
        return market_today(), None, None
    with patch.object(svc, "_fetch_earnings_for_finnhub", side_effect=finnhub):
        with patch.object(svc, "_fetch_earnings_for", side_effect=RuntimeError("unavailable")):
            with patch.object(svc, "_fetch_economic_events", return_value=[]):
                with patch.object(svc, "_fetch_ipo_events", return_value=[]):
                    response = svc.get_events(candidate_tickers={"OK", "FAIL"})
    assert [event.ticker for event in response.events] == ["OK"]
    assert response.warnings[0].event_type == "earnings"
    assert response.warnings[0].tickers == ["FAIL"]


def test_ipo_events_returned_when_finnhub_key_set(tmp_path):
    import datetime as dt
    from unittest.mock import MagicMock, patch
    from api.services.calendar_service import CalendarService

    repo = _make_positions_repo([])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path, finnhub_api_key="test_key")

    ipo_date = (market_today() + dt.timedelta(days=5)).isoformat()
    resp = MagicMock()
    resp.json.return_value = {
        "ipoCalendar": [
            {"date": ipo_date, "symbol": "ACME", "name": "Acme Corp", "status": "priced"}
        ]
    }
    resp.raise_for_status = MagicMock()

    with patch("api.services.calendar_service.httpx.get", return_value=resp):
        with patch.object(svc, "_batch_fetch_earnings", return_value=[]):
            with patch.object(svc, "_fetch_economic_events", return_value=[]):
                with patch.object(svc, "_fetch_dividend_events", return_value=[]):
                    events = svc.get_events(days_ahead=30).events

    ipos = [e for e in events if e.event_type == "ipo"]
    assert len(ipos) == 1
    assert ipos[0].ticker == "ACME"
    assert ipos[0].source_tag == "ipo"
    assert ipos[0].provider == "finnhub"
    assert 0.0 <= ipos[0].confidence <= 1.0
    assert ipos[0].confidence == pytest.approx(0.8)
    assert ipos[0].source_url == "https://finnhub.io/api/v1/calendar/ipo"


def test_ipo_events_skipped_when_no_finnhub_key(tmp_path):
    from api.services.calendar_service import CalendarService

    repo = _make_positions_repo([])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path, finnhub_api_key=None)

    with patch.object(svc, "_batch_fetch_earnings", return_value=[]):
        with patch.object(svc, "_fetch_economic_events", return_value=[]):
            with patch.object(svc, "_fetch_dividend_events", return_value=[]):
                events = svc.get_events(days_ahead=30).events

    assert not any(e.event_type == "ipo" for e in events)


def test_ipo_speculative_status_excluded(tmp_path):
    import datetime as dt
    from unittest.mock import MagicMock, patch
    from api.services.calendar_service import CalendarService

    repo = _make_positions_repo([])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path, finnhub_api_key="test_key")

    ipo_date = (market_today() + dt.timedelta(days=5)).isoformat()
    resp = MagicMock()
    resp.json.return_value = {
        "ipoCalendar": [
            {"date": ipo_date, "symbol": "SPEC", "name": "Speculative Co", "status": "expected"}
        ]
    }
    resp.raise_for_status = MagicMock()

    with patch("api.services.calendar_service.httpx.get", return_value=resp):
        with patch.object(svc, "_batch_fetch_earnings", return_value=[]):
            with patch.object(svc, "_fetch_economic_events", return_value=[]):
                with patch.object(svc, "_fetch_dividend_events", return_value=[]):
                    events = svc.get_events(days_ahead=30).events

    assert not any(e.event_type == "ipo" for e in events)


def test_dividend_events_only_for_position_tickers(tmp_path):
    import datetime as dt
    from unittest.mock import MagicMock, patch
    from api.services.calendar_service import CalendarService

    repo = _make_positions_repo(["AAPL"])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path, finnhub_api_key="test_key")

    div_date = (market_today() + dt.timedelta(days=7)).isoformat()
    resp = MagicMock()
    resp.json.return_value = {
        "dividendCalendar": [{"date": div_date, "amount": 0.25}]
    }
    resp.raise_for_status = MagicMock()

    with patch("api.services.calendar_service.httpx.get", return_value=resp):
        with patch.object(svc, "_batch_fetch_earnings", return_value=[]):
            with patch.object(svc, "_fetch_economic_events", return_value=[]):
                with patch.object(svc, "_fetch_ipo_events", return_value=[]):
                    events = svc.get_events(days_ahead=30).events

    divs = [e for e in events if e.event_type == "dividend"]
    assert len(divs) == 1
    assert divs[0].ticker == "AAPL"
    assert divs[0].source_tag == "position"
    assert divs[0].provider == "finnhub"
    assert 0.0 <= divs[0].confidence <= 1.0
    assert divs[0].confidence == pytest.approx(0.8)
    assert divs[0].source_url == "https://finnhub.io/api/v1/calendar/dividend"


def test_economic_events_include_finnhub_provenance_and_confidence(tmp_path):
    import datetime as dt
    from unittest.mock import MagicMock, patch
    from api.services.calendar_service import CalendarService

    repo = _make_positions_repo([])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path, finnhub_api_key="test_key")

    event_date = market_today() + dt.timedelta(days=3)
    resp = MagicMock()
    resp.json.return_value = {
        "economicCalendar": [
            {
                "time": f"{event_date.isoformat()} 08:30:00",
                "event": "CPI",
                "impact": "high",
            }
        ]
    }
    resp.raise_for_status = MagicMock()

    with patch("api.services.calendar_service.httpx.get", return_value=resp):
        with patch.object(svc, "_batch_fetch_earnings", return_value=[]):
            with patch.object(svc, "_fetch_ipo_events", return_value=[]):
                with patch.object(svc, "_fetch_dividend_events", return_value=[]):
                    events = svc.get_events(days_ahead=30).events

    economic = [e for e in events if e.event_type == "economic"]
    assert len(economic) == 1
    assert economic[0].provider == "finnhub"
    assert 0.0 <= economic[0].confidence <= 1.0
    assert economic[0].confidence == pytest.approx(0.8)
    assert economic[0].source_url == "https://finnhub.io/api/v1/calendar/economic"


def test_dividend_events_skipped_when_no_finnhub_key(tmp_path):
    from api.services.calendar_service import CalendarService

    repo = _make_positions_repo(["AAPL"])
    svc = CalendarService(positions_repo=repo, data_dir=tmp_path, finnhub_api_key=None)

    with patch.object(svc, "_batch_fetch_earnings", return_value=[]):
        with patch.object(svc, "_fetch_economic_events", return_value=[]):
            with patch.object(svc, "_fetch_ipo_events", return_value=[]):
                events = svc.get_events(days_ahead=30).events

    assert not any(e.event_type == "dividend" for e in events)
