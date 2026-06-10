from __future__ import annotations

import json
import time

from swing_screener.data.ticker_info import get_multiple_ticker_info, get_ticker_info


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


def test_get_multiple_ticker_info_reuses_persistent_cache(tmp_path, monkeypatch):
    calls: list[str] = []

    def fake_ticker(symbol: str) -> _FakeTicker:
        calls.append(symbol)
        return _FakeTicker({"longName": f"{symbol} Corp", "sector": "Technology", "currency": "USD"})

    monkeypatch.setattr("swing_screener.data.ticker_info.yf.Ticker", fake_ticker)
    cache_path = tmp_path / "ticker_info.json"

    first = get_multiple_ticker_info(["AAA", "BBB"], cache_path=cache_path)
    assert len(calls) == 2
    assert first["AAA"]["name"] == "AAA Corp"

    second = get_multiple_ticker_info(["AAA", "BBB"], cache_path=cache_path)
    assert len(calls) == 2
    assert second["BBB"]["sector"] == "Technology"


def test_get_multiple_ticker_info_refetches_expired_entries(tmp_path, monkeypatch):
    calls: list[str] = []

    def fake_ticker(symbol: str) -> _FakeTicker:
        calls.append(symbol)
        return _FakeTicker({"longName": f"{symbol} Corp", "sector": "Energy", "currency": "USD"})

    monkeypatch.setattr("swing_screener.data.ticker_info.yf.Ticker", fake_ticker)
    cache_path = tmp_path / "ticker_info.json"
    stale_at = time.time() - 30 * 86400
    cache_path.write_text(
        json.dumps(
            {
                "AAA": {
                    "name": "Stale Corp",
                    "sector": "Utilities",
                    "currency": "USD",
                    "fetched_at": stale_at,
                }
            }
        ),
        encoding="utf-8",
    )

    out = get_multiple_ticker_info(["AAA"], cache_path=cache_path)
    assert calls == ["AAA"]
    assert out["AAA"]["name"] == "AAA Corp"


def test_get_multiple_ticker_info_does_not_cache_failures(tmp_path, monkeypatch):
    calls: list[str] = []

    def failing_ticker(symbol: str):
        calls.append(symbol)
        raise RuntimeError("network down")

    monkeypatch.setattr("swing_screener.data.ticker_info.yf.Ticker", failing_ticker)
    cache_path = tmp_path / "ticker_info.json"

    out = get_multiple_ticker_info(["AAPL"], cache_path=cache_path)
    assert out["AAPL"]["name"] is None

    get_multiple_ticker_info(["AAPL"], cache_path=cache_path)
    assert calls == ["AAPL", "AAPL"]


def test_get_ticker_info_falls_back_to_detected_currency_on_error(monkeypatch):
    def _raise(_):
        raise RuntimeError("network down")

    monkeypatch.setattr("swing_screener.data.ticker_info.yf.Ticker", _raise)

    info = get_ticker_info("SAP.DE")
    assert info["name"] is None
    assert info["sector"] is None
    assert info["currency"] == "EUR"
