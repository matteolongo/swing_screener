"""Tests for earnings proximity endpoint."""
from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.services import portfolio_service


@pytest.fixture(autouse=True)
def clear_earnings_cache():
    portfolio_service._earnings_cache.clear()
    yield
    portfolio_service._earnings_cache.clear()


client = TestClient(app)


def test_earnings_within_10_days_returns_warning():
    near_date = (date.today() + timedelta(days=5)).isoformat()
    mock_ticker = MagicMock()
    mock_ticker.calendar = {"Earnings Date": [near_date]}

    with patch("yfinance.Ticker", return_value=mock_ticker):
        response = client.get("/api/portfolio/earnings-proximity/AAPL")

    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "AAPL"
    assert data["warning"] is True
    assert data["days_until"] == 5
    assert data["next_earnings_date"] == near_date


def test_earnings_beyond_10_days_returns_no_warning():
    far_date = (date.today() + timedelta(days=30)).isoformat()
    mock_ticker = MagicMock()
    mock_ticker.calendar = {"Earnings Date": [far_date]}

    with patch("yfinance.Ticker", return_value=mock_ticker):
        response = client.get("/api/portfolio/earnings-proximity/AAPL")

    assert response.status_code == 200
    data = response.json()
    assert data["warning"] is False
    assert data["days_until"] == 30


def test_yfinance_failure_returns_no_warning():
    with patch("yfinance.Ticker", side_effect=Exception("network error")):
        response = client.get("/api/portfolio/earnings-proximity/AAPL")

    assert response.status_code == 200
    data = response.json()
    assert data["warning"] is False
    assert data["next_earnings_date"] is None
    assert data["days_until"] is None
