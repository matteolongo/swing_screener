from __future__ import annotations

import datetime as dt
from unittest.mock import MagicMock, patch

import httpx


def _mock_finnhub_earnings(ticker: str, earnings_date: dt.date) -> MagicMock:
    resp = MagicMock()
    resp.raise_for_status = MagicMock()
    resp.json.return_value = {
        "earningsCalendar": [
            {
                "symbol": ticker,
                "date": earnings_date.isoformat(),
                "epsEstimate": 1.5,
                "epsActual": None,
            }
        ]
    }
    return resp


def test_returns_days_to_earnings_from_finnhub():
    from swing_screener.fundamentals.earnings_proximity import fetch_next_earnings_days

    today = dt.date.today()
    earnings_in_10 = today + dt.timedelta(days=10)

    with patch(
        "swing_screener.fundamentals.earnings_proximity.httpx.get",
        return_value=_mock_finnhub_earnings("AAPL", earnings_in_10),
    ):
        result = fetch_next_earnings_days(
            tickers=["AAPL"],
            finnhub_api_key="test-key",
            asof_date=today,
        )

    assert result["AAPL"] == 10


def test_returns_none_for_past_earnings():
    from swing_screener.fundamentals.earnings_proximity import fetch_next_earnings_days

    today = dt.date.today()
    past_date = today - dt.timedelta(days=5)

    with patch(
        "swing_screener.fundamentals.earnings_proximity.httpx.get",
        return_value=_mock_finnhub_earnings("AAPL", past_date),
    ):
        result = fetch_next_earnings_days(
            tickers=["AAPL"],
            finnhub_api_key="test-key",
            asof_date=today,
        )

    assert result["AAPL"] is None


def test_returns_none_when_finnhub_returns_empty():
    from swing_screener.fundamentals.earnings_proximity import fetch_next_earnings_days

    resp = MagicMock()
    resp.raise_for_status = MagicMock()
    resp.json.return_value = {"earningsCalendar": []}

    with patch("swing_screener.fundamentals.earnings_proximity.httpx.get", return_value=resp):
        with patch("swing_screener.fundamentals.earnings_proximity.yf.Ticker", side_effect=Exception("no calendar")):
            result = fetch_next_earnings_days(
                tickers=["AAPL"],
                finnhub_api_key="test-key",
                asof_date=dt.date.today(),
            )

    assert result["AAPL"] is None


def test_falls_back_to_yfinance_when_finnhub_returns_empty():
    from swing_screener.fundamentals.earnings_proximity import fetch_next_earnings_days

    today = dt.date.today()
    earnings_date = today + dt.timedelta(days=7)
    resp = MagicMock()
    resp.raise_for_status = MagicMock()
    resp.json.return_value = {"earningsCalendar": []}
    mock_ticker = MagicMock()
    mock_ticker.calendar = {"Earnings Date": [earnings_date]}

    with patch("swing_screener.fundamentals.earnings_proximity.httpx.get", return_value=resp):
        with patch("swing_screener.fundamentals.earnings_proximity.yf.Ticker", return_value=mock_ticker):
            result = fetch_next_earnings_days(
                tickers=["AAPL"],
                finnhub_api_key="test-key",
                asof_date=today,
            )

    assert result["AAPL"] == 7


def test_falls_back_to_yfinance_when_finnhub_errors():
    from swing_screener.fundamentals.earnings_proximity import fetch_next_earnings_days

    today = dt.date.today()
    earnings_date = today + dt.timedelta(days=9)
    mock_ticker = MagicMock()
    mock_ticker.calendar = {"Earnings Date": [earnings_date]}

    with patch("swing_screener.fundamentals.earnings_proximity.httpx.get", side_effect=Exception("timeout")):
        with patch("swing_screener.fundamentals.earnings_proximity.yf.Ticker", return_value=mock_ticker):
            result = fetch_next_earnings_days(
                tickers=["AAPL"],
                finnhub_api_key="test-key",
                asof_date=today,
            )

    assert result["AAPL"] == 9


def test_finnhub_auth_failure_disables_remaining_batch_lookups():
    from swing_screener.fundamentals.earnings_proximity import fetch_next_earnings_days

    request = httpx.Request("GET", "https://finnhub.io/api/v1/calendar/earnings")
    response = httpx.Response(401, request=request)
    auth_error = httpx.HTTPStatusError("unauthorized", request=request, response=response)
    resp = MagicMock()
    resp.raise_for_status.side_effect = auth_error

    with patch("swing_screener.fundamentals.earnings_proximity.httpx.get", return_value=resp) as get:
        with patch("swing_screener.fundamentals.earnings_proximity.yf.Ticker", side_effect=Exception("no calendar")):
            result = fetch_next_earnings_days(
                tickers=["AAPL", "MSFT", "NVDA"],
                finnhub_api_key="bad-key",
                asof_date=dt.date.today(),
                max_workers=1,
            )

    assert result == {"AAPL": None, "MSFT": None, "NVDA": None}
    assert get.call_count == 1


def test_returns_none_when_both_earnings_sources_fail():
    from swing_screener.fundamentals.earnings_proximity import fetch_next_earnings_days

    with patch("swing_screener.fundamentals.earnings_proximity.httpx.get", side_effect=Exception("timeout")):
        with patch("swing_screener.fundamentals.earnings_proximity.yf.Ticker", side_effect=Exception("no calendar")):
            result = fetch_next_earnings_days(
                tickers=["AAPL"],
                finnhub_api_key="test-key",
                asof_date=dt.date.today(),
            )

    assert result["AAPL"] is None


