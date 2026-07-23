"""Contract tests for deterministic market-data support."""

import pytest

from tests.support.factories.screener import ohlcv_frame
from tests.support.fakes.market_data import FakeMarketDataProvider


def test_ohlcv_builder_preserves_multiindex_contract():
    frame = ohlcv_frame(
        {"AAPL": [100.0, 101.0], "MSFT": [200.0, 201.0]},
        volume={"AAPL": [1.0, 2.0], "MSFT": [3.0, 4.0]},
    )
    assert frame.index[0].strftime("%Y-%m-%d") == "2026-01-01"
    assert frame.columns.names == ["field", "ticker"]
    assert frame[("High", "AAPL")].tolist() == [101.0, 102.0]
    assert frame[("Volume", "MSFT")].tolist() == [3.0, 4.0]


def test_fake_records_calls_and_resolves_latest_prices():
    provider = FakeMarketDataProvider(
        ohlcv=ohlcv_frame({"AAPL": [100.0, 101.0]}),
        latest_prices={"MSFT": 202.0},
    )
    assert list(provider.fetch_ohlcv(["AAPL"], start_date="2026-01-01").columns)
    assert provider.fetch_latest_price("MSFT") == 202.0
    assert provider.fetch_latest_price("AAPL") == 101.0
    assert provider.fetch_ohlcv_calls[0]["tickers"] == ["AAPL"]
    assert provider.fetch_latest_price_calls == ["MSFT", "AAPL"]
    assert provider.get_source_health().status == "ok"


def test_fake_raises_for_missing_data():
    provider = FakeMarketDataProvider(ohlcv=ohlcv_frame({"AAPL": [100.0]}))
    with pytest.raises(KeyError, match="MSFT"):
        provider.fetch_ohlcv(["MSFT"])
    with pytest.raises(KeyError, match="MSFT"):
        provider.fetch_latest_price("MSFT")
