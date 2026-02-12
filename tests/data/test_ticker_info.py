from __future__ import annotations

from swing_screener.data.ticker_info import get_ticker_info


class _FakeTicker:
    def __init__(self, info: dict):
        self.info = info


def test_get_ticker_info_returns_currency_from_provider(monkeypatch):
    monkeypatch.setattr(
        "swing_screener.data.ticker_info.yf.Ticker",
        lambda _: _FakeTicker({"longName": "ASML Holding", "sector": "Technology", "currency": "EUR"}),
    )

    info = get_ticker_info("ASML.AS")
    assert info["name"] == "ASML Holding"
    assert info["sector"] == "Technology"
    assert info["currency"] == "EUR"


def test_get_ticker_info_falls_back_to_detected_currency_on_error(monkeypatch):
    def _raise(_):
        raise RuntimeError("network down")

    monkeypatch.setattr("swing_screener.data.ticker_info.yf.Ticker", _raise)

    info = get_ticker_info("SAP.DE")
    assert info["name"] is None
    assert info["sector"] is None
    assert info["currency"] == "EUR"