def test_past_finnhub_date_does_not_fall_back_to_yfinance():
    from swing_screener.fundamentals.earnings_proximity import fetch_next_earnings_days

    today = dt.date.today()
    past_date = today - dt.timedelta(days=5)
    mock_ticker = MagicMock()
    mock_ticker.calendar = {"Earnings Date": [today + dt.timedelta(days=7)]}

    with patch(
        "swing_screener.fundamentals.earnings_proximity.httpx.get",
        return_value=_mock_finnhub_earnings("AAPL", past_date),
    ):
        with patch("swing_screener.fundamentals.earnings_proximity.yf.Ticker", return_value=mock_ticker):
            result = fetch_next_earnings_days(
                tickers=["AAPL"],
                finnhub_api_key="test-key",
                asof_date=today,
            )

    assert result["AAPL"] is None


def test_returns_none_for_ticker_on_fetch_error():
    from swing_screener.fundamentals.earnings_proximity import fetch_next_earnings_days

    with patch("swing_screener.fundamentals.earnings_proximity.httpx.get", side_effect=Exception("timeout")):
        with patch("swing_screener.fundamentals.earnings_proximity.yf.Ticker", side_effect=Exception("no calendar")):
            result = fetch_next_earnings_days(
                tickers=["AAPL"],
                finnhub_api_key="test-key",
                asof_date=dt.date.today(),
            )

    assert result["AAPL"] is None


def test_handles_multiple_tickers():
    from swing_screener.fundamentals.earnings_proximity import fetch_next_earnings_days

    today = dt.date.today()

    def side_effect(url, **kwargs):
        params = kwargs.get("params", {})
        symbol = params.get("symbol", "")
        days = 5 if symbol == "AAPL" else 15
        return _mock_finnhub_earnings(symbol, today + dt.timedelta(days=days))

    with patch("swing_screener.fundamentals.earnings_proximity.httpx.get", side_effect=side_effect):
        result = fetch_next_earnings_days(
            tickers=["AAPL", "MSFT"],
            finnhub_api_key="test-key",
            asof_date=today,
        )

    assert result["AAPL"] == 5
    assert result["MSFT"] == 15


def test_falls_back_to_yfinance_when_no_finnhub_key():
    from swing_screener.fundamentals.earnings_proximity import fetch_next_earnings_days

    today = dt.date.today()
    earnings_date = today + dt.timedelta(days=7)
    mock_ticker = MagicMock()
    mock_ticker.calendar = {"Earnings Date": [earnings_date]}

    with patch("swing_screener.fundamentals.earnings_proximity.yf.Ticker", return_value=mock_ticker):
        result = fetch_next_earnings_days(
            tickers=["AAPL"],
            finnhub_api_key=None,
            asof_date=today,
        )

    assert result["AAPL"] == 7


def test_caches_earnings_days_per_ticker_and_asof(tmp_path):
    from swing_screener.fundamentals.earnings_proximity import fetch_next_earnings_days

    today = dt.date.today()
    cache_path = tmp_path / "earnings_days.json"
    calls: list[str] = []

    def side_effect(url, **kwargs):
        symbol = kwargs.get("params", {}).get("symbol", "")
        calls.append(symbol)
        return _mock_finnhub_earnings(symbol, today + dt.timedelta(days=10))

    with patch("swing_screener.fundamentals.earnings_proximity.httpx.get", side_effect=side_effect):
        first = fetch_next_earnings_days(
            tickers=["AAPL"],
            finnhub_api_key="test-key",
            asof_date=today,
            cache_path=cache_path,
        )
        second = fetch_next_earnings_days(
            tickers=["AAPL"],
            finnhub_api_key="test-key",
            asof_date=today,
            cache_path=cache_path,
        )

    assert first["AAPL"] == 10
    assert second["AAPL"] == 10
    assert calls == ["AAPL"]


def test_cache_is_scoped_to_asof_date(tmp_path):
    from swing_screener.fundamentals.earnings_proximity import fetch_next_earnings_days

    today = dt.date.today()
    yesterday = today - dt.timedelta(days=1)
    cache_path = tmp_path / "earnings_days.json"
    calls: list[str] = []

    def side_effect(url, **kwargs):
        symbol = kwargs.get("params", {}).get("symbol", "")
        calls.append(symbol)
        return _mock_finnhub_earnings(symbol, today + dt.timedelta(days=10))

    with patch("swing_screener.fundamentals.earnings_proximity.httpx.get", side_effect=side_effect):
        fetch_next_earnings_days(
            tickers=["AAPL"], finnhub_api_key="test-key", asof_date=yesterday, cache_path=cache_path
        )
        fetch_next_earnings_days(
            tickers=["AAPL"], finnhub_api_key="test-key", asof_date=today, cache_path=cache_path
        )

    assert calls == ["AAPL", "AAPL"]


def test_does_not_cache_unknown_earnings(tmp_path):
    from swing_screener.fundamentals.earnings_proximity import fetch_next_earnings_days

    today = dt.date.today()
    cache_path = tmp_path / "earnings_days.json"
    calls: list[str] = []

    def failing_get(url, **kwargs):
        calls.append(kwargs.get("params", {}).get("symbol", ""))
        raise httpx.ConnectError("network down")

    failing_ticker = MagicMock()
    failing_ticker.calendar = {}

    with patch("swing_screener.fundamentals.earnings_proximity.httpx.get", side_effect=failing_get), \
         patch("swing_screener.fundamentals.earnings_proximity.yf.Ticker", return_value=failing_ticker):
        first = fetch_next_earnings_days(
            tickers=["AAPL"], finnhub_api_key="test-key", asof_date=today, cache_path=cache_path
        )
        fetch_next_earnings_days(
            tickers=["AAPL"], finnhub_api_key="test-key", asof_date=today, cache_path=cache_path
        )

    assert first["AAPL"] is None
    assert calls == ["AAPL", "AAPL"]
