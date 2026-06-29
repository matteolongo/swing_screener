import json
import time
from pathlib import Path

import pytest

from swing_screener.data.providers.market_metadata import (
    MARKET_SUFFIX,
    COUNTRY_BY_MARKET,
    CURRENCY_BY_MARKET,
    EXCHANGE_BY_MARKET,
    market_from_ticker,
)


def test_market_suffix_covers_expected_eu_markets():
    expected = {".PA", ".AS", ".MI", ".DE", ".L", ".SW", ".ST", ".MC", ".HE", ".BR"}
    assert expected.issubset(set(MARKET_SUFFIX.keys()))


def test_market_from_ticker_eu():
    assert market_from_ticker("ASML.AS") == "nl"
    assert market_from_ticker("MC.PA") == "fr"
    assert market_from_ticker("ENI.MI") == "it"
    assert market_from_ticker("ABI.BR") == "be"


def test_market_from_ticker_us_default():
    assert market_from_ticker("AAPL") == "us"
    assert market_from_ticker("MSFT") == "us"


def test_country_by_market_complete():
    for market in MARKET_SUFFIX.values():
        assert market in COUNTRY_BY_MARKET, f"Missing country for market {market!r}"


def test_currency_by_market_complete():
    for market in MARKET_SUFFIX.values():
        assert market in CURRENCY_BY_MARKET, f"Missing currency for market {market!r}"


def test_exchange_by_market_complete():
    for market in MARKET_SUFFIX.values():
        assert market in EXCHANGE_BY_MARKET, f"Missing exchange for market {market!r}"


def test_us_in_supporting_maps():
    assert COUNTRY_BY_MARKET["us"] == "US"
    assert CURRENCY_BY_MARKET["us"] == "USD"


# ---------------------------------------------------------------------------
# fetch_ticker_metadata TTL tests
# ---------------------------------------------------------------------------

from swing_screener.data.market_data import fetch_ticker_metadata


def test_ticker_metadata_respects_ttl(tmp_path):
    """Stale cache entries (beyond TTL) are not returned from cache."""
    cache_file = tmp_path / "ticker_meta.json"
    # Write a stale entry: fetched 40 days ago
    stale_ts = time.time() - (40 * 86400)
    cache_file.write_text(
        json.dumps({"AAPL": {"name": "Stale Apple", "currency": "USD", "exchange": "NMS", "fetched_at": stale_ts}}),
        encoding="utf-8",
    )
    # Should NOT return stale entry; instead falls through to network (or raises)
    # We monkeypatch yf.Ticker to avoid a network call
    import yfinance as yf
    from unittest.mock import patch, MagicMock

    mock_ticker = MagicMock()
    mock_ticker.fast_info = None
    mock_ticker.get_info.return_value = {"shortName": "Fresh Apple", "currency": "USD", "exchange": "XNAS"}
    with patch.object(yf, "Ticker", return_value=mock_ticker):
        df = fetch_ticker_metadata(
            ["AAPL"],
            cache_path=str(cache_file),
            cache_ttl_days=30,
        )
    # Should have re-fetched (not used stale cache)
    assert df.loc["AAPL", "name"] == "Fresh Apple"


def test_ticker_metadata_uses_fresh_cache(tmp_path):
    """Fresh cache entries (within TTL) are returned without network calls."""
    cache_file = tmp_path / "ticker_meta.json"
    fresh_ts = time.time() - (1 * 86400)  # 1 day ago
    cache_file.write_text(
        json.dumps({"AAPL": {"name": "Cached Apple", "currency": "USD", "exchange": "NMS", "fetched_at": fresh_ts}}),
        encoding="utf-8",
    )
    import yfinance as yf
    from unittest.mock import patch

    with patch.object(yf, "Ticker", side_effect=AssertionError("should not call yfinance")):
        df = fetch_ticker_metadata(
            ["AAPL"],
            cache_path=str(cache_file),
            cache_ttl_days=30,
        )
    assert df.loc["AAPL", "name"] == "Cached Apple"
