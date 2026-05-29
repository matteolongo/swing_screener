from __future__ import annotations

import datetime as dt
from unittest.mock import MagicMock, patch


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
        result = fetch_next_earnings_days(
            tickers=["AAPL"],
            finnhub_api_key="test-key",
            asof_date=dt.date.today(),
        )

    assert result["AAPL"] is None


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


def test_returns_none_for_ticker_on_fetch_error():
    from swing_screener.fundamentals.earnings_proximity import fetch_next_earnings_days

    with patch("swing_screener.fundamentals.earnings_proximity.httpx.get", side_effect=Exception("timeout")):
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
